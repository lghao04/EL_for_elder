from pymongo.database import Database
from bson import ObjectId
import json
import re
from typing import List, Dict, Optional
from app.services.llm_service import chat_with_messages_async


def get_all_listening(db: Database, level: str = None, skip: int = 0, limit: int = 20):
    query = {}
    if level:
        query["level"] = level

    items = db["datalistening"].find(query).skip(skip).limit(limit)
    return [_serialize(item) for item in items]


def get_listening_by_id(db: Database, listening_id: str):
    try:
        oid = ObjectId(listening_id)
    except Exception:
        return None

    item = db["datalistening"].find_one({"_id": oid})
    return _serialize(item) if item else None


async def generate_questions_with_options(
    db: Database,
    listening_id: str,
    force_regenerate: bool = False
) -> Optional[Dict]:
    """
    Generate multiple-choice options for each question using LLM.
    Returns the listening item enriched with generated options and answers.
    
    Args:
        db: MongoDB database instance
        listening_id: The ID of the listening item
        force_regenerate: If True, regenerate even if options already exist
    
    Returns:
        Dict with listening data + generated_questions field, or None if not found
    """
    item = get_listening_by_id(db, listening_id)
    if not item:
        return None

    # Return cached if already generated and not forced
    if not force_regenerate and item.get("generated_questions"):
        return item

    questions: List[str] = item.get("questions", [])
    script = item.get("script", {})
    full_text: str = script.get("full_text", "")

    if not questions or not full_text:
        return item  # Nothing to generate

    generated = await _generate_options_from_llm(questions, full_text)

    # Persist generated questions back to DB
    try:
        oid = ObjectId(listening_id)
        db["datalistening"].update_one(
            {"_id": oid},
            {"$set": {"generated_questions": generated}}
        )
    except Exception as e:
        print(f"⚠️ Could not persist generated_questions: {e}")

    item["generated_questions"] = generated
    return item


async def _generate_options_from_llm(questions: List[str], script_text: str) -> List[Dict]:
    """
    Call the LLM to generate 3 answer options per question based on the script.

    Returns a list of dicts:
    [
        {
            "question": "...",
            "options": ["A. ...", "B. ...", "C. ..."],
            "answer": "A"
        },
        ...
    ]
    """
    system_prompt = (
        "You are an ESL (English as a Second Language) quiz generator. "
        "Given a listening script and a list of comprehension questions, "
        "generate exactly 3 multiple-choice options (A, B, C) for each question. "
        "One option must be the correct answer based on the script. "
        "The other two must be plausible but clearly wrong distractors. "
        "Respond ONLY with a valid JSON array. No markdown, no explanation. "
        "Format:\n"
        "[\n"
        "  {\n"
        '    "question": "<question text>",\n'
        '    "options": ["A. <option>", "B. <option>", "C. <option>"],\n'
        '    "answer": "<A, B, or C>"\n'
        "  },\n"
        "  ...\n"
        "]"
    )

    questions_text = "\n".join(f"{i+1}. {q}" for i, q in enumerate(questions))

    user_prompt = (
        f"SCRIPT:\n{script_text}\n\n"
        f"QUESTIONS:\n{questions_text}\n\n"
        "Generate 3 multiple-choice options for each question and identify the correct answer."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    raw_response = await chat_with_messages_async(
        messages=messages,
        temperature=0.4,   # Lower temp for more consistent, factual answers
        max_tokens=2048,
    )

    return _parse_llm_response(raw_response, questions)


def _parse_llm_response(raw: str, fallback_questions: List[str]) -> List[Dict]:
    """
    Safely parse the LLM JSON response.
    Falls back to empty options if parsing fails.
    """
    # Strip markdown fences if present
    cleaned = re.sub(r"```(?:json)?", "", raw).strip()

    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, list):
            return parsed
    except json.JSONDecodeError:
        # Try to extract JSON array from mixed text
        match = re.search(r"\[.*\]", cleaned, re.DOTALL)
        if match:
            try:
                parsed = json.loads(match.group())
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                pass

    # Fallback: return structure without options
    print("⚠️ Failed to parse LLM response, returning empty options")
    return [
        {"question": q, "options": [], "answer": None}
        for q in fallback_questions
    ]


def _serialize(item: dict) -> dict:
    if not item:
        return None
    item["id"] = str(item.pop("_id"))
    return item