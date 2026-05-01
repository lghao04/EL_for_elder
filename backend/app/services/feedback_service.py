# app/services/writing_service.py
import json
import re
from typing import Optional
from pydantic import BaseModel
from .llm_service import chat_with_messages_async


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class RatingItem(BaseModel):
    stars: int          # 1–5
    label: str          # Excellent | Good | Improving | Basic | Needs work
    comment: str

class GrammarError(BaseModel):
    original: str
    corrected: str
    explanation: str

class RewrittenSentence(BaseModel):
    original: str
    improved: str
    tip: str

class TopicCheck(BaseModel):
    isOnTopic: bool
    comment: str

class Ratings(BaseModel):
    topic: RatingItem
    grammar: RatingItem
    vocabulary: RatingItem
    naturalEnglish: RatingItem

class WritingFeedback(BaseModel):
    ratings: Ratings
    overallFeedback: str
    grammarErrors: list[GrammarError]
    rewrittenSentences: list[RewrittenSentence]
    topicCheck: TopicCheck
    encouragement: str


# ─── Prompt Builder ───────────────────────────────────────────────────────────

def _build_prompt(topic: str, essay: str) -> str:
    return f"""You are a friendly English writing coach helping beginners improve their writing.
Analyze the following essay and return ONLY a valid JSON object — no markdown, no explanation, no extra text.

TOPIC: "{topic}"
ESSAY: "{essay}"

Return this exact JSON structure:
{{
  "ratings": {{
    "topic":         {{ "stars": <1-5>, "label": "<Excellent|Good|Improving|Basic|Needs work>", "comment": "<brief>" }},
    "grammar":       {{ "stars": <1-5>, "label": "<Excellent|Good|Improving|Basic|Needs work>", "comment": "<brief>" }},
    "vocabulary":    {{ "stars": <1-5>, "label": "<Excellent|Good|Improving|Basic|Needs work>", "comment": "<brief>" }},
    "naturalEnglish":{{ "stars": <1-5>, "label": "<Excellent|Good|Improving|Basic|Needs work>", "comment": "<brief>" }}
  }},
  "overallFeedback": "<2-3 encouraging sentences>",
  "grammarErrors": [
    {{ "original": "<wrong text>", "corrected": "<fixed text>", "explanation": "<simple reason>" }}
  ],
  "rewrittenSentences": [
    {{ "original": "<awkward sentence>", "improved": "<natural version>", "tip": "<why it's better>" }}
  ],
  "topicCheck": {{
    "isOnTopic": <true|false>,
    "comment": "<comment on relevance to topic>"
  }},
  "encouragement": "<one warm motivating message>"
}}

Rules:
- grammarErrors: up to 5 most important errors only
- rewrittenSentences: pick up to 3 sentences to improve
- Keep all explanations at A2-B1 level English (simple words)
- Be encouraging and supportive, never harsh"""


# ─── Main Service Function ────────────────────────────────────────────────────

async def grade_writing(topic: str, essay: str) -> WritingFeedback:
    """
    Grade a user's essay using Groq LLM.

    Args:
        topic: The writing prompt/topic
        essay: The user's written essay

    Returns:
        WritingFeedback with ratings, grammar fixes, rewrites, etc.
    """
    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert English writing coach for beginners. "
                "You always respond with valid JSON only — no markdown, no preamble."
            ),
        },
        {
            "role": "user",
            "content": _build_prompt(topic, essay),
        },
    ]

    raw = await chat_with_messages_async(
        messages=messages,
        temperature=0.3,    # low temp → consistent, structured output
        max_tokens=2000,
    )

    # Strip markdown fences if model adds them anyway
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("```").strip()

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse writing feedback JSON: {e}")
        print(f"Raw response: {raw[:500]}")
        raise ValueError(f"AI returned invalid JSON: {e}")

    return WritingFeedback(**data)