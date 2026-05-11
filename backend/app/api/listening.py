# app/api/listening.py
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, validator
from typing import Optional
import requests

from app.db import get_db
from app.services.listening_service import (
    get_all_listening,
    get_listening_by_id,
    generate_questions_with_options,
)
from app.services.activity_service import ActivityService

router = APIRouter(prefix="/listen", tags=["Listening ESL"])

ESL_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.esl-lab.com/"
}


# ──────────────────────────────────────────────────────────────
# REQUEST SCHEMA
# ──────────────────────────────────────────────────────────────

class SubmitListeningRequest(BaseModel):
    user_id: str = Field(..., description="ID người dùng")
    correct_answers: int = Field(..., ge=0, description="Số câu trả lời đúng")
    total_questions: int = Field(..., ge=1, description="Tổng số câu hỏi")

    @validator("correct_answers")
    def correct_must_not_exceed_total(cls, v, values):
        total = values.get("total_questions")
        if total is not None and v > total:
            raise ValueError("correct_answers không được vượt quá total_questions")
        return v


# ──────────────────────────────────────────────────────────────
# AUDIO PROXY
# ──────────────────────────────────────────────────────────────

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


# ──────────────────────────────────────────────────────────────
# LIST & DETAIL
# ──────────────────────────────────────────────────────────────

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


# ──────────────────────────────────────────────────────────────
# GENERATE QUESTIONS
# ──────────────────────────────────────────────────────────────

@router.post("/{listening_id}/generate-questions")
async def generate_questions(
    listening_id: str,
    force_regenerate: bool = Query(False, description="Regenerate dù đã có cache"),
    db=Depends(get_db),
):
    """
    Generate multiple-choice questions cho một listening item.
    - Lần đầu: gọi LLM -> lưu vào DB -> trả về.
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


# ──────────────────────────────────────────────────────────────
# SUBMIT
# ──────────────────────────────────────────────────────────────

@router.post("/{listening_id}/submit")
def submit_listening(
    listening_id: str,
    body: SubmitListeningRequest,
    db=Depends(get_db),
):
    """
    Nộp kết quả bài Listening.

    Luồng xử lý (ActivityService):
      1. ScoreService.submit_listening()
           -> Lưu attempt vào `exercise_attempts`
           -> Cập nhật `exercise_records`:
                total_attempts  (tất cả lần submit)
                counted_attempts (tối đa 3, sau đó score_locked=True)
                best_score      (điểm cao nhất trong 3 lần tính)
           -> Nếu attempt <= 3: cộng điểm vào `user_totals`
      2. Nếu correct_answers >= 1:
           -> StreakService.record_activity() -> cập nhật `learning_logs`
           -> Nếu streak_bonus=True -> ScoreService.add_streak_bonus() (+10đ)

    Response (attempt 1-3, được tính điểm):
    {
        "status": "ok",
        "skill": "listening",
        "score": {
            "normalized": 80.0,
            "raw": 8,
            "max_raw": 10,
            "details": { "correct_answers": 8, "total_questions": 10 },
            "attempt_number": 2,
            "score_counted": true,
            "message": "Điểm đã được tính. Còn 1 lần submit được tính điểm cho bài này."
        },
        "record": {
            "total_attempts": 2,
            "counted_attempts": 2,
            "max_counted_attempts": 3,
            "best_score": 80.0,
            "best_raw": 8,
            "last_score": 80.0,
            "score_locked": false,
            "first_attempt_at": "...",
            "last_attempt_at": "..."
        },
        "streak": { "counted": true, "current": 3, "is_new_day": true },
        "streak_bonus": { "awarded": false, "points": 0, "new_total": null }
    }

    Response (attempt > 3, không được tính điểm):
    {
        "status": "ok",
        "score": {
            "score_counted": false,
            "message": "Bài này đã được submit 3 lần tính điểm...",
            ...
        },
        "record": { "score_locked": true, "counted_attempts": 3, ... },
        ...
    }
    """
    # 1. Kiểm tra bài tồn tại
    item = get_listening_by_id(db, listening_id)
    if not item:
        raise HTTPException(status_code=404, detail="Listening not found")

    # 2. Xử lý qua ActivityService
    try:
        svc = ActivityService(db)
        result = svc.submit_listening(
            user_id=body.user_id,
            exercise_id=listening_id,
            correct_answers=body.correct_answers,
            total_questions=body.total_questions,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        import traceback
        traceback.print_exc() 
        raise HTTPException(status_code=500, detail="Lỗi xử lý điểm, vui lòng thử lại")

    return result


# ──────────────────────────────────────────────────────────────
# RECORD & HISTORY
# ──────────────────────────────────────────────────────────────

@router.get("/{listening_id}/record/{user_id}")
def get_exercise_record(
    listening_id: str,
    user_id: str,
    db=Depends(get_db),
):
    """
    Tổng hợp kết quả của user với bài này.

    Response:
    {
        "exercise_id": "ex_listen_01",
        "skill": "listening",
        "total_attempts": 4,
        "counted_attempts": 3,
        "max_counted_attempts": 3,
        "best_score": 90.0,
        "best_raw": 9,
        "last_score": 75.0,
        "score_locked": true,        <- true sau khi hết 3 lần tính điểm
        "first_attempt_at": "...",
        "last_attempt_at": "..."
    }
    """
    item = get_listening_by_id(db, listening_id)
    if not item:
        raise HTTPException(status_code=404, detail="Listening not found")

    svc = ActivityService(db)
    record = svc.get_exercise_record(user_id, listening_id, "listening")

    # Chưa từng làm bài này -> trả về empty record thay vì 404
    if not record:
        return {
            "exercise_id": listening_id,
            "skill": "listening",
            "total_attempts": 0,
            "counted_attempts": 0,
            "max_counted_attempts": 3,
            "best_score": 0,
            "best_raw": 0,
            "last_score": 0,
            "score_locked": False,
            "first_attempt_at": None,
            "last_attempt_at": None,
        }
    return record


@router.get("/{listening_id}/history/{user_id}")
def get_attempt_history(
    listening_id: str,
    user_id: str,
    db=Depends(get_db),
):
    """
    Lịch sử từng lần submit của user với bài này.

    Response:
    {
        "exercise_id": "ex_listen_01",
        "user_id": "u123",
        "attempts": [
            {
                "attempt_number": 1,
                "score_counted": true,
                "raw_score": 7,
                "max_raw": 10,
                "normalized_score": 70.0,
                "details": { "correct_answers": 7, "total_questions": 10 },
                "created_at": "2025-05-01T09:00:00"
            },
            {
                "attempt_number": 4,
                "score_counted": false,
                "normalized_score": 85.0,
                ...
            }
        ]
    }
    """
    item = get_listening_by_id(db, listening_id)
    if not item:
        raise HTTPException(status_code=404, detail="Listening not found")

    svc = ActivityService(db)
    attempts = svc.get_attempt_history(user_id, listening_id, "listening")
    return {
        "exercise_id": listening_id,
        "user_id": user_id,
        "attempts": attempts,
    }