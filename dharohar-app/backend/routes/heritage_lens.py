import os
import hashlib
import base64
import json
import io
import httpx
from PIL import Image
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from pydantic import BaseModel
from typing import Optional
from supabase import create_client, Client

router = APIRouter(prefix="/api/heritage-lens", tags=["Heritage Lens"])

def get_supabase_client() -> Client:
    # Need to go up one directory level for .env or assume env vars are loaded
    url = os.getenv("VITE_SUPABASE_URL")
    key = os.getenv("VITE_SUPABASE_ANON_KEY")
    if not url or not key:
        # Load from .env if running from backend dir
        from dotenv import load_dotenv
        load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
        url = os.getenv("VITE_SUPABASE_URL")
        key = os.getenv("VITE_SUPABASE_ANON_KEY")
    
    if not url or not key:
        raise HTTPException(status_code=500, detail="Supabase credentials missing.")
    return create_client(url, key)

def get_gemini_key() -> str:
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        from dotenv import load_dotenv
        load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))
        key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="Gemini API Key missing.")
    return key

@router.post("/analyze")
async def analyze_monument(
    image: UploadFile = File(...),
    uploaded_by: Optional[str] = Form(None)
):
    # 1. Read and validate image
    try:
        contents = await image.read()
        if not contents:
            raise ValueError("Empty file")
            
        # Optional size check
        if len(contents) > 20 * 1024 * 1024:
            raise ValueError("Image too large")
    except Exception as e:
        print(f"Image read error: {e}")
        raise HTTPException(status_code=400, detail="Invalid image file uploaded.")
    
    image_hash = hashlib.md5(contents).hexdigest()
    supabase = get_supabase_client()
    
    # 2. Check cache (Supabase DB)
    try:
        response = supabase.table("heritage_lens_scans").select("*").eq("image_hash", image_hash).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]
    except Exception as e:
        print(f"Supabase cache read error: {e}")
        # Proceed to analyze if db fails for some reason
        pass

    # 3. Compress image before sending to Gemini
    try:
        img = Image.open(io.BytesIO(contents))
        # Convert to RGB if needed (e.g. RGBA png)
        if img.mode in ("RGBA", "P"):
            img = img.convert("RGB")
            
        max_size = (1600, 1600)
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        out_bytes = io.BytesIO()
        img.save(out_bytes, format="JPEG", quality=85)
        optimized_contents = out_bytes.getvalue()
        
        print(f"Original size: {len(contents)} bytes. Optimized size: {len(optimized_contents)} bytes.")
        
        mime_type = "image/jpeg"
        base64_img = base64.b64encode(optimized_contents).decode("utf-8")
    except Exception as e:
        print(f"Image processing error: {e}")
        raise HTTPException(status_code=400, detail="Failed to process image file. Ensure it is a valid image.")

    # 4. Call Gemini
    api_key = get_gemini_key()
    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key={api_key}"
    
    prompt = """
You are a master architectural historian and heritage expert.
Analyze the provided image of a monument/structure and return a strictly valid JSON object.
ONLY describe what is visually identifiable. DO NOT invent specific historical dates or names if you cannot visually justify them. If uncertain, state your uncertainty in the confidence field.

Return exactly this JSON format:
{
  "structure_type": "e.g. Temple, Fort, Stepwell, Mosque, etc.",
  "confidence": "e.g. High, Medium, Low - brief reason if low",
  "architecture_json": {
    "style": "Description of style",
    "notable_elements": ["element1", "element2"]
  },
  "materials_json": {
    "primary": "Main material",
    "details": "Description of materials used"
  },
  "engineering_json": {
    "structural_system": "e.g. trabeate, arcuate",
    "techniques": "Notable techniques"
  },
  "history_json": {
    "likely_era": "e.g. 12th Century, Mughal, Chalukya",
    "context": "Brief historical context based on visual style"
  }
}
"""

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": base64_img
                        }
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "responseMimeType": "application/json"
        }
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            gemini_res = await client.post(gemini_url, json=payload)
    except Exception as e:
        print(f"Network error calling Gemini: {e}")
        raise HTTPException(status_code=502, detail="Analysis service is temporarily unavailable.")
        
    if not gemini_res.is_success:
        print(f"Gemini API Error [{gemini_res.status_code}]: {gemini_res.text}")
        raise HTTPException(status_code=502, detail="Analysis service is temporarily unavailable.")
        
    try:
        data = gemini_res.json()
        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        # In case Gemini returns markdown block
        raw_text = raw_text.replace("```json", "").replace("```", "").strip()
        analysis = json.loads(raw_text)
    except Exception as e:
        raw_data = gemini_res.text if 'gemini_res' in locals() else "N/A"
        print(f"Failed to parse Gemini response: {e}\nRaw Response: {raw_data}")
        raise HTTPException(status_code=502, detail="Analysis service returned an invalid response.")

    # Convert low-confidence explicitly to a valid 200 state, not a failure
    conf = str(analysis.get("confidence", "")).lower()
    if "low" in conf or "uncertain" in conf:
        analysis["confidence"] = "Low"

    # 5. Save to DB
    record = {
        "image_hash": image_hash,
        "structure_type": analysis.get("structure_type", "Unknown"),
        "confidence": analysis.get("confidence", "Unknown"),
        "architecture_json": analysis.get("architecture_json", {}),
        "materials_json": analysis.get("materials_json", {}),
        "engineering_json": analysis.get("engineering_json", {}),
        "history_json": analysis.get("history_json", {})
    }
    
    if uploaded_by:
        record["uploaded_by"] = uploaded_by

    try:
        inserted = supabase.table("heritage_lens_scans").insert(record).execute()
        if inserted.data:
            return inserted.data[0]
    except Exception as e:
        print(f"Supabase insert error: {e}")
        # Return the generated record anyway if DB insert fails
        return record
    
    return record
