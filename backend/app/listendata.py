# app/importdata_librispeech.py
# không dùng tới
import requests
from db import init_db, close_db, get_db

COLLECTION_NAME = 'librispeech'

HF_API_BASE = "https://datasets-server.huggingface.co/rows"
DATASET_NAME = "openslr/librispeech_asr"
CONFIG = "all"

SPLITS = {
    'test.clean': {'offset': 0, 'total': None},
}


DEFAULT_MAX_ROWS = 500
BATCH_SIZE = 100


def fetch_rows(split: str, offset: int, length: int = BATCH_SIZE) -> dict | None:
    """
    Gọi Hugging Face Datasets API để lấy rows.
    Trả về dict chứa 'rows' và 'num_rows_total', hoặc None nếu lỗi.
    """
    params = {
        "dataset": DATASET_NAME,
        "config":  CONFIG,
        "split":   split,
        "offset":  offset,
        "length":  length,
    }
    try:
        print(f"  📥 Fetching {split} offset={offset} length={length}...")
        response = requests.get(HF_API_BASE, params=params, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"  Lỗi fetch: {e}")
        return None


def parse_row(row_obj: dict) -> dict | None:
    try:
        row = row_obj.get("row", {})

        speaker_id = row.get("speaker_id")
        chapter_id = row.get("chapter_id")
        utt_id     = row.get("id")

        if not speaker_id or not chapter_id or not utt_id:
            return None

        # ✅ Lấy URL thật từ HF API response thay vì tự build
        audio_raw = row.get("audio", [])
        if isinstance(audio_raw, list):
            audio_field = audio_raw[0] if audio_raw else {}  # ← lấy phần tử đầu
        elif isinstance(audio_raw, dict):
            audio_field = audio_raw

        # HF API trả về audio dạng dict với key "src"
        audio_src  = audio_field.get("src", "")
        audio_type = audio_field.get("type", "audio/flac")
        sampling_rate = audio_field.get("sampling_rate", 16000)

        if not audio_src:
            print(f"  ⚠️  Không có audio src cho utt_id={utt_id}")
            return None

        return {
            "row_idx":    row_obj.get("row_idx"),
            "speaker_id": speaker_id,
            "chapter_id": chapter_id,
            "utt_id":     utt_id,
            "text":       row.get("text", ""),
            "audio": {
                "src":           audio_src,
                "type":          audio_type,
                "sampling_rate": sampling_rate,
            }
        }

    except Exception as e:
        print(f"❌ Lỗi parse row: {str(e)[:120]}")
        return None


def download_split(split: str, max_rows: int | None = None) -> list[dict]:
    """
    Download toàn bộ (hoặc tối đa max_rows) của một split, tự động phân trang.
    """
    all_docs = []
    offset = 0

    # Lấy tổng số rows từ request đầu tiên
    first = fetch_rows(split, offset=0, length=1)
    if not first:
        print(f"   Không thể fetch split '{split}'")
        return []

    total_available = first.get("num_rows_total", 0)
    total_to_fetch  = min(total_available, max_rows) if max_rows else total_available
    print(f"    Split '{split}': {total_available} rows có sẵn, sẽ tải {total_to_fetch} rows")

    while offset < total_to_fetch:
        length = min(BATCH_SIZE, total_to_fetch - offset)
        data   = fetch_rows(split, offset=offset, length=length)

        if not data:
            print(f"  ⚠️  Dừng tại offset={offset} do lỗi fetch")
            break

        rows = data.get("rows", [])
        if not rows:
            break

        for row_obj in rows:
            doc = parse_row(row_obj)
            if doc:
                doc["split_name"] = split
                all_docs.append(doc)

        offset += len(rows)
        print(f"  ✅ Đã parse {offset}/{total_to_fetch} rows...")

    return all_docs


def import_librispeech(
    splits: list[str] | None = None,
    max_rows_per_split: int | None = DEFAULT_MAX_ROWS,
    clear_existing: bool = True,
):
    """
    Import LibriSpeech data từ Hugging Face vào MongoDB.

    Args:
        splits:               Danh sách splits cần tải (mặc định: test.clean).
        max_rows_per_split:   Giới hạn số rows mỗi split (None = tất cả).
        clear_existing:       Xóa collection cũ trước khi insert.
    """
    print("=" * 70)
    print("IMPORT LIBRISPEECH DATA TỪ HUGGING FACE VÀO MONGODB")
    print("=" * 70)

    init_db()
    try:
        db = get_db()
        print(" Database connection OK")
    except RuntimeError as e:
        print(f" {e}")
        return False

    col = db[COLLECTION_NAME]

    if clear_existing:
        deleted = col.delete_many({}).deleted_count
        print(f"🗑️  Đã xóa {deleted} documents cũ trong '{COLLECTION_NAME}'")

    target_splits = splits or list(SPLITS.keys())
    all_docs = []

    for split in target_splits:
        print(f"\n{'='*70}")
        print(f" Split: {split}")
        print(f"{'='*70}")
        docs = download_split(split, max_rows=max_rows_per_split)
        print(f"  → {len(docs)} documents từ split '{split}'")
        all_docs.extend(docs)

    if not all_docs:
        print("\n Không có dữ liệu để import")
        close_db()
        return False

    print(f"\nĐang lưu {len(all_docs)} documents vào collection '{COLLECTION_NAME}'...")
    try:
        result = col.insert_many(all_docs, ordered=False)
        print(f"✅ Đã insert thành công {len(result.inserted_ids)} documents!")
    except Exception as e:
        print(f" Lỗi khi insert: {e}")
        close_db()
        return False

    col.create_index("speaker_id")
    col.create_index("split_name")
    print(" Đã tạo indexes: speaker_id, split_name")

    print(f"\n{'='*70}")
    print(" THỐNG KÊ")
    print(f"{'='*70}")
    print(f" Tổng documents: {col.count_documents({})}")
    for split in target_splits:
        print(f"  - {split}: {col.count_documents({'split_name': split})} documents")

    print(f"\n{'='*70}")
    print("📋 DOCUMENTS MẪU")
    print(f"{'='*70}")
    import json
    for i, sample in enumerate(col.find().limit(2)):
        sample.pop("_id", None)
        print(f"\n{i+1}. row_idx={sample.get('row_idx')} | speaker={sample.get('speaker_id')} | split={sample.get('split_name')}")
        print(f"   text     : {sample.get('text', '')[:120]}")
        print(f"   audio url: {sample.get('audio', {}).get('src', '')[:120]}")
        print(f"\n   💾 Full JSON:")
        print(json.dumps(sample, indent=2, ensure_ascii=False))

    print(f"\n{'='*70}")
    print("✅ HOÀN TẤT!")
    print(f"{'='*70}")

    close_db()
    return True


def test_fetch():
    """Test nhanh: fetch 3 rows và in ra để kiểm tra cấu trúc + audio URL thật"""
    print("=" * 70)
    print("TEST FETCH 3 ROWS (không lưu DB)")
    print("=" * 70)

    data = fetch_rows("test.clean", offset=0, length=3)
    if not data:
        print("❌ Fetch thất bại")
        return

    import json
    print(f"num_rows_total: {data.get('num_rows_total')}\n")
    for row_obj in data.get("rows", []):
        doc = parse_row(row_obj)
        if doc:
            print(f"utt_id : {doc['utt_id']}")
            print(f"text   : {doc['text'][:80]}")
            print(f"audio  : {doc['audio']['src'][:120]}")
            print()


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        test_fetch()

    elif len(sys.argv) > 1 and sys.argv[1] == "--limit":
        limit = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_MAX_ROWS
        import_librispeech(max_rows_per_split=limit)

    else:
        import_librispeech()