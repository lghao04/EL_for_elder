# backend/app/main.py
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from pathlib import Path
import os
from bson import ObjectId

from app.db import init_db, close_db, get_db
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

groq_key = os.getenv("GROQ_API_KEY")
deepgram_key = os.getenv("DEEPGRAM_API_KEY")


app = FastAPI(
    title="EL for Elder - Voice Chat AI",
    description="AI Voice Chat with Authentication, Deepgram STT and Groq LLM",
    version="1.0.0"
)


origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

APP_DIR = Path(__file__).resolve().parent
TEMP_TTS_DIR = APP_DIR / "temp_tts"
TEMP_TTS_DIR.mkdir(exist_ok=True)

app.mount(
    "/temp_tts",
    StaticFiles(directory=str(TEMP_TTS_DIR)),
    name="temp_tts",
)

# Include routers
from app.api.auth_api import router as auth_router  # ✅ NEW: Auth router
from app.api.voice_chat import router as voice_router
from app.api.stt import router as stt_router
from app.api.lesson import router as lessons_router

# ✅ Auth routes FIRST (for login/register at root)
app.include_router(auth_router, prefix="/api", tags=["Authentication"])
app.include_router(lessons_router, prefix="/api", tags=["Lessons"])
app.include_router(voice_router, prefix="/api", tags=["Voice Chat"])
app.include_router(stt_router, prefix="/api", tags=["Speech-to-Text"])

# Root endpoint
@app.get("/")
def root():
    return {
        "message": "EL for Elder - Voice Chat AI",
        "version": "1.0.0",
        "endpoints": {
            "auth": {
                "register": "/api/auth/register",
                "login": "/api/auth/login",
                "me": "/api/auth/me",
            },
            "lessons": "/api/lessons/{lesson_id}",
            "voice_chat": "/api/voice-chat",
            "stt": "/api/speech-to-text",
        }
    }


@app.on_event("startup")
async def startup_event():
    print("🚀 Starting up...")
    

    TEMP_TTS_DIR.mkdir(exist_ok=True)
    print(f"✅ Created temp_tts directory: {TEMP_TTS_DIR}")
    
    #kết nối MongoDB
    try:
        init_db()
        print("✅ MongoDB connected")
    except Exception as e:
        print("❌ init_db raised:", e)

    try:
        from app.services import llm_service
        await llm_service.init_client()
        print("✅ Groq LLM initialized")
    except Exception as e:
        print("⚠️ Groq LLM init failed:", e)
    
    print("✅ All services initialized")
    print("\n" + "="*70)
    print("📝 API Endpoints:")
    print("   POST   /api/auth/register")
    print("   POST   /api/auth/login")
    print("   GET    /api/auth/me (protected)")
    print("   GET    /api/lessons/{lesson_id}")
    print("   POST   /api/voice-chat")
    print("   POST   /api/speech-to-text")
    print("="*70 + "\n")


@app.on_event("shutdown")
async def shutdown_event():
    print("🛑 Shutting down...")
    
    # Đóng kết nối MongoDB
    try:
        close_db()
    except Exception as e:
        print("❌ close_db raised:", e)

    try:
        from app.services import llm_service
        await llm_service.close_client()
    except Exception as e:
        print("⚠️ Groq client close failed:", e)
    
    print("✅ Cleanup complete")