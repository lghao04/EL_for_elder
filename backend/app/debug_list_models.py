import os
from dotenv import load_dotenv

# Load .env trước khi khởi tạo client
load_dotenv()

from services import llm_service

print("Init/refresh client and list models...")
try:
    llm_service.reload_client()
except Exception as e:
    print("reload_client() error:", e)

print("Available models (sample):")
try:
    models = llm_service.list_models()
    for m in models:
        print(" -", m)
    if not models:
        print("No models returned (maybe quota/no permission).")
except Exception as e:
    print("list_models() failed:", e)
