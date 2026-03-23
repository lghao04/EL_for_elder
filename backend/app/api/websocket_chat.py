# app/api/websocket_chat.py
"""
WebSocket endpoint cho realtime voice chat
Tích hợp với existing services: Groq LLM, Deepgram STT, và TTS
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json
import base64
import asyncio
from datetime import datetime
import uuid
import logging
from typing import Dict, Optional
from io import BytesIO

# Import existing services
from app.services.stt_service import DeepgramSTTService
from app.services.llm_service import chat_with_messages_async
from app.services.tts_service import text_to_speech
from app.services.conversation_service import conv_store
import tempfile
import os

router = APIRouter()
logger = logging.getLogger(__name__)

# Connection manager
active_connections: Dict[str, WebSocket] = {}

@router.websocket("/ws/chat/{user_id}")
async def websocket_chat(websocket: WebSocket, user_id: str):
    """
    WebSocket endpoint cho realtime voice chat
    Hoạt động song song với /api/voice-chat endpoint
    """
    connection_id = str(uuid.uuid4())
    audio_buffer = bytearray()
    session_id = None  # Conversation session
    
    await websocket.accept()
    active_connections[connection_id] = websocket
    
    logger.info(f"✅ WebSocket connected: {connection_id} (user: {user_id})")
    
    try:
        # Send connection confirmation
        await websocket.send_json({
            "type": "connected",
            "connection_id": connection_id,
            "message": "Connected to WebSocket server",
            "user_id": user_id
        })
        
        while True:
            # Receive message
            data = await websocket.receive_text()
            message = json.loads(data)
            msg_type = message.get("type")
            
            logger.info(f"📨 Received: {msg_type} from {connection_id}")
            
            # ===== TEXT MESSAGE =====
            if msg_type == "text":
                content = message.get("content", "").strip()
                language = message.get("language", "en")
                
                if not content:
                    continue
                
                try:
                    # Ensure session exists
                    if not session_id or conv_store.get_messages(session_id) is None:
                        session_id = conv_store.create_session()
                        logger.info(f"Created new session: {session_id}")
                    
                    # Add user message to conversation
                    conv_store.append_user_message(session_id, content)
                    
                    # Send typing indicator
                    await websocket.send_json({
                        "type": "llm_response_start",
                        "message": "AI is thinking..."
                    })
                    
                    # Get conversation history
                    messages = conv_store.get_messages(session_id)
                    
                    # Call Groq LLM (existing service)
                    logger.info("Calling Groq LLM...")
                    assistant_text = await asyncio.wait_for(
                        chat_with_messages_async(messages),
                        timeout=30
                    )
                    
                    if not assistant_text or not str(assistant_text).strip():
                        raise Exception("LLM returned empty response")
                    
                    logger.info(f"LLM response: {assistant_text[:100]}...")
                    
                    # Save assistant message
                    conv_store.append_assistant_message(session_id, assistant_text)
                    
                    # Send text response
                    await websocket.send_json({
                        "type": "message",
                        "role": "assistant",
                        "content": assistant_text,
                        "timestamp": datetime.now().isoformat(),
                        "session_id": session_id
                    })
                    
                    # Generate TTS audio (existing service)
                    logger.info("Generating TTS audio...")
                    tts_task = asyncio.to_thread(
                        text_to_speech, 
                        assistant_text, 
                        language
                    )
                    audio_url = await asyncio.wait_for(tts_task, timeout=25)
                    
                    if audio_url:
                        logger.info(f"TTS audio ready: {audio_url}")
                        
                        # Send audio URL
                        await websocket.send_json({
                            "type": "audio_url",
                            "url": audio_url
                        })
                    else:
                        logger.warning("TTS returned no audio URL")
                
                except asyncio.TimeoutError:
                    logger.error("LLM or TTS timeout")
                    await websocket.send_json({
                        "type": "error",
                        "message": "Response timeout. Please try again."
                    })
                
                except Exception as e:
                    logger.error(f"Text message error: {e}")
                    import traceback
                    traceback.print_exc()
                    
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Error processing message: {str(e)}"
                    })
            
            # ===== AUDIO START =====
            elif msg_type == "audio_start":
                audio_buffer.clear()
                audio_format = message.get("format", "webm")
                language = message.get("language", "en")
                
                logger.info(f"🎙️ Audio recording started (format: {audio_format}, lang: {language})")
                
                # Ensure session exists
                if not session_id or conv_store.get_messages(session_id) is None:
                    session_id = conv_store.create_session()
                    logger.info(f"Created new session: {session_id}")
                
                await websocket.send_json({
                    "type": "audio_started",
                    "message": "Ready to receive audio",
                    "session_id": session_id
                })
            
            # ===== AUDIO CHUNK =====
            elif msg_type == "audio_chunk":
                chunk_data = message.get("data", "")
                
                try:
                    audio_bytes = base64.b64decode(chunk_data)
                    audio_buffer.extend(audio_bytes)
                    
                    # Send progress every ~100KB
                    if len(audio_buffer) % (100 * 1024) < 50000:
                        await websocket.send_json({
                            "type": "audio_progress",
                            "bytes_received": len(audio_buffer),
                            "kb_received": round(len(audio_buffer) / 1024, 1)
                        })
                
                except Exception as e:
                    logger.error(f"Audio chunk error: {e}")
                    await websocket.send_json({
                        "type": "error",
                        "message": "Invalid audio chunk"
                    })
            
            # ===== AUDIO END =====
            elif msg_type == "audio_end":
                if len(audio_buffer) == 0:
                    await websocket.send_json({
                        "type": "error",
                        "message": "No audio data received"
                    })
                    continue
                
                language = message.get("language", "en")
                
                logger.info(f"🎤 Audio complete: {len(audio_buffer)} bytes ({len(audio_buffer)/1024:.1f} KB)")
                
                # Send transcribing status
                await websocket.send_json({
                    "type": "transcribing",
                    "message": "Converting speech to text...",
                    "audio_size_kb": round(len(audio_buffer) / 1024, 1)
                })
                
                temp_path = None
                
                try:
                    # ===== CALL EXISTING STT SERVICE (Deepgram) =====
                    logger.info("Calling Deepgram STT...")
                    
                    # Save audio buffer to temp file (same as stt.py)
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as f:
                        f.write(bytes(audio_buffer))
                        temp_path = f.name
                    
                    logger.info(f"Saved audio to temp file: {temp_path}")
                    
                    # Call existing DeepgramSTTService (same as stt.py)
                    stt_service = DeepgramSTTService()
                    stt_task = asyncio.to_thread(
                        stt_service.transcribe_file,
                        temp_path,
                        language
                    )
                    result = await asyncio.wait_for(stt_task, timeout=15)
                    
                    transcript = result.get("text", "")
                    confidence = result.get("confidence", 0)
                    
                    logger.info(f"STT result: {transcript} (confidence: {confidence})")
                    
                    if not transcript or not transcript.strip():
                        logger.warning("Empty transcript from STT")
                        await websocket.send_json({
                            "type": "error",
                            "message": "No speech detected. Please try again."
                        })
                        audio_buffer.clear()
                        continue
                    
                    # Send transcript
                    await websocket.send_json({
                        "type": "transcript_complete",
                        "text": transcript,
                        "confidence": confidence,
                        "language": result.get("language", language),
                        "timestamp": datetime.now().isoformat()
                    })
                    
                    # Add transcript to conversation
                    conv_store.append_user_message(session_id, transcript)
                    
                    # Send user message (from audio)
                    await websocket.send_json({
                        "type": "message",
                        "role": "user",
                        "content": transcript,
                        "source": "audio",
                        "timestamp": datetime.now().isoformat()
                    })
                    
                    # ===== CALL EXISTING LLM SERVICE (Groq) =====
                    logger.info("Calling Groq LLM...")
                    
                    await websocket.send_json({
                        "type": "llm_response_start",
                        "message": "AI is thinking..."
                    })
                    
                    messages = conv_store.get_messages(session_id)
                    
                    llm_task = chat_with_messages_async(messages)
                    assistant_text = await asyncio.wait_for(llm_task, timeout=30)
                    
                    if not assistant_text or not str(assistant_text).strip():
                        raise Exception("LLM returned empty response")
                    
                    logger.info(f"LLM response: {assistant_text[:100]}...")
                    
                    # Save assistant message
                    conv_store.append_assistant_message(session_id, assistant_text)
                    
                    # Send LLM response
                    await websocket.send_json({
                        "type": "message",
                        "role": "assistant",
                        "content": assistant_text,
                        "timestamp": datetime.now().isoformat()
                    })
                    
                    # ===== CALL EXISTING TTS SERVICE =====
                    logger.info("Generating TTS audio...")
                    
                    tts_task = asyncio.to_thread(
                        text_to_speech,
                        assistant_text,
                        language
                    )
                    audio_url = await asyncio.wait_for(tts_task, timeout=25)
                    
                    if audio_url:
                        logger.info(f"TTS audio ready: {audio_url}")
                        
                        # Send audio URL
                        await websocket.send_json({
                            "type": "audio_url",
                            "url": audio_url
                        })
                    else:
                        logger.warning("TTS returned no audio URL")
                
                except asyncio.TimeoutError:
                    logger.error("STT, LLM, or TTS timeout")
                    await websocket.send_json({
                        "type": "error",
                        "message": "Processing timeout. Please try again."
                    })
                
                except Exception as e:
                    logger.error(f"Audio processing error: {e}")
                    import traceback
                    traceback.print_exc()
                    
                    await websocket.send_json({
                        "type": "error",
                        "message": f"Error processing audio: {str(e)}"
                    })
                
                finally:
                    # Cleanup temp file
                    if temp_path and os.path.exists(temp_path):
                        try:
                            os.unlink(temp_path)
                            logger.info(f"Cleaned up temp file: {temp_path}")
                        except Exception as e:
                            logger.warning(f"Failed to delete temp file: {e}")
                    
                    audio_buffer.clear()
            
            # ===== UNKNOWN MESSAGE TYPE =====
            else:
                logger.warning(f"Unknown message type: {msg_type}")
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {msg_type}"
                })
    
    except WebSocketDisconnect:
        logger.info(f"Client {connection_id} disconnected normally")
        if connection_id in active_connections:
            del active_connections[connection_id]
    
    except Exception as e:
        logger.error(f"WebSocket error for {connection_id}: {e}")
        import traceback
        traceback.print_exc()
        
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass
        finally:
            if connection_id in active_connections:
                del active_connections[connection_id]


@router.get("/ws/health")
async def websocket_health():
    """Health check for WebSocket"""
    return {
        "status": "healthy",
        "websocket_active": True,
        "active_connections": len(active_connections),
        "connections": list(active_connections.keys())
    }