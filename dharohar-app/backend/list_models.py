import os
import httpx
import asyncio

async def test():
    from dotenv import load_dotenv
    load_dotenv(os.path.join(r"C:\Users\Adwait\OneDrive\Desktop\sih2026\dharohar-app\.env"))
    api_key = os.getenv("GEMINI_API_KEY")

    gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        gemini_res = await client.get(gemini_url)
        
    print(gemini_res.status_code)
    print(gemini_res.text)

if __name__ == "__main__":
    asyncio.run(test())
