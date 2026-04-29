# app/services/tts_service.py
from gtts import gTTS
from io import BytesIO

def text_to_speech(text: str, lang: str = "en") -> bytes:
    buf = BytesIO()
    tts = gTTS(text=text, lang=lang)
    tts.write_to_fp(buf)
    buf.seek(0)
    return buf.read()