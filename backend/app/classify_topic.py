# app/classify_topics.py
# Phân loại collection `topicwriting` theo chủ đề, thêm field `topic` vào mỗi document.
#
# Cách hoạt động:
#   1. Đọc field `question`
#   2. Đếm keyword khớp cho từng topic → gán topic có điểm cao nhất
#   3. Nếu không khớp keyword nào → gán "Other"
#
# Ví dụ document sau khi chạy:
#   { "id": "quora_0", "question": "Why whenever I get in the shower...", "topic": "Relationships" }

import re
from db import init_db, get_db
from pymongo import UpdateOne

# ─────────────────────────────────────────────────────────────────
# ĐỊNH NGHĨA CHỦ ĐỀ + TỪ KHOÁ
# Keyword bám sát nội dung câu hỏi Quora thực tế.
# Thêm/sửa topic tại đây — code phân loại không cần thay đổi gì.
# ─────────────────────────────────────────────────────────────────

TOPIC_KEYWORDS: dict[str, list[str]] = {
    "Relationships": [
        "girlfriend", "boyfriend", "wife", "husband", "partner", "date",
        "relationship", "love", "breakup", "marriage", "divorce", "crush",
        "ex", "cheating", "affair", "jealous", "flirt", "attraction",
        "romantic", "couple", "dating", "heartbreak", "soulmate", "toxic",
        "long distance", "propose", "wedding",
    ],
    "Education": [
        "school", "student", "teacher", "university", "college", "study",
        "education", "classroom", "homework", "professor", "exam", "degree",
        "scholarship", "campus", "tutor", "learn", "course", "grade",
        "curriculum", "academic", "knowledge", "gpa", "admission", "major",
        "lecture", "textbook", "graduate",
    ],
    "Technology": [
        "internet", "computer", "software", "hardware", "artificial intelligence",
        "robot", "algorithm", "programming", "code", "app", "smartphone",
        "technology", "social media", "cybersecurity", "hacker", "data",
        "machine learning", "virtual reality", "automation", "digital",
        "website", "device", "innovation", "gadget", "network", "AI",
        "python", "javascript", "android", "iphone", "laptop", "wifi",
    ],
    "Health & Medicine": [
        "exercise", "diet", "hospital", "doctor", "health", "medicine",
        "patient", "disease", "therapy", "mental health", "nurse", "surgery",
        "vaccine", "nutrition", "fitness", "depression", "anxiety",
        "symptom", "treatment", "obesity", "smoking", "drug", "pain",
        "sleep", "stress", "wellbeing", "hygiene", "weight", "calorie",
        "cancer", "diabetes", "virus", "infection",
    ],
    "Career & Work": [
        "job", "employee", "employer", "company", "salary", "interview",
        "career", "office", "manager", "boss", "resign", "promotion",
        "workplace", "profession", "business", "startup", "entrepreneur",
        "freelance", "remote work", "hire", "resume", "skill", "internship",
        "income", "work", "colleague", "profession",
    ],
    "Science": [
        "science", "experiment", "research", "discovery", "physics",
        "chemistry", "biology", "astronomy", "evolution", "genetics",
        "theory", "quantum", "scientist", "invention", "space", "planet",
        "atom", "molecule", "gravity", "energy", "light", "sound",
        "temperature", "pressure", "force", "laboratory",
    ],
    "Finance & Money": [
        "money", "finance", "bank", "tax", "inflation", "invest",
        "stock", "market", "crypto", "bitcoin", "wealth", "income",
        "budget", "debt", "currency", "save", "loan", "credit",
        "insurance", "profit", "loss", "price", "cost", "payment",
        "salary", "rich", "poor", "afford",
    ],
    "Society & Politics": [
        "society", "government", "politics", "law", "protest", "human rights",
        "immigration", "homeless", "justice", "religion", "tradition",
        "diversity", "discrimination", "freedom", "democracy", "vote",
        "election", "policy", "president", "country", "nation", "war",
        "racism", "inequality", "poverty", "social",
    ],
    "Family": [
        "family", "parent", "mother", "father", "child", "sibling",
        "marriage", "divorce", "grandparent", "baby", "son", "daughter",
        "household", "adoption", "pregnancy", "parenting", "upbringing",
        "generation", "home", "mom", "dad", "kid", "brother", "sister",
        "aunt", "uncle",
    ],
    "Food & Cooking": [
        "food", "cook", "recipe", "eat", "diet", "restaurant", "meal",
        "ingredient", "bake", "chef", "cuisine", "flavor", "taste",
        "drink", "vegetarian", "vegan", "snack", "breakfast", "lunch",
        "dinner", "nutrition", "calorie", "spice", "fruit", "vegetable",
    ],
    "Travel & Places": [
        "travel", "trip", "destination", "hotel", "flight", "airport",
        "visit", "explore", "vacation", "passport", "tourist", "country",
        "city", "culture", "foreign", "abroad", "backpack", "journey",
        "landmark", "visa", "map", "tour",
    ],
    "Entertainment": [
        "movie", "film", "music", "song", "book", "game", "sport",
        "watch", "listen", "read", "play", "actor", "artist", "band",
        "concert", "series", "show", "netflix", "youtube", "podcast",
        "celebrity", "fan", "theater", "dance", "comedy",
    ],
    "Personal Development": [
        "self-improvement", "habit", "goal", "motivation", "productivity",
        "mindset", "confidence", "discipline", "success", "failure",
        "overcome", "challenge", "growth", "potential", "skill",
        "focus", "procrastination", "happiness", "purpose", "identity",
        "anxiety", "overthink", "introvert", "personality",
    ],
    "Philosophy & Ethics": [
        "philosophy", "moral", "ethics", "meaning", "consciousness",
        "right", "wrong", "justice", "fairness", "truth", "belief",
        "value", "principle", "free will", "existence", "religion",
        "god", "faith", "soul", "purpose", "life", "death", "reality",
    ],
    "Environment": [
        "pollution", "climate", "global warming", "forest", "environment",
        "nature", "ecosystem", "wildlife", "ocean", "carbon", "renewable",
        "sustainability", "deforestation", "endangered", "recycling",
        "fossil fuel", "greenhouse", "biodiversity", "drought", "flood",
        "energy", "solar", "plastic",
    ],
}

TOPIC_OTHER = "Other"


# ─────────────────────────────────────────────────────────────────
# PHÂN LOẠI MỘT QUESTION
# ─────────────────────────────────────────────────────────────────

def classify_prompt(text: str) -> str:
    """
    Trả về tên topic phù hợp nhất.
    Nếu không khớp keyword nào → trả về "Other".
    """
    text = " ".join(text.split()).lower()
    scores: dict[str, int] = {}

    for topic, keywords in TOPIC_KEYWORDS.items():
        count = sum(
            len(re.findall(r'\b' + re.escape(kw.lower()) + r'\b', text))
            for kw in keywords
        )
        if count > 0:
            scores[topic] = count

    if not scores:
        return TOPIC_OTHER

    return max(scores, key=lambda t: scores[t])


# ─────────────────────────────────────────────────────────────────
# CHẠY PHÂN LOẠI TOÀN BỘ COLLECTION
# ─────────────────────────────────────────────────────────────────

def classify_all(limit: int | None = None, batch_size: int = 1000) -> None:
    """
    Đọc toàn bộ topicwriting, phân loại, ghi field `topic` vào từng document.

    Args:
        limit:      Giới hạn số document xử lý (None = tất cả).
        batch_size: Số document mỗi lần bulk_write vào MongoDB.
    """
    db = get_db()
    col = db["topicwriting"]

    total_db = col.count_documents({})
    cursor = col.find({}, {"_id": 1, "question": 1})
    if limit:
        cursor = cursor.limit(limit)

    docs = list(cursor)
    print(f"📥 Tải {len(docs):,} / {total_db:,} documents từ MongoDB")

    # ── Phân loại ──
    print("🔍 Đang phân loại...")
    updates: list[tuple] = []

    for idx, doc in enumerate(docs):
        topic = classify_prompt(doc.get("question", ""))
        updates.append((doc["_id"], topic))

        if (idx + 1) % 10_000 == 0:
            print(f"   ⏳ {idx + 1:,} / {len(docs):,}")

    # ── Ghi vào MongoDB theo batch ──
    print(f"💾 Ghi {len(updates):,} documents vào MongoDB...")
    written = 0

    for i in range(0, len(updates), batch_size):
        batch = updates[i : i + batch_size]
        ops = [
            UpdateOne({"_id": _id}, {"$set": {"topic": topic}})
            for _id, topic in batch
        ]
        result = col.bulk_write(ops, ordered=False)
        written += result.modified_count

    print(f"✅ Đã cập nhật {written:,} documents\n")

    col.create_index("topic")
    print("📌 Đã tạo index trên field `topic`\n")

    _print_stats(col)


# ─────────────────────────────────────────────────────────────────
# THỐNG KÊ
# ─────────────────────────────────────────────────────────────────

def _print_stats(col) -> None:
    rows = list(col.aggregate([
        {"$group": {"_id": "$topic", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
    ]))
    total = sum(r["count"] for r in rows)

    print(f"{'─'*58}")
    print(f"{'CHỦ ĐỀ':<28} {'SỐ QUESTIONS':>12}  {'%':>5}  BAR")
    print(f"{'─'*58}")
    for r in rows:
        name  = r["_id"] or "N/A"
        count = r["count"]
        pct   = count / total * 100
        bar   = "█" * int(pct / 2)
        print(f"{name:<28} {count:>12,}  {pct:>4.1f}%  {bar}")
    print(f"{'─'*58}")
    print(f"{'TỔNG':<28} {total:>12,}  100%")


# ─────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    init_db()

    args = sys.argv[1:]
    limit = int(args[0]) if args else None
    classify_all(limit=limit)