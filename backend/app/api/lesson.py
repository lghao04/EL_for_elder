# app/api/lesson.py
from fastapi import APIRouter, Depends, HTTPException
from app.db import get_db
from app.services.lesson_service import LessonService
from app.services.tts_service import text_to_speech
from pathlib import Path
import hashlib

router = APIRouter()

def get_or_create_audio(story_text: str, lesson_id: str, lang: str = "en") -> str:
    """
    Tạo hoặc lấy file audio đã có cho story.
    Returns: relative URL path để frontend có thể access
    """
    # Tạo hash từ story text + language để cache audio
    text_hash = hashlib.md5(f"{story_text}_{lang}".encode()).hexdigest()[:16]
    filename = f"lesson_{lesson_id}_{text_hash}.mp3"
    
    # Đường dẫn lưu file
    audio_dir = Path(__file__).resolve().parent.parent / "temp_tts"
    audio_dir.mkdir(exist_ok=True)
    audio_path = audio_dir / filename
    
    # Nếu file đã tồn tại, trả về URL
    if audio_path.exists():
        print(f"✅ Using cached audio: {filename}")
        return f"/temp_tts/{filename}"
    
    # Tạo audio mới với gTTS
    try:
        print(f"🎵 Generating audio for lesson {lesson_id}...")
        from gtts import gTTS
        tts = gTTS(text=story_text, lang=lang)
        tts.save(str(audio_path))
        print(f"✅ Audio generated: {filename}")
        return f"/temp_tts/{filename}"
    except Exception as e:
        print(f"❌ Error generating audio: {e}")
        return None

@router.get("/lessons/{lesson_id}/story")
def get_lesson_story(lesson_id: str, db = Depends(get_db)):
    """Lấy story của lesson"""
    collection = db["lessons"]
    svc = LessonService(collection)
    story = svc.get_story(lesson_id)
    if story is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return {"id": lesson_id, "story": story}

@router.get("/lessons/{lesson_id}")
def get_full_lesson(lesson_id: str, lang: str = "en", db = Depends(get_db)):
    """
    Lấy toàn bộ lesson bao gồm story, questions và audio URL.
    Query params:
        - lang: ngôn ngữ cho audio (en, vi, etc.)
    """
    svc = LessonService(db["lessons"])
    doc = svc.get_full_lesson(lesson_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Lấy story
    story = doc.get("story", "")
    
    # Tạo audio cho story (with caching)
    audio_url = None
    if story and story.strip():
        audio_url = get_or_create_audio(story, lesson_id, lang)
        if not audio_url:
            print(f"⚠️ Failed to generate audio for lesson {lesson_id}")
    
    # Lấy questions với correct answer
    questions = svc.get_questions_with_correct_answer_text(lesson_id)
    
    # Trả về data hoàn chỉnh
    return {
        "id": doc.get("id", lesson_id),
        "_id": str(doc.get("_id", "")),
        "story": story,
        "audio_url": audio_url,  # URL để frontend fetch audio
        "questions": questions,
        # Các field khác nếu có
        "title": doc.get("title", f"Lesson {lesson_id}"),
        "difficulty": doc.get("difficulty", "medium"),
        "topic": doc.get("topic", ""),
    }

@router.get("/lessons/{lesson_id}/questions")
def get_questions(lesson_id: str, db = Depends(get_db)):
    """Lấy danh sách questions của lesson"""
    svc = LessonService(db["lessons"])
    qs = svc.get_questions_with_correct_answer_text(lesson_id)
    return {"id": lesson_id, "questions": qs}

@router.get("/lessons")
def list_lessons(limit: int = 50, skip: int = 0, db = Depends(get_db)):
    """
    Lấy danh sách tất cả lessons (for lesson selection page)
    Query params:
        - limit: số lượng lessons (default 50)
        - skip: bỏ qua bao nhiêu lessons (for pagination)
    """
    svc = LessonService(db["lessons"])
    lessons = svc.list_all_lessons(limit=limit, skip=skip)
    return {
        "lessons": lessons,
        "count": len(lessons),
        "limit": limit,
        "skip": skip
    }

@router.post("/lessons/{lesson_id}/regenerate-audio")
def regenerate_audio(lesson_id: str, lang: str = "en", db = Depends(get_db)):
    """
    Force regenerate audio cho lesson (xóa cache).
    Useful khi muốn đổi giọng hoặc update story.
    """
    svc = LessonService(db["lessons"])
    story = svc.get_story(lesson_id)
    
    if not story:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Xóa file cache cũ nếu có
    text_hash = hashlib.md5(f"{story}_{lang}".encode()).hexdigest()[:16]
    filename = f"lesson_{lesson_id}_{text_hash}.mp3"
    audio_dir = Path(__file__).resolve().parent.parent / "temp_tts"
    audio_path = audio_dir / filename
    
    if audio_path.exists():
        audio_path.unlink()
        print(f"🗑️ Deleted cached audio: {filename}")
    
    # Generate mới
    audio_url = get_or_create_audio(story, lesson_id, lang)
    
    if not audio_url:
        raise HTTPException(status_code=500, detail="Failed to generate audio")
    
    return {
        "success": True,
        "audio_url": audio_url,
        "message": "Audio regenerated successfully"
    }