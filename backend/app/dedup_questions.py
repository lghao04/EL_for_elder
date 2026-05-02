#!/usr/bin/env python3
"""
app/dedup_questions.py
──────────────────────
Chạy 1 lần để dọn duplicate trong collection `topicwriting`.

Usage (từ thư mục app/):
    python dedup_questions.py            # dry-run
    python dedup_questions.py --execute  # xóa thật
"""

import sys
import argparse
from pathlib import Path

# Khi chạy từ trong thư mục app/, cần add parent vào path để load .env đúng chỗ
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import init_db, get_db

COLLECTION = "topicwriting"


def run(execute: bool):
    init_db()
    col = get_db()[COLLECTION]

    total = col.count_documents({})
    print(f"📊 Total documents   : {total:,}")

    print("🔍 Scanning for duplicates…")
    pipeline = [
        {
            "$group": {
                "_id":   {"question": "$question", "topic": "$topic"},
                "ids":   {"$push": "$_id"},
                "count": {"$sum": 1},
            }
        },
        {"$match": {"count": {"$gt": 1}}},
        {"$sort": {"count": -1}},
    ]
    groups = list(col.aggregate(pipeline, allowDiskUse=True))

    if not groups:
        print("✅ No duplicates found. Database is clean!")
        return

    ids_to_delete = []
    for g in groups:
        sorted_ids = sorted(g["ids"], key=lambda x: str(x))
        ids_to_delete.extend(sorted_ids[1:])

    print(f"\n{'─'*52}")
    print(f"  Duplicate groups   : {len(groups):,}")
    print(f"  Documents to DELETE: {len(ids_to_delete):,}")
    print(f"  Documents to KEEP  : {total - len(ids_to_delete):,}")
    print(f"{'─'*52}")

    print("\n📋 Top 5 duplicate groups:")
    for g in groups[:5]:
        q       = g["_id"]["question"]
        topic   = g["_id"]["topic"]
        preview = q[:75] + ("…" if len(q) > 75 else "")
        print(f"  [{g['count']}x] [{topic}] {preview}")

    if not execute:
        print("\n⚠️  DRY-RUN — chưa xóa gì.")
        print("   Chạy lại với --execute để xóa thật.\n")
        return

    print(f"\n🗑️  Deleting {len(ids_to_delete):,} documents…")
    BATCH, deleted_total = 500, 0
    for i in range(0, len(ids_to_delete), BATCH):
        batch  = ids_to_delete[i: i + BATCH]
        result = col.delete_many({"_id": {"$in": batch}})
        deleted_total += result.deleted_count
        print(f"  Batch {i // BATCH + 1:>3}: deleted {result.deleted_count:,}")

    print(f"\n✅ Done! Deleted {deleted_total:,} duplicates.")
    print(f"   Remaining: {col.count_documents({}):,} documents")

    print("\n📌 Creating unique index on (question, topic)…")
    try:
        col.create_index(
            [("question", 1), ("topic", 1)],
            unique=True,
            name="unique_question_topic",
        )
        print("   ✅ Index created.")
    except Exception as e:
        print(f"   ⚠️  Index creation failed: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--execute", action="store_true")
    args = parser.parse_args()
    run(execute=args.execute)