# # app/create_index.py
# import sys
# import os

# sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# from app.db import init_db, close_db, get_db

# def create_indexes():
#     """Tạo indexes cho các collections"""
    
#     print("="*60)
#     print("📇 CREATING MONGODB INDEXES")
#     print("="*60)
    
#     # Initialize MongoDB
#     print("\n🔌 Connecting to MongoDB...")
#     try:
#         init_db()
#         db = get_db()
#         print("✅ MongoDB connected\n")
#     except Exception as e:
#         print(f"❌ MongoDB connection failed: {e}")
#         sys.exit(1)
    
#     try:
#         # Indexes for lessons collection
#         print("📚 Creating indexes for 'lessons' collection...")
#         lessons_col = db["lessons"]
        
#         # Index on 'id' field (custom lesson ID like 'mc160.train.0')
#         lessons_col.create_index("id", unique=True, name="idx_lesson_id")
#         print("   ✅ Created index on 'id' field")
        
#         # Text index for story search
#         lessons_col.create_index([("story", "text")], name="idx_story_text")
#         print("   ✅ Created text index on 'story' field")
        
#         # Indexes for short_lessons collection (if using separate table)
#         print("\n📝 Creating indexes for 'short_lessons' collection...")
#         short_lessons_col = db["short_lessons"]
        
#         # Index on 'original_lesson_id'
#         short_lessons_col.create_index("original_lesson_id", unique=True, name="idx_original_lesson_id")
#         print("   ✅ Created index on 'original_lesson_id' field")
        
#         # Index on 'id' field
#         short_lessons_col.create_index("id", unique=True, name="idx_short_lesson_id")
#         print("   ✅ Created index on 'id' field")
        
#         # 🆕 Indexes for user_progress collection
#         print("\n📊 Creating indexes for 'user_progress' collection...")
#         progress_col = db["user_progress"]
        
#         # Compound index on user_id + lesson_id (unique)
#         progress_col.create_index(
#             [("user_id", 1), ("lesson_id", 1)],
#             unique=True,
#             name="idx_user_lesson"
#         )
#         print("   ✅ Created compound index on 'user_id' + 'lesson_id'")
        
#         # Index on user_id for querying all user progress
#         progress_col.create_index("user_id", name="idx_user_id")
#         print("   ✅ Created index on 'user_id' field")
        
#         # Index on last_completed_at for sorting
#         progress_col.create_index("last_completed_at", name="idx_last_completed")
#         print("   ✅ Created index on 'last_completed_at' field")
        
#         # List all indexes
#         print("\n📋 Current indexes in 'lessons' collection:")
#         for idx in lessons_col.list_indexes():
#             print(f"   - {idx['name']}: {idx.get('key', {})}")
        
#         print("\n📋 Current indexes in 'user_progress' collection:")
#         for idx in progress_col.list_indexes():
#             print(f"   - {idx['name']}: {idx.get('key', {})}")
        
#         print("\n" + "="*60)
#         print("✅ All indexes created successfully!")
#         print("="*60 + "\n")
        
#     except Exception as e:
#         print(f"\n❌ Error creating indexes: {e}")
#         import traceback
#         traceback.print_exc()
#     finally:
#         close_db()

# if __name__ == "__main__":
#     create_indexes()