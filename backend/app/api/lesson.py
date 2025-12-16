# app/api/lesson.py
from fastapi import APIRouter, Depends, HTTPException
from app.db import get_db
from app.services.lesson_service import LessonService
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
    """Lấy story của lesson (original story)"""
    collection = db["lessons"]
    svc = LessonService(collection)
    # Always use original story (use_short=False)
    story = svc.get_story(lesson_id)
    if story is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return {"id": lesson_id, "story": story, "story_type": "original"}


@router.get("/lessons/{lesson_id}")
def get_full_lesson(lesson_id: str, lang: str = "en", db = Depends(get_db)):
    """
    Lấy toàn bộ lesson bao gồm story, questions và audio URL.
    Query params:
        - lang: ngôn ngữ cho audio (en, vi, etc.)
    """
    svc = LessonService(db["lessons"])
    # Get lesson với original story (use_short=False)
    doc = svc.get_full_lesson(lesson_id)
    
    if not doc:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    # Lấy original story
    story = doc.get("story", "")
    
    # Tạo audio cho story (with caching)
    audio_url = None
    if story and story.strip():
        audio_url = get_or_create_audio(story, lesson_id, lang)
        if not audio_url:
            print(f"⚠️ Failed to generate audio for lesson {lesson_id}")
    
    # Lấy questions với correct answer
    questions = svc.get_questions_with_correct_answer_text(lesson_id)
    
    # Trả về data đơn giản
    return {
        "id": doc.get("id", lesson_id),
        "story": story,
        "audio_url": audio_url,
        "questions": questions,
    }


@router.get("/lessons/{lesson_id}/questions")
def get_questions(lesson_id: str, db = Depends(get_db)):
    """Lấy danh sách questions của lesson"""
    svc = LessonService(db["lessons"])
    qs = svc.get_questions_with_correct_answer_text(lesson_id)
    return {"id": lesson_id, "questions": qs}


@router.get("/lessons")
def list_lessons(skip: int = 0, db = Depends(get_db)):
    """
    Lấy danh sách tất cả lessons
    Query params:
        - skip: bỏ qua bao nhiêu lessons (for pagination)
    """
    # Sort by id to ensure consistent order
    cursor = db["lessons"].find({}, {
        "id": 1,
        "_id": 1
    }).sort("id", 1).skip(skip)
    
    lessons = []
    for doc in cursor:
        lesson_data = {
            "id": doc.get("id", str(doc["_id"])),
        }
        lessons.append(lesson_data)
    
    print(f"📚 Returning {len(lessons)} lessons")
    if lessons:
        print(f"   First: {lessons[0]['id']}")
        print(f"   Last: {lessons[-1]['id']}")
    
    return {
        "lessons": lessons,
        "count": len(lessons)
    }


@router.post("/lessons/{lesson_id}/regenerate-audio")
def regenerate_audio(lesson_id: str, lang: str = "en", db = Depends(get_db)):
    """
    Force regenerate audio cho lesson (xóa cache).
    Useful khi muốn đổi giọng hoặc update story.
    """
    svc = LessonService(db["lessons"])
    # Always use original story
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