# app/api/lesson.py
# dùng cho reading
from fastapi import APIRouter, Depends, HTTPException
from app.db import get_db
from app.services.lesson_service import LessonService
from pydantic import BaseModel, Field, validator
from app.services.activity_service import ActivityService

router = APIRouter()


@router.get("/lessons/{lesson_id}/story")
def get_lesson_story(lesson_id: str, db=Depends(get_db)):
    """Lấy story của lesson (original story)"""
    svc = LessonService(db["lessons"])
    story = svc.get_story(lesson_id)
    if story is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return {"id": lesson_id, "story": story, "story_type": "original"}


@router.get("/lessons/{lesson_id}")
def get_full_lesson(lesson_id: str, db=Depends(get_db)):
    """Lấy toàn bộ lesson: story + questions."""
    svc = LessonService(db["lessons"])
    doc = svc.get_full_lesson(lesson_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return {
        "id": doc.get("id", lesson_id),
        "story": doc.get("story", ""),
        "questions": svc.get_questions_with_correct_answer_text(lesson_id),
    }


@router.get("/lessons/{lesson_id}/questions")
def get_questions(lesson_id: str, db=Depends(get_db)):
    """Lấy danh sách questions của lesson."""
    svc = LessonService(db["lessons"])
    return {"id": lesson_id, "questions": svc.get_questions_with_correct_answer_text(lesson_id)}


@router.get("/lessons")
def list_lessons(skip: int = 0, db=Depends(get_db)):
    """Lấy danh sách tất cả lessons."""
    cursor = db["lessons"].find({}, {"id": 1, "_id": 1}).sort("id", 1).skip(skip)
    lessons = [{"id": doc.get("id", str(doc["_id"]))} for doc in cursor]
    return {"lessons": lessons, "count": len(lessons)}


# ── Submit / Record / History ─────────────────────────────────────────────────

class SubmitReadingRequest(BaseModel):
    user_id: str = Field(..., description="ID người dùng")
    correct_answers: int = Field(..., ge=0, description="Số câu trả lời đúng")
    total_questions: int = Field(..., ge=1, description="Tổng số câu hỏi")

    @validator("correct_answers")
    def correct_must_not_exceed_total(cls, v, values):
        total = values.get("total_questions")
        if total is not None and v > total:
            raise ValueError("correct_answers không được vượt quá total_questions")
        return v


@router.post("/lessons/{lesson_id}/submit")
def submit_reading(
    lesson_id: str,
    body: SubmitReadingRequest,
    db=Depends(get_db),
):
    """
    Nộp kết quả bài Reading.
    - normalized_score = correct_answers / total_questions × 100
    - Tối đa 3 lần submit được tính điểm (score_locked sau đó)
    - correct_answers >= 1 → tính streak ngày hôm nay
    - streak > 1 + ngày mới → +10 điểm thưởng
    """
    svc = LessonService(db["lessons"])
    if not svc.get_full_lesson(lesson_id):
        raise HTTPException(status_code=404, detail="Lesson not found")

    try:
        result = ActivityService(db).submit_reading(
            user_id=body.user_id,
            exercise_id=lesson_id,
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


@router.get("/lessons/{lesson_id}/record/{user_id}")
def get_reading_record(lesson_id: str, user_id: str, db=Depends(get_db)):
    """Tổng hợp kết quả bài reading: best_score, attempts, score_locked..."""
    record = ActivityService(db).get_exercise_record(user_id, lesson_id, "reading")
    if not record:
        return {
            "exercise_id": lesson_id,
            "skill": "reading",
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


@router.get("/lessons/{lesson_id}/history/{user_id}")
def get_reading_history(lesson_id: str, user_id: str, db=Depends(get_db)):
    """Lịch sử từng lần submit của user với bài reading này."""
    attempts = ActivityService(db).get_attempt_history(user_id, lesson_id, "reading")
    return {"exercise_id": lesson_id, "user_id": user_id, "attempts": attempts}