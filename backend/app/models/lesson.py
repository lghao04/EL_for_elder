from pydantic import BaseModel
from typing import List, Optional

class Lesson(BaseModel):
    title: str
    level: str
    audio_url: Optional[str] = ""
    thumbnail_url: Optional[str] = ""
    transcript: str
    exercises: List[dict] = []
