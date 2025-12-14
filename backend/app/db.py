# app/db.py
import os
from dotenv import load_dotenv
from pymongo import MongoClient
from typing import Optional

load_dotenv()  # Load .env

MONGODB_URI = os.getenv("MONGO_URI")
DATABASE_NAME = os.getenv("DATABASE_NAME")

if not MONGODB_URI:
    raise ValueError("❌ Missing MONGODB_URI in .env")
if not DATABASE_NAME:
    raise ValueError("❌ Missing DATABASE_NAME in .env")

client: Optional[MongoClient] = None
db = None

def init_db():
    """
    Tạo kết nối MongoDB và gán vào biến module-level `client` và `db`.
    Gọi ở startup_event của FastAPI.
    """
    global client, db
    if client is None:
        try:
            client = MongoClient(MONGODB_URI)
            db = client[DATABASE_NAME]
            # Test kết nối
            client.admin.command("ping")
            print("✅ MongoDB connected successfully!")
        except Exception as e:
            client = None
            db = None
            print("❌ MongoDB connection failed:", e)
            # Tuỳ bạn: có thể raise để dừng app nếu kết nối fail
            # raise

def close_db():
    """Đóng client MongoDB (gọi ở shutdown_event)."""
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
