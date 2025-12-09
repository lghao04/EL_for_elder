# backend/app/importdata.py
import os
import asyncio
import csv
import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import certifi

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("MONGO_DB")

# Kết nối MongoDB Atlas với certifi để tránh SSL lỗi
client = AsyncIOMotorClient(MONGO_URI, tls=True, tlsCAFile=certifi.where())
db = client[DB_NAME]

# Link raw TSV từ GitHub MC dataset
MC_URL = "https://raw.githubusercontent.com/mcobzarenco/mctest/master/data/MCTest/mc160.train.tsv"

async def import_mc_data():
    print("Downloading MC dataset...")
    r = requests.get(MC_URL)
    r.raise_for_status()
    
    text = r.text
    # Các cột trong MC dataset: story, question, answer, id
    reader = csv.DictReader(text.splitlines(), delimiter='\t')
    
    count = 0
    for row in reader:
        # Mỗi câu hỏi trong dataset có thể là multiple hoặc one
        questions = []
        for key in row:
            if key.startswith("multiple:") or key.startswith("one:"):
                question_text = key.split(":", 1)[1].strip()
                answer_text = row[key]
                questions.append({
                    "question": question_text,
                    "answer": answer_text
                })
        
        doc = {
            "_id": row["mc160.train.*"] if "mc160.train.*" in row else None,  # fallback nếu id khác
            "story": row.get("story", ""),
            "author": row.get("Author", ""),
            "questions": questions
        }

        try:
            await db.mc.insert_one(doc)
            count += 1
        except Exception as e:
            print(f"Skipped {row.get('mc160.train.*', 'no-id')} -> {e}")
    
    print(f"Imported {count} MC records into MongoDB.")

if __name__ == "__main__":
    asyncio.run(import_mc_data())
