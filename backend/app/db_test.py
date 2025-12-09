# backend/app/db_test.py
import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
import certifi
from dotenv import load_dotenv

load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("MONGO_DB")

async def test():
    client = AsyncIOMotorClient(
        MONGO_URI,
        tls=True,
        tlsCAFile=certifi.where(),  # CA chuẩn để handshake
    )
    db = client[DB_NAME]
    
    try:
        cols = await db.list_collection_names()
        print("Collections:", cols)
        print("✅ Kết nối MongoDB thành công!")
    except Exception as e:
        print("❌ Lỗi kết nối:", e)

asyncio.run(test())
