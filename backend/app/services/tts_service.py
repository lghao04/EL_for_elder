# app/services/tts_service.py
from gtts import gTTS
from pathlib import Path
import uuid

BASE_DIR = Path(__file__).parent.parent
TTS_FOLDER = BASE_DIR / "temp_tts"
TTS_FOLDER.mkdir(exist_ok=True)

def text_to_speech(text: str, lang: str = "en") -> str:
    filename = TTS_FOLDER / f"{uuid.uuid4()}.mp3"
    tts = gTTS(text=text, lang=lang)
    tts.save(str(filename))
    return f"/temp_tts/{filename.name}"
