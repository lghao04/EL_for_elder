# app/db.py
# Kết nối môngDB
import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()  # Load .env

MONGODB_URI = os.getenv("MONGO_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME")

if not MONGODB_URI:
    raise ValueError("❌ Missing MONGODB_URI in .env")
if not DATABASE_NAME:
    raise ValueError("❌ Missing DATABASE_NAME in .env")

client = MongoClient(MONGODB_URI)
db = client[DATABASE_NAME]

def test_connection():
    try:
        db.list_collection_names()
        print("✅ MongoDB connected successfully!")
    except Exception as e:
        print("❌ MongoDB connection failed:", e)
