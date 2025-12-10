# app/importdata.py
# đọc data từ MCtest GitHub và import vào MongoDB ( bảng lessons )
import re
import requests
from db import db  

LESSONS_COLLECTION = 'lessons'
# URLs của MCtest trên GitHub
MCTEST_URLS = {
    'mc160': {
        'train': {
            'tsv': 'https://raw.githubusercontent.com/mcobzarenco/mctest/master/data/MCTest/mc160.train.tsv',
            'ans': 'https://raw.githubusercontent.com/mcobzarenco/mctest/master/data/MCTest/mc160.train.ans'
        },
        
    },
    
}

def download_file(url):
    """Download file từ URL"""
    try:
        print(f"  📥 Downloading: {url.split('/')[-1]}...")
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        print(f"  ❌ Lỗi download: {e}")
        return None

def parse_mctest_line(line):
    """
    Parse một dòng MCtest theo format chuẩn
    Format: ID\tAuthor_info\tStory\tQ1_type:Q1_text\tQ1_C1\tQ1_C2\tQ1_C3\tQ1_C4\t...
    """
    try:
        parts = line.strip().split('\t')
        
        if len(parts) < 3:
            return None
        
        # 1. Parse ID
        lesson_id = parts[0].strip()
        
        # 2. Parse Story
        story_idx = 1
        if parts[1].startswith("Author:"):
            story_idx = 2
        
        if len(parts) <= story_idx:
            return None
        
        story = parts[story_idx].strip()
        story = story.replace('\\newline', ' ')
        story = re.sub(r'\s+', ' ', story).strip()
        
        # 3. Parse Questions
        questions = []
        i = story_idx + 1
        
        while i < len(parts):
            if ':' not in parts[i]:
                i += 1
                continue
            
            q_part = parts[i].strip()
            
            if not (q_part.lower().startswith('one:') or q_part.lower().startswith('multiple:')):
                i += 1
                continue
            
            type_and_text = q_part.split(':', 1)
            q_type = type_and_text[0].strip().lower()
            q_text = type_and_text[1].strip() if len(type_and_text) > 1 else ""
            
            choices = []
            for j in range(1, 5):
                if i + j < len(parts):
                    choice = parts[i + j].strip()
                    if choice:
                        choices.append(choice)
            
            while len(choices) < 4:
                choices.append("")
            
            questions.append({
                "type": q_type,
                "question": q_text,
                "choices": choices[:4]
            })
            
            i += 5
        
        if not questions:
            return None
        
        return {
            "id": lesson_id,
            "story": story,
            "questions": questions
        }
        
    except Exception as e:
        print(f"  ⚠️  Lỗi parse line: {str(e)[:100]}")
        return None

def parse_answer_line(line):
    """Parse dòng answers: A\tB\tC\tD"""
    try:
        answers_raw = line.strip().split('\t')
        answer_map = {'A': 0, 'B': 1, 'C': 2, 'D': 3}
        
        answers = []
        for ans in answers_raw:
            ans = ans.strip().upper()
            if ans in answer_map:
                answers.append(answer_map[ans])
            else:
                answers.append(0)
        
        return answers
        
    except Exception as e:
        print(f"  ⚠️  Lỗi parse answers: {e}")
        return []

def process_dataset(tsv_url, ans_url):
    """Download và parse 1 dataset"""
    tsv_content = download_file(tsv_url)
    ans_content = download_file(ans_url)
    
    if not tsv_content or not ans_content:
        return []
    
    story_lines = tsv_content.strip().split('\n')
    answer_lines = ans_content.strip().split('\n')
    
    if len(story_lines) != len(answer_lines):
        print(f"  ⚠️  Cảnh báo: stories ({len(story_lines)}) != answers ({len(answer_lines)})")
    
    lessons = []
    
    for idx, (story_line, answer_line) in enumerate(zip(story_lines, answer_lines)):
        lesson = parse_mctest_line(story_line)
        
        if not lesson:
            print(f"  ⚠️  Bỏ qua dòng {idx + 1}")
            continue
        
        answers = parse_answer_line(answer_line)
        
        for q_idx, question in enumerate(lesson['questions']):
            if q_idx < len(answers):
                question['answer'] = answers[q_idx]
            else:
                question['answer'] = 0
        
        lessons.append(lesson)
    
    return lessons

def import_mctest_from_github():
    """Import tất cả MCtest data từ GitHub vào MongoDB"""
    
    print("=" * 70)
    print("IMPORT MCTEST DATA TỪ GITHUB VÀO MONGODB")
    print("=" * 70)
    
    # Test connection
    try:
        db.list_collection_names()
        print("✅ Database connection OK")
    except Exception as e:
        print(f"❌ Không thể kết nối database: {e}")
        return False
    
    # Lấy collection lessons
    lessons_col = db[LESSONS_COLLECTION]
    
    all_lessons = []
    
    # Process từng dataset
    for dataset_name, dataset_types in MCTEST_URLS.items():
        print(f"\n{'='*70}")
        print(f"📚 Dataset: {dataset_name.upper()}")
        print(f"{'='*70}")
        
        for data_type, urls in dataset_types.items():
            print(f"\n📖 Processing: {dataset_name}.{data_type}")
            
            lessons = process_dataset(urls['tsv'], urls['ans'])
            
            if lessons:
                print(f"  ✅ Đã parse {len(lessons)} lessons")
                all_lessons.extend(lessons)
            else:
                print(f"  ⚠️  Không có dữ liệu hợp lệ")
    
    if not all_lessons:
        print("\n❌ Không có dữ liệu để import")
        return False
    
    # Xóa dữ liệu cũ
    print(f"\n{'='*70}")
    print("🗑️  Xóa dữ liệu cũ trong database...")
    result = lessons_col.delete_many({})
    print(f"  Đã xóa {result.deleted_count} documents")
    
    # Insert vào database
    print(f"\n💾 Đang lưu {len(all_lessons)} lessons vào database...")
    try:
        result = lessons_col.insert_many(all_lessons, ordered=False)
        print(f"✅ Đã import thành công {len(result.inserted_ids)} lessons!")
    except Exception as e:
        print(f"❌ Lỗi khi insert: {e}")
        return False
    
    # Thống kê
    print(f"\n{'='*70}")
    print("📊 THỐNG KÊ")
    print(f"{'='*70}")
    
    total_count = lessons_col.count_documents({})
    print(f"✅ Tổng số lessons: {total_count}")
    
    mc160_count = lessons_col.count_documents({"id": {"$regex": "^mc160"}})
    mc500_count = lessons_col.count_documents({"id": {"$regex": "^mc500"}})
    
    print(f"\n📈 Phân loại:")
    print(f"  - MC160 (stories ~160 words): {mc160_count} lessons")
    print(f"  - MC500 (stories ~500 words): {mc500_count} lessons")
    
    train_count = lessons_col.count_documents({"id": {"$regex": "\\.train\\."}})
    dev_count = lessons_col.count_documents({"id": {"$regex": "\\.dev\\."}})
    test_count = lessons_col.count_documents({"id": {"$regex": "\\.test\\."}})
    
    print(f"\n📊 Theo split:")
    print(f"  - Train: {train_count} lessons")
    print(f"  - Dev: {dev_count} lessons")
    print(f"  - Test: {test_count} lessons")
    
    # Hiển thị 2 lessons mẫu
    print(f"\n{'='*70}")
    print("📋 LESSONS MẪU")
    print(f"{'='*70}")
    
    for i, sample in enumerate(lessons_col.find().limit(2)):
        import json
        sample_copy = sample.copy()
        sample_copy.pop('_id', None)
        
        print(f"\n{i+1}. ID: {sample_copy['id']}")
        print(f"   Story: {sample_copy['story'][:100]}...")
        print(f"   Số câu hỏi: {len(sample_copy['questions'])}")
        
        if sample_copy['questions']:
            first_q = sample_copy['questions'][0]
            print(f"\n   Câu hỏi đầu tiên:")
            print(f"   - Type: {first_q['type']}")
            print(f"   - Question: {first_q['question']}")
            print(f"   - Choices: {first_q['choices']}")
            print(f"   - Answer: {first_q.get('answer', 'N/A')} ({first_q['choices'][first_q.get('answer', 0)]})")
        
        print(f"\n   💾 Full JSON:")
        print(json.dumps(sample_copy, indent=2, ensure_ascii=False))
    
    print(f"\n{'='*70}")
    print("✅ HOÀN TẤT!")
    print(f"{'='*70}")
    
    return True

def test_single_file():
    """Test download và parse 1 file"""
    print("=" * 70)
    print("TEST DOWNLOAD & PARSE")
    print("=" * 70)
    
    test_urls = MCTEST_URLS['mc160']['train']
    
    print(f"\n📥 Test URLs:")
    print(f"  TSV: {test_urls['tsv']}")
    print(f"  ANS: {test_urls['ans']}")
    
    lessons = process_dataset(test_urls['tsv'], test_urls['ans'])
    
    if lessons:
        print(f"\n✅ Parse thành công {len(lessons)} lessons")
        
        import json
        for i, lesson in enumerate(lessons[:2]):
            print(f"\n{'='*70}")
            print(f"📋 Lesson {i+1}:")
            print(json.dumps(lesson, indent=2, ensure_ascii=False))
    else:
        print("\n❌ Parse thất bại")

if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1 and sys.argv[1] == '--test':
        test_single_file()
    else:
        import_mctest_from_github()