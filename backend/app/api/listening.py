# app/api/listening.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from app.db import get_db
from app.services.listening_service import ListeningService
import requests
import io
import soundfile as sf

router = APIRouter()


@router.get("/listening")
def list_listening_exercises(skip: int = 0, limit: int = 20, db=Depends(get_db)):
    collection = db["librispeech"]
    service = ListeningService(collection)
    exercises = service.get_all_exercises(skip=skip, limit=limit)
    return {"exercises": exercises, "count": len(exercises)}


@router.get("/listening/audio-proxy")
def proxy_audio(url: str):
    """
    Fetch FLAC từ HuggingFace CDN và stream về WAV.
    Giải quyết CORS + browser không support FLAC.
    """
    if not url:
        raise HTTPException(status_code=400, detail="Missing 'url' parameter")

    try:
        resp = requests.get(url, timeout=30, allow_redirects=True,
                            headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
    except requests.exceptions.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Source returned {resp.status_code}: {str(e)}")
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Audio source timed out")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    try:
        audio_data, sr = sf.read(io.BytesIO(resp.content))
        wav_buf = io.BytesIO()
        sf.write(wav_buf, audio_data, sr, format="WAV", subtype="PCM_16")
        wav_buf.seek(0)
        return StreamingResponse(wav_buf, media_type="audio/wav",
                                 headers={"Content-Disposition": "inline"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio conversion failed: {str(e)}")


@router.get("/listening/random")
def get_random_listening_exercise(db=Depends(get_db)):
    collection = db["librispeech"]
    service = ListeningService(collection)
    exercise = service.get_random_exercise()
    if not exercise:
        raise HTTPException(status_code=404, detail="No listening exercise found")
    return exercise


@router.get("/listening/{exercise_id}")
def get_listening_exercise(exercise_id: str, db=Depends(get_db)):
    collection = db["librispeech"]
    service = ListeningService(collection)
    exercise = service.get_exercise_full(exercise_id)
    if not exercise:
        raise HTTPException(status_code=404,
                            detail=f"Listening exercise '{exercise_id}' not found")
    return exercise