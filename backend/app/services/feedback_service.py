# app/services/feedback_service.py
import json
import re
from .llm_service import chat_with_messages_async
from pydantic import BaseModel


# ─── Pydantic Models ──────────────────────────────────────────────────────────

class RatingItem(BaseModel):
    stars: int
    label: str
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

class HighlightSpan(BaseModel):
    start: int
    end: int
    type: str
    original: str
    corrected: str
    explanation: str

class WritingFeedback(BaseModel):
    ratings: Ratings
    overallFeedback: str
    grammarErrors: list[GrammarError]
    rewrittenSentences: list[RewrittenSentence]
    topicCheck: TopicCheck
    encouragement: str
    highlights: list[HighlightSpan]


# ─── Highlight Builder ────────────────────────────────────────────────────────

def _build_highlights(essay: str, errors: list[GrammarError]) -> list[HighlightSpan]:
    spans: list[HighlightSpan] = []
    cursor = 0

    for err in errors:
        needle = err.original
        idx = essay.lower().find(needle.lower(), cursor)
        if idx == -1:
            idx = essay.lower().find(needle.lower())
        if idx == -1:
            continue

        error_type = "spelling" if " " not in needle.strip() else "grammar"
        spans.append(HighlightSpan(
            start=idx,
            end=idx + len(needle),
            type=error_type,
            original=essay[idx: idx + len(needle)],
            corrected=err.corrected,
            explanation=err.explanation,
        ))
        cursor = idx + len(needle)

    spans.sort(key=lambda s: s.start)
    return spans


# ─── Prompt Builder ───────────────────────────────────────────────────────────

def _build_prompt(topic: str, essay: str) -> str:
    # Escape any quotes in the essay to avoid breaking the JSON template
    safe_essay = essay.replace('"', '\\"')
    safe_topic = topic.replace('"', '\\"')

    return f"""You are a friendly English writing coach helping beginners improve their writing.
Analyze the essay below and return ONLY a valid JSON object.

STRICT RULES — failure to follow will break the system:
1. Return raw JSON only. No markdown, no code fences, no explanation before or after.
2. Every string value MUST use double quotes. Single quotes are NOT allowed.
3. Do NOT use newlines inside string values. Write each value on one line.
4. Keep every string value SHORT: comment ≤ 15 words, explanation ≤ 20 words, tip ≤ 20 words.
5. overallFeedback: 2 sentences max. encouragement: 1 sentence max.
6. grammarErrors: up to 5 items. rewrittenSentences: up to 3 items.
7. The "original" field in grammarErrors MUST be copied EXACTLY from the essay (same words, same spelling).

TOPIC: "{safe_topic}"
ESSAY: "{safe_essay}"

Return exactly this structure:
{{
  "ratings": {{
    "topic":          {{"stars": 1, "label": "Needs work", "comment": "short comment here"}},
    "grammar":        {{"stars": 3, "label": "Improving",  "comment": "short comment here"}},
    "vocabulary":     {{"stars": 3, "label": "Improving",  "comment": "short comment here"}},
    "naturalEnglish": {{"stars": 3, "label": "Improving",  "comment": "short comment here"}}
  }},
  "overallFeedback": "One or two sentences of overall feedback.",
  "grammarErrors": [
    {{"original": "exact phrase from essay", "corrected": "fixed phrase", "explanation": "short reason"}}
  ],
  "rewrittenSentences": [
    {{"original": "awkward sentence", "improved": "better version", "tip": "short tip"}}
  ],
  "topicCheck": {{"isOnTopic": true, "comment": "short comment"}},
  "encouragement": "One warm sentence."
}}

label must be one of: Excellent, Good, Improving, Basic, Needs work"""


# ─── JSON cleaner ─────────────────────────────────────────────────────────────

def _clean_json(raw: str) -> str:
    """Strip markdown fences and any leading/trailing non-JSON text."""
    # Remove ```json ... ``` or ``` ... ```
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()
    # Find the first { and last } in case model adds preamble text
    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start != -1 and end != -1 and end > start:
        cleaned = cleaned[start: end + 1]
    return cleaned


# ─── Main Service Function ────────────────────────────────────────────────────

MAX_RETRIES = 2

async def grade_writing(topic: str, essay: str) -> WritingFeedback:
    messages = [
        {
            "role": "system",
            "content": (
                "You are an expert English writing coach for beginners. "
                "You ALWAYS respond with a single valid JSON object and nothing else. "
                "No markdown. No code fences. No text before or after the JSON."
            ),
        },
        {
            "role": "user",
            "content": _build_prompt(topic, essay),
        },
    ]

    last_error: Exception | None = None

    for attempt in range(1, MAX_RETRIES + 1):
        raw = await chat_with_messages_async(
            messages=messages,
            temperature=0.2,   # lower = more deterministic / less hallucination
            max_tokens=2000,
        )

        cleaned = _clean_json(raw)

        try:
            data = json.loads(cleaned)
        except json.JSONDecodeError as e:
            print(f"⚠️  Attempt {attempt}/{MAX_RETRIES} — invalid JSON: {e}")
            print(f"   Raw (first 600 chars): {raw[:600]}")
            last_error = e

            # On retry, tell the model what went wrong
            messages.append({"role": "assistant", "content": raw})
            messages.append({
                "role": "user",
                "content": (
                    f"Your response was not valid JSON. Parse error: {e}. "
                    "Please return ONLY the corrected JSON object. "
                    "No markdown, no explanation, no text outside the JSON."
                ),
            })
            continue

        feedback = WritingFeedback(
            **data,
            highlights=[],
        )
        feedback.highlights = _build_highlights(essay, feedback.grammarErrors)
        return feedback

    raise ValueError(f"AI returned invalid JSON after {MAX_RETRIES} attempts: {last_error}")