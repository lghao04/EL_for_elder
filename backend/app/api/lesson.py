# app/api/lesson.py
# dùng cho reading
from fastapi import APIRouter, Depends, HTTPException
from app.db import get_db
from app.services.lesson_service import LessonService

router = APIRouter()


@router.get("/lessons/{lesson_id}/story")
def get_lesson_story(lesson_id: str, db=Depends(get_db)):
    """Lấy story của lesson (original story)"""
    collection = db["lessons"]
    svc = LessonService(collection)

    story = svc.get_story(lesson_id)
    if story is None:
        raise HTTPException(status_code=404, detail="Lesson not found")

    return {
        "id": lesson_id,
        "story": story,
        "story_type": "original"
    }


@router.get("/lessons/{lesson_id}")
def get_full_lesson(
    lesson_id: str,
    skill: str = "listening",  # vẫn giữ nếu sau này mở rộng
    db=Depends(get_db)
):
    """
    Lấy toàn bộ lesson (KHÔNG còn audio).
    """
    svc = LessonService(db["lessons"])
    doc = svc.get_full_lesson(lesson_id)

    if not doc:
        raise HTTPException(status_code=404, detail="Lesson not found")

    story = doc.get("story", "")

    # Lấy questions với correct answer
    questions = svc.get_questions_with_correct_answer_text(lesson_id)

    return {
        "id": doc.get("id", lesson_id),
        "story": story,
        "questions": questions,
    }


@router.get("/lessons/{lesson_id}/questions")
def get_questions(lesson_id: str, db=Depends(get_db)):
    """Lấy danh sách questions của lesson"""
    svc = LessonService(db["lessons"])
    qs = svc.get_questions_with_correct_answer_text(lesson_id)

    return {
        "id": lesson_id,
        "questions": qs
    }


@router.get("/lessons")
def list_lessons(skip: int = 0, db=Depends(get_db)):
    """
    Lấy danh sách tất cả lessons
    """
    cursor = db["lessons"].find({}, {
        "id": 1,
        "_id": 1
    }).sort("id", 1).skip(skip)

    lessons = []
    for doc in cursor:
        lessons.append({
            "id": doc.get("id", str(doc["_id"]))
        })

    print(f"📚 Returning {len(lessons)} lessons")

    return {
        "lessons": lessons,
        "count": len(lessons)
    }