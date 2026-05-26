# app/import_quora.py
# Load dataset toughdata/quora-question-answer-dataset từ HuggingFace,
# `topicwriting`.
#
# Ví dụ document sau khi import:
#   { "id": "quora_0", "question": "Why whenever I get in the shower..." }

from datasets import load_dataset
from db import init_db, get_db

COLLECTION_NAME = "topicwriting"


def clean_text(text: str) -> str:
    if not text:
        return ""
    return " ".join(text.split()).strip()


def import_quora(limit: int | None = None) -> None:
    print("=" * 55)
    print("IMPORT QUORA DATASET → topicwriting")
    print("=" * 55)

    # ── Kết nối DB ──
    init_db()
    db = get_db()
    col = db[COLLECTION_NAME]
    print("✅ Kết nối MongoDB OK")

    # ── Load dataset ──
    print("\n📥 Đang load dataset toughdata/quora-question-answer-dataset ...")
    try:
        ds = load_dataset("toughdata/quora-question-answer-dataset", split="train")
        print(f"✅ Load thành công: {len(ds):,} rows")
    except Exception as e:
        print(f"❌ Lỗi load dataset: {e}")
        return

    # ── Xử lý: chỉ lấy cột question ──
    print("\n🔄 Xử lý dữ liệu (chỉ lấy cột question)...")
    docs = []
    skipped = 0

    rows = list(ds) if not limit else list(ds)[:limit]

    for idx, row in enumerate(rows):
        question = clean_text(row.get("question", ""))

        if not question:
            skipped += 1
            continue

        docs.append({
            "id":       f"quora_{idx}",
            "question": question,
        })

        if (idx + 1) % 50_000 == 0:
            print(f"   ⏳ Đã xử lý {idx + 1:,} rows...")

    print(f"✅ Hợp lệ: {len(docs):,}  |  Bỏ qua (rỗng): {skipped}")

    # ── Xóa data cũ ──
    deleted = col.delete_many({}).deleted_count
    print(f"\n🗑️  Xóa {deleted:,} documents cũ")

    # ── Insert theo batch ──
    BATCH = 5_000
    print(f"💾 Inserting {len(docs):,} documents (batch={BATCH:,})...")
    inserted = 0

    for i in range(0, len(docs), BATCH):
        batch = docs[i : i + BATCH]
        try:
            result = col.insert_many(batch, ordered=False)
            inserted += len(result.inserted_ids)
        except Exception as e:
            print(f"  ⚠️  Batch {i//BATCH + 1} lỗi: {e}")

        if (i // BATCH + 1) % 10 == 0 or (i + BATCH) >= len(docs):
            print(f"   ⏳ {min(i + BATCH, len(docs)):,} / {len(docs):,}")

    print(f"✅ Inserted: {inserted:,}")

    # ── Index ──
    col.create_index("id", unique=True)
    print("📌 Đã tạo index trên field `id`")

    # ── Sample ──
    print("\n📋 SAMPLE (3 documents đầu):")
    for i, doc in enumerate(col.find({}, {"_id": 0}).limit(3), 1):
        print(f"\n  {i}. id: {doc['id']}")
        print(f"     question: {doc['question'][:120]}")

    print(f"\n✅ HOÀN TẤT — {col.count_documents({}):,} documents trong '{COLLECTION_NAME}'")


if __name__ == "__main__":
    import sys
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    import_quora(limit=limit)