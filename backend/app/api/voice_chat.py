# app/api/voice_chat.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from fastapi.responses import JSONResponse
import asyncio
from typing import Optional
from app.services.tts_service import text_to_speech
from app.services.llm_service import chat_with_messages_async  
from app.services.conversation_service import conv_store


router = APIRouter()

class VoiceChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    language: Optional[str] = Field("en")
    session_id: Optional[str] = None

LLM_TIMEOUT = 30
TTS_TIMEOUT = 25

from fastapi.responses import Response
import base64

@router.post("/voice-chat")
async def voice_chat(req: VoiceChatRequest):
    session_id = req.session_id
    if not session_id or conv_store.get_messages(session_id) is None:
        session_id = conv_store.create_session()
    conv_store.append_user_message(session_id, req.message)

    messages = conv_store.get_messages(session_id)
    if not messages:
        raise HTTPException(status_code=500, detail="Conversation history unavailable")

    try:
        assistant_text = await asyncio.wait_for(
            chat_with_messages_async(messages),
            timeout=LLM_TIMEOUT
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail=f"LLM timeout after {LLM_TIMEOUT}s")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM error: {str(e)}")

    if not assistant_text or not str(assistant_text).strip():
        raise HTTPException(status_code=502, detail="LLM returned empty response")

    conv_store.append_assistant_message(session_id, assistant_text)

    try:
        # tts_service giờ trả về bytes thay vì file path
        audio_bytes = await asyncio.wait_for(
            asyncio.to_thread(text_to_speech, assistant_text, req.language or "en"),
            timeout=TTS_TIMEOUT
        )
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail=f"TTS timeout after {TTS_TIMEOUT}s")
    except Exception as e:
        raise HTTPException(status_code=500, detail="TTS error")

    if not audio_bytes:
        raise HTTPException(status_code=502, detail="TTS failed to generate audio")

    # Trả audio bytes trực tiếp, đính kèm text và session_id vào header
    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "X-AI-Text": assistant_text,
            "X-Session-Id": session_id,
            "Access-Control-Expose-Headers": "X-AI-Text, X-Session-Id"
        }
    )