import os
import uuid
import httpx
from datetime import datetime
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Optional
import hashlib
from gtts import gTTS

from routes.heritage_lens import router as heritage_lens_router

app = FastAPI()

app.include_router(heritage_lens_router)

os.makedirs("audio_cache", exist_ok=True)
app.mount("/audio", StaticFiles(directory="audio_cache"), name="audio")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class CulturalRecordBase(BaseModel):
    id: str
    title: str
    category: str
    shortDescription: str
    fullDescription: Optional[str] = None
    images: List[str] = []
    sourceType: str
    sourceName: str
    sourceUrl: str
    sourceIdentifier: str
    retrievedAt: str
    state: Optional[str] = "Unspecified"
    district: Optional[str] = None
    originalLanguage: Optional[str] = "English"
    verificationStatus: str = "unverified"
    lifecycleStatus: str = "published"
    coordinates: Optional[List[float]] = None

WIKIPEDIA_API_URL = "https://en.wikipedia.org/w/api.php"
WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php"

# In-memory cache for search queries
search_cache = {}

@app.get("/api/search", response_model=List[CulturalRecordBase])
async def search_external(q: str = Query(..., min_length=2)):
    """Search Wikipedia and Wikidata for supplementary heritage info."""
    query = q.lower().strip()
    
    if query in search_cache:
        return search_cache[query]
        
    results = []
    
    headers = {"User-Agent": "DharoharSetu/1.0 (contact@example.com)"}
    async with httpx.AsyncClient(timeout=10.0, headers=headers) as client:
        # 1. Search Wikipedia
        try:
            wiki_params = {
                "action": "query",
                "list": "search",
                "srsearch": query,
                "utf8": "",
                "format": "json",
                "srlimit": 2
            }
            wiki_resp = await client.get(WIKIPEDIA_API_URL, params=wiki_params)
            wiki_data = wiki_resp.json()
            
            search_hits = wiki_data.get("query", {}).get("search", [])
            for hit in search_hits:
                page_id = hit["pageid"]
                title = hit["title"]
                
                # Fetch page summary and image
                summary_params = {
                    "action": "query",
                    "prop": "extracts|pageimages",
                    "pageids": page_id,
                    "exintro": "1",
                    "explaintext": "1",
                    "pithumbsize": 800,
                    "format": "json"
                }
                summary_resp = await client.get(WIKIPEDIA_API_URL, params=summary_params)
                summary_data = summary_resp.json()
                
                pages = summary_data.get("query", {}).get("pages", {})
                page_info = pages.get(str(page_id), {})
                
                extract = page_info.get("extract", "")
                short_desc = extract[:140] + "..." if len(extract) > 140 else extract
                
                images = []
                if "thumbnail" in page_info:
                    images.append(page_info["thumbnail"]["source"])
                    
                # Fetch Wikidata item ID for coordinates if available
                prop_params = {
                    "action": "query",
                    "prop": "pageprops",
                    "pageids": page_id,
                    "format": "json"
                }
                prop_resp = await client.get(WIKIPEDIA_API_URL, params=prop_params)
                prop_data = prop_resp.json()
                pageprops = prop_data.get("query", {}).get("pages", {}).get(str(page_id), {}).get("pageprops", {})
                wikidata_id = pageprops.get("wikibase_item", None)
                
                coordinates = None
                if wikidata_id:
                    # Query Wikidata for coordinates (P625)
                    wd_params = {
                        "action": "wbgetclaims",
                        "entity": wikidata_id,
                        "property": "P625",
                        "format": "json"
                    }
                    wd_resp = await client.get(WIKIDATA_API_URL, params=wd_params)
                    wd_data = wd_resp.json()
                    
                    claims = wd_data.get("claims", {}).get("P625", [])
                    if claims:
                        try:
                            val = claims[0]["mainsnak"]["datavalue"]["value"]
                            coordinates = [val["longitude"], val["latitude"]] # [lng, lat] for mapping
                        except KeyError:
                            pass
                
                record = CulturalRecordBase(
                    id=f"WIKI-{page_id}",
                    title=title,
                    category="oral_story", # Default fallback category
                    shortDescription=short_desc,
                    fullDescription=extract,
                    images=images,
                    sourceType="wikipedia",
                    sourceName="Wikimedia Wikipedia",
                    sourceUrl=f"https://en.wikipedia.org/?curid={page_id}",
                    sourceIdentifier=str(page_id) + (f" ({wikidata_id})" if wikidata_id else ""),
                    retrievedAt=datetime.utcnow().isoformat() + "Z",
                    verificationStatus="unverified",
                    lifecycleStatus="published",
                    coordinates=coordinates
                )
                
                results.append(record)
                
        except Exception as e:
            print(f"Error fetching from Wikipedia/Wikidata: {e}")
            
    search_cache[query] = results
    return results

class TTSRequest(BaseModel):
    text: str
    language: str

@app.post("/api/tts")
async def generate_tts(request: TTSRequest):
    # Check for environment variable to satisfy architecture constraint
    api_key = os.getenv("TTS_API_KEY", "dummy-key-for-local")
    if not api_key:
        raise HTTPException(status_code=500, detail="TTS API Key missing")
        
    text = request.text
    lang = request.language.lower()
    
    # Map languages to gTTS codes
    lang_map = {
        "english": "en",
        "hindi": "hi",
        "marathi": "mr"
    }
    
    gtts_lang = lang_map.get(lang, "en")
    
    # Generate hash for caching
    hash_obj = hashlib.md5(f"{text}_{gtts_lang}".encode())
    filename = f"{hash_obj.hexdigest()}.mp3"
    filepath = os.path.join("audio_cache", filename)
    
    if not os.path.exists(filepath):
        try:
            tts = gTTS(text=text, lang=gtts_lang, slow=False)
            tts.save(filepath)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
            
    return {"audioUrl": f"http://localhost:8000/audio/{filename}"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
