# # summarize_lessons_simple.py
# """
# Script đơn giản: Thêm field 'short_story' vào collection 'lessons' hiện tại

# Chạy: python summarize_lessons_simple.py
# """

# import os
# from dotenv import load_dotenv
# from pymongo import MongoClient
# from groq import Groq
# import time

# load_dotenv()

# # Config
# MONGO_URI = os.getenv("MONGO_URI")
# DATABASE_NAME = os.getenv("DATABASE_NAME")
# GROQ_API_KEY = os.getenv("GROQ_API_KEY")
# GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# if not all([MONGO_URI, DATABASE_NAME, GROQ_API_KEY]):
#     raise ValueError("❌ Missing config in .env")

# # Connect
# print("🔌 Connecting...")
# mongo_client = MongoClient(MONGO_URI)
# db = mongo_client[DATABASE_NAME]
# groq_client = Groq(api_key=GROQ_API_KEY)
# print("✅ Connected!\n")


# def summarize_story(story: str, questions: list) -> str:
#     """Gọi Groq để rút gọn story"""
    
#     # Format questions
#     q_text = ""
#     for idx, q in enumerate(questions, 1):
#         q_text += f"\n{idx}. {q.get('question')}\n"
#         for i, choice in enumerate(q.get('choices', [])):
#             q_text += f"   {chr(65+i)}. {choice}\n"
    
#     prompt = f"""Summarize this story in 40-60% of original length. Keep ONLY information needed to answer these questions:

# STORY:
# {story}

# QUESTIONS:
# {q_text}

# Write a concise summary:"""
    
#     response = groq_client.chat.completions.create(
#         model=GROQ_MODEL,
#         messages=[
#             {"role": "system", "content": "You summarize stories concisely."},
#             {"role": "user", "content": prompt}
#         ],
#         temperature=0.3,
#         max_tokens=1000,
#     )
    
#     return response.choices[0].message.content.strip()


# def main():
#     print("="*60)
#     print("📚 ADD SHORT_STORY TO LESSONS")
#     print("="*60)
    
#     # Get lessons without short_story
#     query = {"short_story": {"$exists": False}}
#     lessons = list(db["lessons"].find(query))
    
#     print(f"\n✅ Found {len(lessons)} lessons to process")
    
#     if len(lessons) == 0:
#         print("   All lessons already have short_story!")
#         mongo_client.close()
#         return
    
#     # Show samples
#     print("\n📝 Sample:")
#     for lesson in lessons[:3]:
#         print(f"   - {lesson.get('id')}")
    
#     # Confirm
#     response = input(f"\nProcess {len(lessons)} lessons? (y/n): ")
#     if response.lower() != 'y':
#         print("❌ Cancelled")
#         mongo_client.close()
#         return
    
#     # Option to limit
#     limit = input("Process only first N? (Enter for all): ").strip()
#     if limit.isdigit():
#         lessons = lessons[:int(limit)]
    
#     # Process
#     print(f"\n🚀 Processing {len(lessons)} lessons...\n")
    
#     success = 0
#     failed = 0
    
#     for idx, lesson in enumerate(lessons, 1):
#         lesson_id = lesson.get('id', 'unknown')
#         story = lesson.get('story', '')
#         questions = lesson.get('questions', [])
        
#         print(f"[{idx}/{len(lessons)}] {lesson_id}")
        
#         if not story or not questions:
#             print(f"   ⚠️  Missing story/questions, skipping")
#             failed += 1
#             continue
        
#         try:
#             # Summarize
#             print(f"   🤖 Summarizing... ", end='', flush=True)
#             short_story = summarize_story(story, questions)
            
#             # Calculate reduction
#             reduction = round(100 - (len(short_story)/len(story)*100), 1)
#             print(f"{len(story)} → {len(short_story)} chars ({reduction}%)")
            
#             # Update MongoDB: thêm field short_story
#             db["lessons"].update_one(
#                 {"_id": lesson["_id"]},
#                 {"$set": {"short_story": short_story}}
#             )
            
#             success += 1
            
#             # Rate limit
#             if idx < len(lessons):
#                 time.sleep(1)
            
#         except Exception as e:
#             print(f"   ❌ Error: {e}")
#             failed += 1
    
#     # Summary
#     print(f"\n{'='*60}")
#     print(f"📊 DONE!")
#     print(f"{'='*60}")
#     print(f"✅ Success: {success}")
#     print(f"❌ Failed: {failed}")
#     print(f"{'='*60}\n")
    
#     mongo_client.close()


# if __name__ == "__main__":
#     try:
#         main()
#     except KeyboardInterrupt:
#         print("\n⚠️  Cancelled")
#         mongo_client.close()
#     except Exception as e:
#         print(f"\n❌ Error: {e}")
#         import traceback
#         traceback.print_exc()
#         mongo_client.close()