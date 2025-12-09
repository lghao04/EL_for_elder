# app/api/stt.py
import os
import tempfile
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from app.services.stt_service import DeepgramSTTService

router = APIRouter()

@router.post("/speech-to-text")
async def speech_to_text(
    audio: UploadFile = File(...),
    language: str = Form("en")
):
    """
    Speech-to-Text endpoint (Batch mode)
    
    - Client upload audio file (WAV, MP3, WebM, etc.)
    - Server transcribe với Deepgram
    - Return text
    
    Args:
        audio: Audio file (any format Deepgram supports)
        language: Language code (en, vi, es, fr, etc.)
        
    Returns:
        {
            "success": true,
            "text": "transcribed text",
            "confidence": 0.95,
            "language": "en"
        }
    """
    # Validate file type
    if not audio.content_type or not audio.content_type.startswith("audio/"):
        raise HTTPException(
            status_code=400, 
            detail="File must be audio format"
        )
    
    # Validate file size (max 25MB)
    audio.file.seek(0, 2)  # Seek to end
    file_size = audio.file.tell()
    audio.file.seek(0)  # Reset
    
    if file_size > 25 * 1024 * 1024:  # 25MB
        raise HTTPException(
            status_code=400,
            detail="File too large (max 25MB)"
        )
    
    temp_path = None
    
    try:
        # Save to temp file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as f:
            content = await audio.read()
            f.write(content)
            temp_path = f.name
        
        # Transcribe
        stt_service = DeepgramSTTService()
        result = stt_service.transcribe_file(temp_path, language)
        
        return JSONResponse(content={
            "success": True,
            "text": result["text"],
            "confidence": result["confidence"],
            "language": result["language"]
        })
    
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))
    
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error: {str(e)}"
        )
    
    finally:
        # Cleanup temp file
        if temp_path and os.path.exists(temp_path):
            try:
                os.unlink(temp_path)
            except Exception as e:
                print(f"⚠️  Failed to delete temp file: {e}")


@router.get("/supported-languages")
async def get_supported_languages():
    """Get list of supported languages"""
    return JSONResponse(content={
        "languages": [
            {"code": "en", "name": "English"},
            {"code": "vi", "name": "Vietnamese"},
            {"code": "es", "name": "Spanish"},
            {"code": "fr", "name": "French"},
            {"code": "de", "name": "German"},
            {"code": "ja", "name": "Japanese"},
            {"code": "ko", "name": "Korean"},
            {"code": "zh", "name": "Chinese"},
            {"code": "pt", "name": "Portuguese"},
            {"code": "ru", "name": "Russian"},
        ]
    })