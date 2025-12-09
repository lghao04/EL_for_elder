# backend/app/debug_mctest.py
import requests
from pathlib import Path
from dotenv import load_dotenv
import os
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

URL = os.getenv("MCTEST_URL", "https://raw.githubusercontent.com/mcobzarenco/mctest/master/data/MCTest/mc160.train.tsv")

resp = requests.get(URL, timeout=30)
print("HTTP status:", resp.status_code)
print("Detected encoding:", resp.encoding)
content = resp.content  # bytes
print("Bytes length:", len(content))

# try decode as utf-8 and fallback
try:
    text = content.decode("utf-8")
    print("Decoded as utf-8 OK")
except Exception as e:
    print("utf-8 decode failed:", e)
    try:
        text = content.decode("latin1")
        print("Decoded as latin1 OK")
    except Exception as e2:
        print("latin1 decode failed:", e2)
        raise

lines = text.splitlines()
print("Total lines:", len(lines))
print("--- show first 20 lines and column counts ---")
for i, ln in enumerate(lines[:20]):
    cols = ln.split("\t")
    print(f"[{i}] cols={len(cols)} -> {cols[:6]}{'...' if len(cols)>6 else ''}")
