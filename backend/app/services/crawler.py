
# import requests
# from bs4 import BeautifulSoup
# import uuid
# import time
# from app.services.db import lessons_col

# BASE_URL = "https://learningenglish.voanews.com"
# LIST_PAGE = "https://learningenglish.voanews.com/z/976"

# def crawl_lesson_links(limit=5):
#     """
#     Lấy danh sách link bài học (title + url)
#     """
#     res = requests.get(LIST_PAGE)
#     soup = BeautifulSoup(res.text, "html.parser")
#     links = []
#     for a in soup.select("a"):
#         href = a.get("href")
#         title = a.get_text(strip=True)
#         if href and "/a/" in href and title:
#             links.append((BASE_URL + href, title))
#     return links[:limit]

# def crawl_lesson(url, title):
#     """
#     Crawl chi tiết 1 bài: transcript, audio
#     """
#     res = requests.get(url)
#     soup = BeautifulSoup(res.text, "html.parser")
#     transcript = "\n".join([p.get_text(strip=True) for p in soup.select("p")])
    
#     audio_tag = soup.find("audio")
#     audio_url = ""
#     if audio_tag:
#         src_tag = audio_tag.find("source")
#         if src_tag:
#             audio_url = src_tag.get("src", "")

#     lesson = {
#         "_id": str(uuid.uuid4()),
#         "title": title,
#         "level": "A2",
#         "audio_url": audio_url,
#         "thumbnail_url": "",
#         "transcript": transcript,
#         "exercises": []
#     }
#     return lesson

# def run_crawler(limit=5):
#     links = crawl_lesson_links(limit)
#     print(f"Tìm thấy {len(links)} bài.")
#     for url, title in links:
#         print(f"Crawl bài: {title}")
#         lesson = crawl_lesson(url, title)
#         lessons_col.insert_one(lesson)
#         print(f"Đã lưu: {title}")
#         time.sleep(1)
#     print("Hoàn tất crawl!")


# # # app/services/crawler.py
# # # đọc RSS feed, crawl từng link, parse title/audio/transcript, upsert vào Mongo)
# # import asyncio
# # import aiohttp
# # from bs4 import BeautifulSoup
# # import feedparser
# # from datetime import datetime
# # import re
# # from app.db import lessons_col

# # HEADERS = {"User-Agent": "ListeningMVP/1.0 (+you@example.com)"}

# # async def fetch(session, url):
# #     async with session.get(url, headers=HEADERS, timeout=30) as resp:
# #         resp.raise_for_status()
# #         return await resp.text()

# # async def parse_lesson_page(html, url):
# #     soup = BeautifulSoup(html, "lxml")
# #     title_el = soup.find("h1")
# #     title = title_el.get_text(strip=True) if title_el else url
# #     # audio: try <audio> or meta og:audio or direct link to .mp3
# #     audio_url = None
# #     audio_tag = soup.find("audio")
# #     if audio_tag:
# #         src = audio_tag.find("source")
# #         if src and src.get("src"):
# #             audio_url = src["src"]
# #         elif audio_tag.get("src"):
# #             audio_url = audio_tag["src"]
# #     if not audio_url:
# #         meta_audio = soup.select_one("meta[property='og:audio']")
# #         if meta_audio and meta_audio.get("content"):
# #             audio_url = meta_audio["content"]
# #     # transcript heuristic
# #     transcript_el = soup.select_one(".wsw") or soup.select_one(".transcript") or soup.find("article")
# #     transcript = transcript_el.get_text("\n", strip=True) if transcript_el else ""
# #     thumbnail = soup.select_one("meta[property='og:image']")
# #     thumbnail_url = thumbnail["content"] if thumbnail else None
# #     # level heuristic: look for "Level" text
# #     level_el = soup.find(text=re.compile(r"Level\s*\d", re.I))
# #     level = level_el.strip() if level_el else None

# #     doc_id = re.sub(r'\W+', '-', title.lower()).strip('-')[:80] or url
# #     doc = {
# #         "_id": f"lesson-{doc_id}",
# #         "title": title,
# #         "level": level or None,
# #         "audio_url": audio_url,
# #         "thumbnail_url": thumbnail_url,
# #         "transcript": transcript,
# #         "published_at": None,
# #         "fetched_at": datetime.utcnow().isoformat(),
# #         "source_url": url
# #     }
# #     return doc

# # async def fetch_and_store(session, url):
# #     try:
# #         html = await fetch(session, url)
# #         doc = await parse_lesson_page(html, url)
# #         await lessons_col.update_one({"_id": doc["_id"]}, {"$set": doc}, upsert=True)
# #         print("Saved", doc["_id"])
# #     except Exception as e:
# #         print("Error fetching", url, e)

# # async def crawl_rss(feed_url, limit=10):
# #     d = feedparser.parse(feed_url)
# #     entries = d.entries[:limit]
# #     links = [e.link for e in entries if hasattr(e, "link")]
# #     async with aiohttp.ClientSession() as session:
# #         sem = asyncio.Semaphore(5)
# #         async def sem_task(u):
# #             async with sem:
# #                 await fetch_and_store(session, u)
# #         await asyncio.gather(*(sem_task(u) for u in links))
