import re
import time
import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
from pymongo import MongoClient
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

# =========================
# CONFIG
# =========================
BASE_URL = "https://www.esl-lab.com/"

LEVELS = {
    "easy":         "https://www.esl-lab.com/easy/",
    # "intermediate": "https://www.esl-lab.com/intermediate/",
    # "difficult":    "https://www.esl-lab.com/difficult/",
}

MONGO_URI       = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME         = os.getenv("DATABASE_NAME", "listening_db")
COLLECTION_NAME = "datalistening"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.esl-lab.com/"
}

DELAY_BETWEEN_REQUESTS = 3
MAX_RETRIES            = 5
REQUEST_TIMEOUT        = 30

# Sentinel texts xuất hiện trong <section> nhưng không phải câu hỏi
SECTION_SKIP = {
    "great job!", "great job", "nice try! review your answers.",
    "nice try!", "review your answers.", "good try.", "good try",
    "[copy]", ""
}

# =========================
# DB INIT
# =========================
client     = MongoClient(MONGO_URI)
db         = client[DB_NAME]
collection = db[COLLECTION_NAME]

def utcnow():
    return datetime.now(timezone.utc)


# =========================
# HELPER: GET với retry
# =========================
def safe_get(url):
    for attempt in range(MAX_RETRIES):
        try:
            res = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            if res.status_code == 200:
                return res
            print(f"  [WARN] HTTP {res.status_code} — {url} (attempt {attempt+1})")
        except Exception as e:
            print(f"  [ERROR] {e} (attempt {attempt+1})")
        time.sleep(2 ** attempt)
    return None


# =========================
# GET ALL LESSON LINKS
# =========================
def get_lesson_links(category_url, level):
    res = safe_get(category_url)
    if not res:
        return []

    soup   = BeautifulSoup(res.text, "lxml")
    prefix = f"https://www.esl-lab.com/{level}/"

    links = set()
    for a in soup.select("a[href]"):
        full = urljoin(BASE_URL, a["href"])
        if (
            full.startswith(prefix)
            and full != prefix
            and full.count("/") >= 5
            and not full.endswith(f"/{level}/")
            and "-script" not in full   # bỏ trang script
            and "-games"  not in full   # bỏ trang games
        ):
            links.add(full)

    return sorted(links)


# =========================
# PARSE TITLE
# =========================
def parse_title(soup, url):
    """
    Trang có cấu trúc:
        <h1>General Listening Quiz</h1>
        <h2>"Movie Rentals"</h2>   ← title thực sự, có dấu ngoặc kép
    Ưu tiên lấy h2 có ngoặc kép, fallback về h1.
    """
    # Tìm h2 có ngoặc kép (ASCII hoặc Unicode curly quotes)
    for tag in soup.find_all("h2"):
        text = tag.get_text(strip=True)
        if re.search(r'["\u201c\u201d]', text):
            # Bỏ dấu ngoặc kép bao quanh
            clean = re.sub(r'^["\u201c]+|["\u201d]+$', '', text).strip()
            if clean:
                return clean

    # Fallback: h1
    h1 = soup.find("h1")
    if h1:
        text = h1.get_text(strip=True)
        if text and text.lower() != "general listening quiz":
            return text

    # Fallback cuối: lấy từ URL slug
    slug = url.rstrip("/").split("/")[-1]
    return slug.replace("-", " ").title()


# =========================
# PARSE AUDIO URL
# =========================
def find_audio_url(soup, res_text):
    # Cách 1: thẻ <audio>
    audio_tag = soup.find("audio")
    if audio_tag:
        source = audio_tag.find("source")
        if source and source.get("src"):
            return source["src"]
        if audio_tag.get("src"):
            return audio_tag["src"]

    # Cách 2: URL .mp3 plain text trong HTML (dạng mới nhất)
    mp3_matches = re.findall(r'https?://[^\s\'"<>\)]+\.mp3', res_text)
    if mp3_matches:
        return mp3_matches[0].split("?")[0]

    # Cách 3: thẻ <a href="*.mp3">
    for a in soup.find_all("a", href=True):
        if a["href"].endswith(".mp3"):
            return a["href"]

    return None


# =========================
# PARSE QUESTIONS — 4 LOẠI
# =========================
def parse_questions(soup):
    """
    4 format câu hỏi thực tế trên ESL Lab:

    [FORMAT A] Basic English — Listening Script plain text:
        "1. What time...? >>> A. It starts... OR B. It ends..."
        → question + 2 options + answer (nếu có **bold**)
        quiz_type: "short_answer"

    [FORMAT B] Easy/Int/Diff MỚI — JS quiz, câu hỏi dạng <section><p>Question?</p>:
        Options ẩn trong JS, không lấy được.
        → question only, options=[], answer=""
        quiz_type: "open_question"

    [FORMAT C] Easy/Int cũ — JS word-matching, quiz dùng <section><h4>Word</h4>:
        Các từ/cụm từ ngắn trong h4 là "items" cần phân loại (like/dislike, v.v.)
        Không có câu hỏi dạng sentence — lưu lại dưới dạng "word_match" items.
        quiz_type: "word_match"

    [FORMAT D] Multiple-choice truyền thống (một số bài cũ):
        "1. Where does...?  A. ...  B. ..."
        quiz_type: "multiple_choice"
    """
    questions = []
    full_text = soup.get_text(separator="\n")

    # ── FORMAT A: short-answer  "N. stmt >>> A. x OR B. y" ──────────────
    sa_re = re.compile(
        r'^\s*\d+\.\s+(.+?)\s*>{2,4}\s*'
        r'\*{0,2}[Aa]\*{0,2}\.\s*(.+?)\s+OR\s+'
        r'\*{0,2}[Bb]\*{0,2}\.\s*(.+)',
        re.MULTILINE
    )
    for m in sa_re.finditer(full_text):
        raw    = m.group(0)
        answer = "A" if re.search(r'\*\*[Aa]\*\*', raw) else \
                 "B" if re.search(r'\*\*[Bb]\*\*', raw) else ""
        questions.append({
            "question":  m.group(1).strip(),
            "options":   [f"A. {m.group(2).strip()}", f"B. {m.group(3).strip()}"],
            "answer":    answer,
            "quiz_type": "short_answer",
        })
    if questions:
        return questions

    # ── FORMAT B: Easy mới — <section><p>Question?</p> ──────────────────
    for section in soup.find_all("section"):
        for p in section.find_all("p"):
            text = p.get_text(strip=True)
            if text.lower() in SECTION_SKIP:
                continue
            if len(text) >= 10 and text.endswith("?"):
                questions.append({
                    "question":  text,
                    "options":   [],
                    "answer":    "",
                    "quiz_type": "open_question",
                })
    if questions:
        return questions

    # ── FORMAT C: Easy cũ — <section><h4>Word/Phrase</h4> ───────────────
    # Các h4 trong section là "items" của word-match quiz (vd: Action, Comedies…)
    h4_items = []
    for section in soup.find_all("section"):
        for h4 in section.find_all("h4"):
            text = h4.get_text(strip=True)
            if text and text.lower() not in SECTION_SKIP:
                h4_items.append(text)

    if h4_items:
        # Tạo 1 question tổng hợp đại diện cho toàn bộ word-match quiz
        questions.append({
            "question":  "Listen and classify each item you hear.",
            "options":   h4_items,   # các từ/cụm cần phân loại
            "answer":    "",
            "quiz_type": "word_match",
        })
        return questions

    # ── FORMAT D: Multiple-choice truyền thống ───────────────────────────
    mc_re     = re.compile(r'^\s*(\d+)\.\s+(.+?)(?=\n\s*\d+\.|\Z)', re.MULTILINE | re.DOTALL)
    option_re = re.compile(r'^\s*([A-D])[.)]\s+(.+)', re.MULTILINE)
    answer_re = re.compile(r'Answer:\s*([A-D])', re.IGNORECASE)

    for m in mc_re.finditer(full_text):
        block         = m.group(0)
        lines         = block.strip().splitlines()
        question_text = re.sub(r'^\d+\.\s*', '', lines[0].strip()).strip()
        if not question_text:
            continue
        options = []
        answer  = ""
        for line in lines[1:]:
            opt = option_re.match(line)
            if opt:
                options.append(f"{opt.group(1)}. {opt.group(2).strip()}")
            ans = answer_re.search(line)
            if ans:
                answer = ans.group(1).upper()
        if len(options) >= 2:
            questions.append({
                "question":  question_text,
                "options":   options,
                "answer":    answer,
                "quiz_type": "multiple_choice",
            })

    return questions


# =========================
# PARSE TOPIC
# =========================
def parse_topic(soup):
    """
    Bảng thông tin bài có dạng:
        Level | Topic | Speakers | Length  (dòng <th>)
        Easy  | Movies| Man-Woman| 00:32   (dòng <td>)
    """
    table = soup.find("table")
    if not table:
        return ""

    headers = [th.get_text(strip=True).lower() for th in table.find_all("th")]
    cells   = [td.get_text(strip=True)         for td in table.find_all("td")]

    try:
        idx = headers.index("topic")
        return cells[idx] if idx < len(cells) else ""
    except ValueError:
        # Không có <th>, fallback: cột thứ 2 (index 1)
        return cells[1] if len(cells) >= 2 else ""


# =========================
# PARSE SCRIPT PAGE
# =========================
def parse_script(lesson_url):
    """
    Mỗi bài có trang script riêng tại URL dạng:
        /easy/meeting-new-neighbors/  →  /easy/meeting-new-neighbors-script/

    Trang script chứa transcript hội thoại dạng:
        **Speaker:** Text content...

    Trả về dict:
    {
        "script_url": "https://...-script/",
        "lines": [
            {"speaker": "Man",   "text": "Hey, Kathy..."},
            {"speaker": "Woman", "text": "Okay. What kind..."},
        ],
        "full_text": "Man: Hey, Kathy...\\nWoman: Okay..."
    }
    Trả về None nếu không có trang script.
    """
    script_url = lesson_url.rstrip("/") + "-script/"

    res = safe_get(script_url)
    if not res:
        return None

    soup = BeautifulSoup(res.text, "lxml")

    # Xác nhận đúng trang script: tìm "script" trong BẤT KỲ h1/h2 nào
    # (h1 thường là "General Listening Quiz", h2 mới chứa "– Script")
    all_headings = soup.find_all(["h1", "h2"])
    is_script_page = any(
        "script" in tag.get_text(strip=True).lower()
        for tag in all_headings
    )
    if not is_script_page:
        return None

    lines     = []
    full_text = ""

    # HTML thực tế có 2 dạng:
    #
    # Dạng MỚI (trang mới): speaker và text ở 2 thẻ <p> riêng biệt:
    #   <p><strong>Sophie:</strong></p>
    #   <p>Why. Hello there, I'm Sophie...</p>
    #   <p><strong>Alex:</strong></p>
    #   <p>Hi, Sophie. Thanks...</p>
    #
    # Dạng CŨ (trang cũ): speaker và text cùng 1 thẻ <p>:
    #   <p><strong>Man</strong>: Hey, Kathy...</p>
    #   <p><strong>Woman</strong>: Okay. What kind...</p>

    all_p = soup.find_all("p")

    current_speaker = None
    for p in all_p:
        strong = p.find("strong")
        p_text = p.get_text(strip=True)

        if strong:
            speaker_candidate = strong.get_text(strip=True).rstrip(":").strip()

            # Lấy text còn lại sau <strong> trong cùng <p>
            strong_copy = p.__copy__()
            for s in strong_copy.find_all("strong"):
                s.extract()
            inline_text = strong_copy.get_text(separator=" ", strip=True).lstrip(":").strip()

            if inline_text:
                # Dạng cũ: speaker + text cùng 1 thẻ <p>
                lines.append({"speaker": speaker_candidate, "text": inline_text})
                full_text    += f"{speaker_candidate}: {inline_text}\n"
                current_speaker = None  # reset, không chờ p tiếp theo
            else:
                # Dạng mới: chỉ có speaker, text ở <p> kế tiếp
                current_speaker = speaker_candidate

        elif current_speaker and p_text:
            # <p> text tiếp theo sau <p><strong>Speaker:</strong></p>
            lines.append({"speaker": current_speaker, "text": p_text})
            full_text      += f"{current_speaker}: {p_text}\n"
            current_speaker = None  # reset sau khi đã lấy text

    if not lines:
        return None

    print(f"  [OK]   Script   : {len(lines)} lines — {script_url}")
    return {
        "script_url": script_url,
        "lines":      lines,
        "full_text":  full_text.strip(),
    }


# =========================
# PARSE LESSON PAGE
# =========================
def parse_lesson(url, level):
    print(f"\n[CRAWL] {url}")
    res = safe_get(url)
    if not res:
        print("  [FAIL] Không lấy được trang")
        return None

    soup = BeautifulSoup(res.text, "lxml")

    title     = parse_title(soup, url)
    audio_url = find_audio_url(soup, res.text)
    questions = parse_questions(soup)
    topic     = parse_topic(soup)
    script    = parse_script(url)   # fetch trang -script/ riêng

    print(f"  [OK]   Title    : {title}")
    print(f"  [OK]   Audio    : {audio_url or 'không tìm thấy'}")
    print(f"  [OK]   Questions: {len(questions)} câu "
          f"(type: {questions[0]['quiz_type'] if questions else 'N/A'})")
    if not script:
        print(f"  [INFO] Script   : không có trang script")

    return {
        "title":      title,
        "level":      level,
        "topic":      topic,
        "audio_url":  audio_url,
        "questions":  questions,
        "script":     script,   # None nếu không có trang script
        "source_url": url,
        "created_at": utcnow(),
    }


# =========================
# MAIN PIPELINE
# =========================
def run():
    for level, category_url in LEVELS.items():
        print(f"\n{'='*50}")
        print(f"Level: {level.upper()} — {category_url}")
        print(f"{'='*50}")

        links = get_lesson_links(category_url, level)
        print(f"Tìm thấy {len(links)} bài học\n")

        for i, link in enumerate(links, 1):
            print(f"[{i}/{len(links)}]", end=" ")

            if collection.find_one({"source_url": link}):
                print(f"[SKIP] Đã có trong DB: {link}")
                continue

            try:
                data = parse_lesson(link, level)
                if data:
                    collection.insert_one(data)
                    print(f"  [SAVED] {data['title']}")
            except Exception as e:
                print(f"  [ERROR] {e}")

            time.sleep(DELAY_BETWEEN_REQUESTS)

    print("\n✅ Done!")


# =========================
# RE-CRAWL: items có questions = []
# =========================
def recrawl_missing_questions():
    """
    Tìm tất cả document trong DB có questions rỗng,
    crawl lại và update. Giữ nguyên _id và created_at gốc.

    Chạy:  python crawler.py recrawl
    """
    query = {
        "$or": [
            {"questions": {"$exists": False}},
            {"questions": {"$size": 0}},
        ]
    }

    items = list(collection.find(query, {"_id": 1, "source_url": 1, "level": 1}))
    total = len(items)

    if total == 0:
        print("✅ Không có bài nào thiếu questions.")
        return

    print(f"\n{'='*50}")
    print(f"Re-crawl {total} bài đang thiếu questions")
    print(f"{'='*50}\n")

    success = failed = still_empty = 0

    for i, item in enumerate(items, 1):
        url    = item.get("source_url", "")
        level  = item.get("level", "unknown")
        doc_id = item["_id"]

        print(f"[{i}/{total}]", end=" ")

        if not url:
            print(f"  [SKIP] Không có source_url (id={doc_id})")
            failed += 1
            continue

        try:
            data = parse_lesson(url, level)

            if data is None:
                print("  [FAIL] Không crawl được")
                failed += 1
            elif not data["questions"]:
                print(f"  [WARN] Vẫn không tìm được questions: {url}")
                still_empty += 1
            else:
                collection.update_one(
                    {"_id": doc_id},
                    {"$set": {
                        "title":      data["title"],
                        "topic":      data["topic"],
                        "audio_url":  data["audio_url"],
                        "questions":  data["questions"],
                        "script":     data["script"],
                        "updated_at": utcnow(),
                    }}
                )
                print(f"  [UPDATED] {data['title']} — {len(data['questions'])} questions")
                success += 1

        except Exception as e:
            print(f"  [ERROR] {e}")
            failed += 1

        time.sleep(DELAY_BETWEEN_REQUESTS)

    print(f"\n{'='*50}")
    print(f"✅ Re-crawl xong:")
    print(f"   Updated:     {success}")
    print(f"   Still empty: {still_empty}")
    print(f"   Failed:      {failed}")
    print(f"{'='*50}")


# =========================
# RE-CRAWL: items chưa có script
# =========================
def recrawl_missing_script():
    """
    Tìm tất cả document trong DB chưa có field script (hoặc script=None),
    fetch trang -script/ và update. Giữ nguyên toàn bộ field khác.

    Chạy:  python crawler.py recrawl_script
    """
    query = {
        "$or": [
            {"script": {"$exists": False}},
            {"script": None},
        ]
    }

    items = list(collection.find(query, {"_id": 1, "source_url": 1, "title": 1}))
    total = len(items)

    if total == 0:
        print("✅ Tất cả bài đã có script.")
        return

    print(f"\n{'='*50}")
    print(f"Fetch script cho {total} bài")
    print(f"{'='*50}\n")

    success = failed = no_script = 0

    for i, item in enumerate(items, 1):
        url    = item.get("source_url", "")
        doc_id = item["_id"]
        title  = item.get("title", "?")

        print(f"[{i}/{total}] {title}")

        if not url:
            print(f"  [SKIP] Không có source_url")
            failed += 1
            continue

        try:
            script = parse_script(url)

            if script:
                collection.update_one(
                    {"_id": doc_id},
                    {"$set": {
                        "script":     script,
                        "updated_at": utcnow(),
                    }}
                )
                success += 1
            else:
                # Đánh dấu đã thử nhưng không có script page
                collection.update_one(
                    {"_id": doc_id},
                    {"$set": {"script": None, "updated_at": utcnow()}}
                )
                print(f"  [INFO] Không có trang script")
                no_script += 1

        except Exception as e:
            print(f"  [ERROR] {e}")
            failed += 1

        time.sleep(DELAY_BETWEEN_REQUESTS)

    print(f"\n{'='*50}")
    print(f"✅ Fetch script xong:")
    print(f"   Có script:    {success}")
    print(f"   Không có:     {no_script}")
    print(f"   Failed:       {failed}")
    print(f"{'='*50}")



# FIX TITLES

def fix_titles():
    """
    Tìm tất cả document có title sai (= "General Listening Quiz" hoặc rỗng),
    fetch lại trang và update title đúng từ h2 có ngoặc kép.
    KHÔNG đụng đến questions hay các field khác.

    Chạy:  python crawler.py fix_titles
    """
    BAD_TITLES = re.compile(
        r'^(general listening quiz|basic english quiz|unknown|)$',
        re.IGNORECASE
    )

    items = list(collection.find(
        {},
        {"_id": 1, "source_url": 1, "title": 1}
    ))

    # Lọc ra những bài có title sai
    to_fix = [it for it in items if BAD_TITLES.match((it.get("title") or "").strip())]
    total  = len(to_fix)

    if total == 0:
        print("✅ Tất cả title đã đúng, không cần fix.")
        return

    print(f"\n{'='*50}")
    print(f"Fix title cho {total} bài")
    print(f"{'='*50}\n")

    success = failed = 0

    for i, item in enumerate(to_fix, 1):
        url    = item.get("source_url", "")
        doc_id = item["_id"]
        old_title = item.get("title", "")

        print(f"[{i}/{total}]", end=" ")

        if not url:
            print(f"  [SKIP] Không có source_url")
            failed += 1
            continue

        try:
            res = safe_get(url)
            if not res:
                print(f"  [FAIL] Không lấy được trang: {url}")
                failed += 1
                continue

            soup      = BeautifulSoup(res.text, "lxml")
            new_title = parse_title(soup, url)

            if BAD_TITLES.match(new_title.strip()):
                print(f"  [WARN] Vẫn không lấy được title đúng: {url}")
                failed += 1
            else:
                collection.update_one(
                    {"_id": doc_id},
                    {"$set": {
                        "title":      new_title,
                        "updated_at": utcnow(),
                    }}
                )
                print(f"  [FIXED] '{old_title}' → '{new_title}'")
                success += 1

        except Exception as e:
            print(f"  [ERROR] {e}")
            failed += 1

        time.sleep(DELAY_BETWEEN_REQUESTS)

    print(f"\n{'='*50}")
    print(f"✅ Fix title xong:")
    print(f"   Fixed:  {success}")
    print(f"   Failed: {failed}")
    print(f"{'='*50}")


# =========================
# ENTRY POINT
# =========================
if __name__ == "__main__":
    import sys

    cmd = sys.argv[1] if len(sys.argv) > 1 else ""

    if cmd == "recrawl":
        # python crawler.py recrawl         — fix bài thiếu questions
        recrawl_missing_questions()
    elif cmd == "recrawl_script":
        # python crawler.py recrawl_script  — fetch script cho bài chưa có
        recrawl_missing_script()
    elif cmd == "fix_titles":
        # python crawler.py fix_titles      — fix title "General Listening Quiz"
        fix_titles()
    elif cmd == "fix_all":
        # python crawler.py fix_all         — chạy tất cả theo thứ tự
        fix_titles()
        recrawl_missing_questions()
        recrawl_missing_script()
    else:
        run()