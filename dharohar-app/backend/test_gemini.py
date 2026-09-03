import os
import base64
import httpx
import asyncio

async def test():
    from dotenv import load_dotenv
    load_dotenv(os.path.join(r"C:\Users\Adwait\OneDrive\Desktop\sih2026\dharohar-app\.env"))
    api_key = os.getenv("GEMINI_API_KEY")

    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key={api_key}"
    
    # 1x1 black pixel base64
    base64_img = "R0lGODlhAQABAIAAAAUEBAAAACwAAAAAAQABAAACAkQBADs="
    mime_type = "image/gif"
    
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": "test"},
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

    async with httpx.AsyncClient(timeout=30.0) as client:
        gemini_res = await client.post(gemini_url, json=payload)
        
    print(gemini_res.status_code)
    print(gemini_res.text)

if __name__ == "__main__":
    asyncio.run(test())
