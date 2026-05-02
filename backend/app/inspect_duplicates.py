#!/usr/bin/env python3
"""
app/inspect_duplicates.py
─────────────────────────
Kiểm tra xem duplicate thực sự là gì trong DB.
Chạy trước dedup để hiểu rõ data.

Usage:
    python app/inspect_duplicates.py --search "hello"
    python app/inspect_duplicates.py --search "hello" --limit 10
"""

import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.db import init_db, get_db

COLLECTION = "topicwriting"


def inspect(search: str, limit: int):
    init_db()
    col = get_db()[COLLECTION]

    # Tìm tất cả docs có chứa keyword (case-insensitive)
    import re
    pattern = re.compile(re.escape(search), re.IGNORECASE)
    docs = list(col.find({"question": pattern}).limit(limit))

    print(f"\n🔍 Found {len(docs)} docs matching '{search}':\n")
    for i, d in enumerate(docs):
        q     = d.get("question", "")
        topic = d.get("topic", "")
        qid   = d.get("id", "")
        oid   = str(d["_id"])
        # Hiện repr để thấy whitespace ẩn, ký tự đặc biệt
        print(f"  [{i+1}] _id     : {oid}")
        print(f"       id      : {qid}")
        print(f"       topic   : {repr(topic)}")
        print(f"       question: {repr(q)}")
        print()

    # Kiểm tra xem có exact duplicate không
    questions = [d.get("question", "") for d in docs]
    from collections import Counter
    counts = Counter(questions)
    exact_dups = {q: c for q, c in counts.items() if c > 1}

    if exact_dups:
        print(f"⚠️  Exact duplicates (same string):")
        for q, c in exact_dups.items():
            print(f"  [{c}x] {repr(q)}")
    else:
        print("ℹ️  Không có exact duplicate — khác nhau do whitespace/case/ký tự ẩn.")
        print("   → Cần dedup theo normalized text thay vì exact match.")

        # So sánh normalized
        normalized = [q.strip().lower() for q in questions]
        norm_counts = Counter(normalized)
        norm_dups = {q: c for q, c in norm_counts.items() if c > 1}
        if norm_dups:
            print(f"\n✅ Normalized duplicates (sau khi strip + lowercase):")
            for q, c in norm_dups.items():
                print(f"  [{c}x] {q[:80]}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--search", required=True, help="Keyword để tìm trong question")
    parser.add_argument("--limit", type=int, default=20)
    args = parser.parse_args()
    inspect(search=args.search, limit=args.limit)