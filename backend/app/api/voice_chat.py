# app/api/voice_chat.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from fastapi.responses import JSONResponse
import asyncio
from typing import Optional
from app.services.tts_service import text_to_speech
from app.services.llm_service import chat_with_messages
from app.services.conversation_service import conv_store

router = APIRouter()

class VoiceChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    language: Optional[str] = Field("en")
    session_id: Optional[str] = None

LLM_TIMEOUT = 30  # giây
TTS_TIMEOUT = 25  # giây

@router.post("/voice-chat")
async def voice_chat(req: VoiceChatRequest):
    # Ensure session (create new if none or unknown)
    session_id = req.session_id
    if not session_id or conv_store.get_messages(session_id) is None:
        session_id = conv_store.create_session()

    # Append user message
    conv_store.append_user_message(session_id, req.message)

    # Get messages to send to LLM
    messages = conv_store.get_messages(session_id)
    if not messages:
        raise HTTPException(status_code=500, detail="Conversation history unavailable")

    # Call LLM in threadpool to avoid blocking event loop
    try:
        llm_task = asyncio.to_thread(chat_with_messages, messages)
        assistant_text = await asyncio.wait_for(llm_task, timeout=LLM_TIMEOUT)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail=f"LLM timeout after {LLM_TIMEOUT}s")
    except Exception as e:
        print("LLM error:", e)
        raise HTTPException(status_code=500, detail="LLM error")

    if not assistant_text or not str(assistant_text).strip():
        raise HTTPException(status_code=502, detail="LLM returned empty response")

    # Append assistant reply to history
    conv_store.append_assistant_message(session_id, assistant_text)

    # Generate TTS (in threadpool)
    try:
        tts_task = asyncio.to_thread(text_to_speech, assistant_text, req.language or "en")
        audio_url = await asyncio.wait_for(tts_task, timeout=TTS_TIMEOUT)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail=f"TTS timeout after {TTS_TIMEOUT}s")
    except Exception as e:
        print("TTS error:", e)
        raise HTTPException(status_code=500, detail="TTS error")

    if not audio_url:
        raise HTTPException(status_code=502, detail="TTS failed to generate audio")

    return JSONResponse(content={"session_id": session_id, "text": assistant_text, "audioUrl": audio_url})
