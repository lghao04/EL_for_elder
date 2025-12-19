# app/db.py
import os
from dotenv import load_dotenv
from pymongo import MongoClient
from typing import Optional

load_dotenv()

MONGODB_URI = os.getenv("MONGO_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME")

if not MONGODB_URI:
    raise ValueError("❌ Missing MONGODB_URI in .env")
if not DATABASE_NAME:
    raise ValueError("❌ Missing DATABASE_NAME in .env")

client: Optional[MongoClient] = None
db = None

def init_db():
    global client, db
    if client is None:
        try:
            client = MongoClient(MONGODB_URI)
            db = client[DATABASE_NAME]
            client.admin.command("ping")
            print("✅ MongoDB connected successfully!")
        except Exception as e:
            client = None
            db = None
            print("❌ MongoDB connection failed:", e)
def close_db():
    global client, db
    if client is not None:
        try:
            client.close()
            print("✅ MongoDB connection closed")
        except Exception as e:
            print("❌ Error closing MongoDB client:", e)
        finally:
            client = None
            db = None

def get_db():
    """
    Trả về đối tượng db (synchronous pymongo db).
    Dùng như dependency trong các router: `db = Depends(get_db)`
    """
    if db is None:
        raise RuntimeError("MongoDB not initialized. Call init_db() first.")
    return db
