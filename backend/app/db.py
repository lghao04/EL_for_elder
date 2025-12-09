# backend/app/db.py
from motor.motor_asyncio import AsyncIOMotorClient
from pathlib import Path
from dotenv import load_dotenv
import os

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
load_dotenv(BASE_DIR / ".env")

MONGO_URI = os.getenv("MONGO_URI")
MONGO_DB = os.getenv("MONGO_DB", "testdb")

client = None
db = None


async def connect_to_mongo():
    global client, db
    if client is None:
        client = AsyncIOMotorClient(MONGO_URI)
        db = client[MONGO_DB]
        print("✅ MongoDB (Motor) connected!")
    return db


async def close_mongo():
    global client
    if client:
        client.close()
        print("🛑 MongoDB connection closed!")
