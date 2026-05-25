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
from app.api import feedback
from app.api.listening import router as listening_esl_router  # prefix="/listen" defined in router

app.include_router(auth_router,          prefix="/api", tags=["Authentication"])
app.include_router(lessons_router,       prefix="/api", tags=["Lessons"])
app.include_router(progress_router,      prefix="/api", tags=["Progress"])
app.include_router(voice_router,         prefix="/api", tags=["Voice Chat"])
app.include_router(stt_router,           prefix="/api", tags=["Speech-to-Text"])
app.include_router(ws_router,                           tags=["WebSocket"])
app.include_router(writing.router,       prefix="/api", tags=["Writing"])
app.include_router(listening_esl_router, prefix="/api", tags=["Listening ESL"])
app.include_router(feedback.router,      prefix="/api", tags=["Writing Feedback"])


@app.get("/")
def root():
    return {
        "message": "EL for Elder - Voice Chat AI",
        "version": "1.0.0",
        "endpoints": {
            "auth": {
                "register":  "POST /api/auth/register",
                "login":     "POST /api/auth/login",
                "me":        "GET  /api/auth/me",
                "protected": "GET  /api/auth/protected",
            },
            "profile": {
                "upload_image": "POST  /api/profile/upload-image",
                "update":       "PUT   /api/profile",
                "update_name":  "PATCH /api/profile/name",
                "update_image": "PATCH /api/profile/image",
            },
            "users": {
                "dashboard":  "GET /api/users/me/dashboard",
                "leaderboard":"GET /api/users/leaderboard?limit=5",
                "records":    "GET /api/users/me/records?skill=listening|reading|writing",
            },
            "lessons": {
                "list":     "GET  /api/lessons?limit=50",
                "detail":   "GET  /api/lessons/{lesson_id}",
                "story":    "GET  /api/lessons/{lesson_id}/story",
                "questions":"GET  /api/lessons/{lesson_id}/questions",
                "submit":   "POST /api/lessons/{lesson_id}/submit",
                "record":   "GET  /api/lessons/{lesson_id}/record/{user_id}",
                "history":  "GET  /api/lessons/{lesson_id}/history/{user_id}",
            },
            "progress": {
                "save":         "POST   /api/progress",
                "get_all":      "GET    /api/progress/all",
                "stats":        "GET    /api/progress/stats",
                "streak":       "GET    /api/progress/streak",
                "calendar":     "GET    /api/progress/calendar/{year}/{month}",
                "lesson":       "GET    /api/progress/lesson/{lesson_id}",
                "delete_lesson":"DELETE /api/progress/lesson/{lesson_id}",
            },
            "voice_chat": "POST /api/voice-chat",
            "stt": {
                "transcribe": "POST /api/speech-to-text",
                "languages":  "GET  /api/supported-languages",
            },
            "websocket": {
                "chat":   "/ws/chat/{user_id}",
                "health": "/ws/health",
            },
            "writing": {
                "list":         "GET /api/writing/questions?skip=0&limit=20",
                "random":       "GET /api/writing/questions/random",
                "by_id":        "GET /api/writing/questions/{question_id}",
                "topics":       "GET /api/writing/topics",
                "topic_search": "GET /api/writing/topics/search?q=<keyword>",
                "stats":        "GET /api/writing/stats",
            },
            "writing_feedback": {
                "grade": "POST /api/writing/feedback/grade",
            },
            "listening_esl": {
                "list":               "GET  /api/listen?level=easy|intermediate|difficult",
                "by_id":              "GET  /api/listen/{listening_id}",
                "generate_questions": "POST /api/listen/{listening_id}/generate-questions",
                "submit":             "POST /api/listen/{listening_id}/submit",
                "record":             "GET  /api/listen/{listening_id}/record/{user_id}",
                "history":            "GET  /api/listen/{listening_id}/history/{user_id}",
                "audio_proxy":        "GET  /api/listen/audio-proxy?url=<cdn_url>",
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
        total_listening_esl = db["datalistening"].count_documents({})

        print(f"MongoDB connected")
        print(f"  Total lessons:            {total_lessons}")
        print(f"  Lessons with short_story: {lessons_with_short}")
        print(f"  Writing questions:        {total_writing}")
        print(f"  Writing classified:       {classified_writing}")
        print(f"  Listening ESL items:      {total_listening_esl}")

        if lessons_with_short == 0:
            print("     No short stories found! Run: python summarize_lessons_simple.py")
        if total_writing == 0:
            print("     No writing questions! Run: python import_quora.py")
        elif classified_writing < total_writing:
            print(f"     {total_writing - classified_writing} questions not classified! Run: python classify_topics.py")
        if total_listening_esl == 0:
            print("     No ESL listening data found! Check datalistening collection.")

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
    print("\n   Profile:")
    print("      POST   /api/profile/upload-image")
    print("      PUT    /api/profile")
    print("      PATCH  /api/profile/name")
    print("      PATCH  /api/profile/image")
    print("\n   Users:")
    print("      GET    /api/users/me/dashboard")
    print("      GET    /api/users/leaderboard?limit=5")
    print("      GET    /api/users/me/records?skill=listening|reading|writing")
    print("\n   Lessons:")
    print("      GET    /api/lessons?limit=50")
    print("      GET    /api/lessons/{id}")
    print("      GET    /api/lessons/{id}/story")
    print("      GET    /api/lessons/{id}/questions")
    print("      POST   /api/lessons/{id}/submit")
    print("      GET    /api/lessons/{id}/record/{user_id}")
    print("      GET    /api/lessons/{id}/history/{user_id}")
    print("\n   Progress:")
    print("      POST   /api/progress")
    print("      GET    /api/progress/all")
    print("      GET    /api/progress/stats")
    print("      GET    /api/progress/streak")
    print("      GET    /api/progress/calendar/{year}/{month}")
    print("      GET    /api/progress/lesson/{lesson_id}")
    print("      DELETE /api/progress/lesson/{lesson_id}")
    print("\n   Voice & STT:")
    print("      POST   /api/voice-chat")
    print("      POST   /api/speech-to-text")
    print("      GET    /api/supported-languages")
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
    print("\n   Writing Feedback (AI):")
    print("      POST   /api/writing/feedback/grade")
    print("\n   Listening ESL (AI-powered):")
    print("      GET    /api/listen?level=easy|intermediate|difficult")
    print("      GET    /api/listen/{listening_id}")
    print("      POST   /api/listen/{listening_id}/generate-questions")
    print("      POST   /api/listen/{listening_id}/submit")
    print("      GET    /api/listen/{listening_id}/record/{user_id}")
    print("      GET    /api/listen/{listening_id}/history/{user_id}")
    print("      GET    /api/listen/audio-proxy?url=<cdn_url>")
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