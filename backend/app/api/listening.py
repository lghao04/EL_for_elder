# app/api/listening.py
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from app.db import get_db
from app.services.listening_service import (
    get_all_listening,
    get_listening_by_id,
    generate_questions_with_options,
)
import requests

router = APIRouter(prefix="/listen", tags=["Listening ESL"])

ESL_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.esl-lab.com/"
}


@router.get("/audio-proxy")
def proxy_audio(url: str = Query(..., description="Audio URL từ CDN ESL Lab")):
    """
    Proxy fetch audio từ CDN ESL Lab về browser.
    Dùng khi CDN block direct request từ frontend.
    """
    if not url.startswith("https://esllab.b-cdn.net/"):
        raise HTTPException(status_code=400, detail="URL không hợp lệ")

    try:
        resp = requests.get(url, headers=ESL_HEADERS, timeout=30, stream=True)
        resp.raise_for_status()
    except requests.exceptions.Timeout:
        raise HTTPException(status_code=504, detail="Audio source timed out")
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))

    return StreamingResponse(
        resp.iter_content(chunk_size=8192),
        media_type="audio/mpeg",
        headers={"Accept-Ranges": "bytes"}
    )


@router.get("/")
def list_listening(
    level: str = Query(None, description="easy | intermediate | difficult"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db=Depends(get_db),
):
    items = get_all_listening(db, level=level, skip=skip, limit=limit)
    return {"total": len(items), "data": items}


@router.get("/{listening_id}")
def get_listening(listening_id: str, db=Depends(get_db)):
    item = get_listening_by_id(db, listening_id)
    if not item:
        raise HTTPException(status_code=404, detail="Listening not found")
    return item


@router.post("/{listening_id}/generate-questions")
async def generate_questions(
    listening_id: str,
    force_regenerate: bool = Query(False, description="Regenerate dù đã có cache"),
    db=Depends(get_db),
):
    """
    Generate multiple-choice questions cho một listening item.
    - Lần đầu: gọi LLM → lưu vào DB → trả về.
    - Lần sau: lấy cache từ DB (trừ khi force_regenerate=true).
    """
    result = await generate_questions_with_options(
        db=db,
        listening_id=listening_id,
        force_regenerate=force_regenerate,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Listening not found")

    return result