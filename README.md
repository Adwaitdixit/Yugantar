<div align="center">
  <img src="./dharohar-app/public/vite.svg" alt="Dharohar Setu Logo" width="100"/>
  <h1>Dharohar Setu</h1>
  <h3>The Living Cultural Atlas of India</h3>
  <p><strong>Smart India Hackathon (SIH) 2026 Submission</strong></p>
  
  [![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
  [![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
  [![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com/)
  [![Gemini AI](https://img.shields.io/badge/Google%20Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://deepmind.google/technologies/gemini/)
</div>

<br />

## 🌟 The Vision
**Dharohar Setu** (Bridge of Heritage) is a premium digital platform designed to preserve, structure, and democratize India's intangible and tangible cultural heritage. 

It transforms raw, unstructured community knowledge (oral stories, traditions, folklore, and local practices) into highly structured, traceable, and archivable digital records using a state-of-the-art AI pipeline—all while maintaining strict ethical boundaries regarding historical authenticity and human verification.

---

## 🚀 Key Features

### 1. 🧠 7-Stage AI Heritage Intelligence Pipeline
Our flagship AI pipeline processes raw community contributions through seven distinct stages, providing complete transparency to users and institutional reviewers:
1. **Language & Dialect Detection**: Automatically detects local Indian languages.
2. **Cultural Category & Classification**: Tags records (e.g., *oral_story, craft_weave, heritage_site*).
3. **Information Extraction**: Summarizes and normalizes the narrative.
4. **Entity & Practice Extraction**: Identifies key cultural practices and historical entities.
5. **Atomic Claim Extraction**: Breaks down folklore into verifiable atomic claims.
6. **Provenance & Verification**: Assesses the evidence required to authenticate claims.
7. **Structured Cultural Record**: Outputs a clean, exportable JSON schema ready for institutional archiving.

### 2. 🎧 Listen to Heritage (Multilingual TTS)
A native accessibility feature that brings heritage to life:
- **AI-Assisted Narration**: Gemini dynamically generates a 60–120 second factual, objective narration script based strictly on the verified cultural record.
- **Multilingual Support**: Text-to-Speech (TTS) natively voices the heritage in English, Hindi, or Marathi.
- **Community Voice Preservation**: Original audio recordings submitted by the community are preserved and presented alongside the AI narration in a distinctly separated UI, ensuring the original human voice is never overwritten.

### 3. 🛡️ Ethical AI Governance
Dharohar Setu enforces a strict distinction between AI processing and human truth-telling:
- **Transparent Provenance**: Every AI-generated claim is tagged with its source.
- **No Hallucinations**: AI is restricted to structuring documented claims. It explicitly states that it *does not independently authenticate historical truth*.
- **Role-Based Verification**: Only verified human experts and community leaders can approve records.

### 4. 🗺️ Interactive Cultural Map
An immersive, interactive map allowing users to explore cultural records geographically across India's states and districts.

---

## 🛠️ Technology Stack

**Frontend:**
- **React.js (Vite)** with TypeScript
- **CSS3** (Custom Glassmorphism, Dark Premium Theme)
- **Lucide React** (Iconography)

**Backend:**
- **FastAPI** (Python 3) for robust API handling
- **gTTS** (Google Text-to-Speech) for on-the-fly audio generation
- **Local Disk Caching** (MD5 Hash) for optimal audio delivery performance

**AI & Cloud:**
- **Google Gemini 1.5 Flash API**: Powers the heavy lifting of the 7-stage cultural extraction and script generation.
- **DetectLanguage API**: Multilingual support for Indic dialects.
- **Supabase**: PostgreSQL database, authentication, and secure storage.

---

## ⚙️ How to Run Locally

### Prerequisites
- Node.js (v18+)
- Python 3.9+
- A Google Gemini API Key

### 1. Setup the Backend (FastAPI)
```bash
cd dharohar-app/backend
# Create and activate a virtual environment
python -m venv venv
# Windows:
.\venv\Scripts\Activate.ps1
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install fastapi uvicorn gtts

# Run the backend server
python main.py
```
*The backend will run on `http://localhost:8000` and serve audio files statically.*

### 2. Setup the Frontend (Vite + React)
```bash
cd dharohar-app
# Install dependencies
npm install

# Create a .env file and add your Gemini API Key
echo "VITE_GEMINI_API_KEY=your_api_key_here" > .env

# Run the development server
npm run dev
```
*The frontend will run on `http://localhost:5173`.*

---

## 🎨 Design Philosophy
The application leverages a highly impressive **dark premium aesthetic**. We utilized custom CSS to create deep gradients (turmeric, terracotta, and sage accents), sleek glassmorphism panels, and micro-animations to ensure the user experience feels like a modern, interactive museum exhibit.

---

<div align="center">
  <p>Built with ❤️ for <b>Smart India Hackathon 2026</b></p>
</div>