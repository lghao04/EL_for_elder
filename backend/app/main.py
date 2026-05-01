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
    "https://zero-to-one-livid.vercel.app"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


from app.api.auth_api import router as auth_router
from app.api.voice_chat import router as voice_router
from app.api.stt import router as stt_router
from app.api.lesson import router as lessons_router
from app.api.progress import router as progress_router
from app.api.websocket_chat import router as ws_router
from app.api import writing
from app.api import listening
from app.api import feedback                                    # ← NEW


app.include_router(auth_router,     prefix="/api", tags=["Authentication"])
app.include_router(lessons_router,  prefix="/api", tags=["Lessons"])
app.include_router(progress_router, prefix="/api", tags=["Progress"])
app.include_router(voice_router,    prefix="/api", tags=["Voice Chat"])
app.include_router(stt_router,      prefix="/api", tags=["Speech-to-Text"])
app.include_router(ws_router,                      tags=["WebSocket"])
app.include_router(writing.router,  prefix="/api", tags=["Writing"])
app.include_router(listening.router,prefix="/api", tags=["Listening"])
app.include_router(feedback.router, prefix="/api", tags=["Writing Feedback"])  # ← NEW


@app.get("/")
def root():
    return {
        "message": "EL for Elder - Voice Chat AI",
        "version": "1.0.0",
        "endpoints": {
            "auth": {
                "register": "/api/auth/register",
                "login":    "/api/auth/login",
                "me":       "/api/auth/me",
            },
            "lessons": {
                "get_lesson":    "/api/lessons/{lesson_id}?use_short=true",
                "list_lessons":  "/api/lessons?limit=50",
                "get_story":     "/api/lessons/{lesson_id}/story",
                "get_questions": "/api/lessons/{lesson_id}/questions",
            },
            "progress": {
                "record_completion": "/api/progress/complete",
                "get_all_progress":  "/api/progress/all",
                "get_stats":         "/api/progress/stats",
                "leaderboard":       "/api/progress/leaderboard",
            },
            "voice_chat": "/api/voice-chat",
            "stt":        "/api/speech-to-text",
            "websocket": {
                "chat":   "/ws/chat/{user_id}",
                "health": "/ws/health",
            },
            "writing": {
                "list":         "/api/writing/questions?skip=0&limit=20",
                "random":       "/api/writing/questions/random",
                "by_id":        "/api/writing/questions/{question_id}",
                "topics":       "/api/writing/topics",
                "topic_search": "/api/writing/topics/search?q=<keyword>",
                "stats":        "/api/writing/stats",
            },
            "writing_feedback": {                              # ← NEW
                "grade": "/api/writing/feedback/grade",
            },
            "listening": {
                "list":   "/api/listening/exercises",
                "random": "/api/listening/exercises/random",
                "by_id":  "/api/listening/exercises/{exercise_id}",
                "stats":  "/api/listening/stats",
            },
        },
    }


@app.on_event("startup")
async def startup_event():
    print("Starting up...")

    # Connect MongoDB
    try:
        init_db()
        db = get_db()

        lessons_with_short = db["lessons"].count_documents({"short_story": {"$exists": True}})
        total_lessons       = db["lessons"].count_documents({})
        total_writing       = db["topicwriting"].count_documents({})
        classified_writing  = db["topicwriting"].count_documents({"topic": {"$exists": True}})

        print(f"MongoDB connected")
        print(f"  Total lessons:            {total_lessons}")
        print(f"  Lessons with short_story: {lessons_with_short}")
        print(f"  Writing questions:        {total_writing}")
        print(f"  Writing classified:       {classified_writing}")

        if lessons_with_short == 0:
            print("     No short stories found! Run: python summarize_lessons_simple.py")
        if total_writing == 0:
            print("     No writing questions! Run: python import_quora.py")
        elif classified_writing < total_writing:
            print(f"     {total_writing - classified_writing} questions not classified! Run: python classify_topics.py")

    except Exception as e:
        print(" init_db raised:", e)

    # Initialize Groq LLM
    try:
        from app.services import llm_service
        await llm_service.init_client()
        print(" Groq LLM initialized")
    except Exception as e:
        print(" Groq LLM init failed:", e)

    print(" All services initialized")
    print("\n" + "=" * 70)
    print(" API Endpoints:")
    print("   Authentication:")
    print("      POST   /api/auth/register")
    print("      POST   /api/auth/login")
    print("      GET    /api/auth/me (protected)")
    print("\n   Lessons:")
    print("      GET    /api/lessons/{id}?use_short=true (default)")
    print("      GET    /api/lessons/{id}/story")
    print("      GET    /api/lessons/{id}/questions")
    print("      GET    /api/lessons?limit=50")
    print("\n   Voice & TTS:")
    print("      POST   /api/voice-chat")
    print("      POST   /api/speech-to-text")
    print("\n   WebSocket (Realtime):")
    print("      WS     /ws/chat/{user_id}")
    print("      GET    /ws/health")
    print("\n   Writing:")
    print("      GET    /api/writing/questions")
    print("      GET    /api/writing/questions/random")
    print("      GET    /api/writing/questions/{id}")
    print("      GET    /api/writing/topics")
    print("      GET    /api/writing/topics/search?q=<keyword>")
    print("      GET    /api/writing/stats")
    print("\n   Writing Feedback (AI):")                       # ← NEW
    print("      POST   /api/writing/feedback/grade")         # ← NEW
    print("\n   Listening:")
    print("      GET    /api/listening/exercises")
    print("      GET    /api/listening/exercises/random")
    print("      GET    /api/listening/exercises/{id}")
    print("      GET    /api/listening/stats")
    print("=" * 70 + "\n")


@app.on_event("shutdown")
async def shutdown_event():
    print(" Shutting down...")

    try:
        close_db()
    except Exception as e:
        print(" close_db raised:", e)

    try:
        from app.services import llm_service
        await llm_service.close_client()
    except Exception as e:
        print(" Groq client close failed:", e)

    print(" Cleanup complete")