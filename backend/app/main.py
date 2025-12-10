# backend/app/main.py
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from pathlib import Path
import os
from bson import ObjectId

from app.db import  db
from app.api import voice_chat, stt


# Load environment variables
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# Verify API keys
groq_key = os.getenv("GROQ_API_KEY")
deepgram_key = os.getenv("DEEPGRAM_API_KEY")

if not groq_key:
    print("⚠️ WARNING: GROQ_API_KEY not found")
if not deepgram_key:
    print("⚠️ WARNING: DEEPGRAM_API_KEY not found")

# FastAPI app
app = FastAPI(
    title="Voice Chat AI",
    description="AI Voice Chat with Deepgram STT and Groq LLM",
    version="1.0.0"
)

# CORS
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

# Static files
APP_DIR = Path(__file__).resolve().parent
app.mount(
    "/temp_tts",
    StaticFiles(directory=str(APP_DIR / "temp_tts")),
    name="temp_tts",
)

# Include routers
app.include_router(voice_chat.router, prefix="/api", tags=["Voice Chat"])
app.include_router(stt.router, prefix="/api", tags=["Speech-to-Text"])

# Root endpoint
@app.get("/")
def root():
    return {
        "message": "Voice Chat AI with Groq",
        "endpoints": {
            "voice_chat": "/api/voice-chat",
            "stt": "/api/speech-to-text",
        }
    }


@app.on_event("startup")
async def startup_event():
    print("🚀 Starting up...")
    # await connect_to_mongo()
    
    # Initialize Groq LLM client
    from app.services import llm_service
    await llm_service.init_client()
    
    print("✅ All services initialized")

@app.on_event("shutdown")
async def shutdown_event():
    print("🛑 Shutting down...")
    # await close_mongo()
    
    # Close Groq client
    from app.services import llm_service
    await llm_service.close_client()
    
    print("✅ Cleanup complete")
# Dependency
async def get_db():
    return db

