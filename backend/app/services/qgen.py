# app/services/qgen.py(rule-based MCQ generator + placeholder cho LLM gen)
import re
import random
import uuid

STOPWORDS = set([
    "the","a","an","and","to","in","on","for","of","is","are","was","were",
    "it","that","this","with","as","at","by","from","be","have","has","i","you"
])

def simple_mcq_from_transcript(transcript):
    """
    Trả về 1 question dict hoặc None.
    question: {id, type, question, choices, answer}
    """
    if not transcript or len(transcript.strip()) < 30:
        return None
    # split sentences
    sents = re.split(r'(?<=[.!?])\s+', transcript)
    sents = [s.strip() for s in sents if len(s.split()) >= 6]
    if not sents:
        return None
    sent = random.choice(sents)
    words = re.findall(r"\b\w+\b", sent)
    candidates = [w for w in words if w.lower() not in STOPWORDS and len(w) > 2]
    if not candidates:
        return None
    answer = random.choice(candidates)
    # distractors naive: pick other content words from transcript that are same POS would be better
    all_words = list({w for w in re.findall(r"\b\w+\b", transcript) if w.lower() != answer.lower() and len(w)>2})
    if len(all_words) >= 3:
        distractors = random.sample(all_words, 3)
    else:
        # fallback: create some variants
        distractors = [w for w in all_words][:3]
        while len(distractors) < 3:
            distractors.append("...")

    choices = [answer] + distractors
    random.shuffle(choices)
    q = {
        "id": str(uuid.uuid4()),
        "type": "mcq",
        "question": sent.replace(answer, "_____"),
        "choices": choices,
        "answer": answer
    }
    return q

# Placeholder for LLM-based generation
def generate_questions_via_llm(transcript, n=3):
    """
    Placeholder: integrate your LLM here.
    Return list of question dicts same shape as simple_mcq_from_transcript.
    """
    # Example: call OpenAI/other LLM, pass transcript and parse response.
    # For now return empty list to indicate it's not implemented.
    return []
