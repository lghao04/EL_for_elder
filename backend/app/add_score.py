# scripts/add_score_to_lessons.py

import random
from pymongo import MongoClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGODB_URI = os.getenv("MONGO_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME")

client = MongoClient(MONGODB_URI)
db = client[DATABASE_NAME]
lessons = db.lessons

def add_score_to_lessons():
    """
    Thêm trường score vào mỗi lesson nếu chưa có.
    Score random 40 hoặc 60.
    """

    # Lấy tất cả lessons
    docs = lessons.find({})

    updated = 0
    skipped = 0

    for doc in docs:
        if "score" in doc:
            skipped += 1
            continue

        score = random.choice([40, 60])

        lessons.update_one(
            {"_id": doc["_id"]},
            {"$set": {"score": score}}
        )

        updated += 1

    print(f"✅ Done! Updated: {updated}, Skipped (already have score): {skipped}")


if __name__ == "__main__":
    add_score_to_lessons()
