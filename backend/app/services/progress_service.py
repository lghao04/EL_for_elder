# app/services/progress_service.py
from datetime import datetime
from typing import Optional, List, Dict
from bson import ObjectId
from pymongo.database import Database
from datetime import datetime, timedelta
from typing import Dict


class ProgressService:
    """Service để quản lý user progress trong MongoDB"""
    
    def __init__(self, db: Database):
        self.db = db
        self.collection = db["user_progress"]
        # Tạo index để tăng performance
        self._ensure_indexes()
    
    def _ensure_indexes(self):
        """Tạo các index cần thiết"""
        try:
            # Index để tìm progress của user theo lesson
            self.collection.create_index(
                [("user_id", 1), ("lesson_id", 1)], 
                unique=True,
                name="user_lesson_idx"  # Tên cụ thể
            )
            # Index để lấy tất cả progress của user
            self.collection.create_index([("user_id", 1)], name="user_idx")
            print("✅ Progress indexes created")
        except Exception as e:
            # Ignore nếu index đã tồn tại
            if "already exists" in str(e).lower():
                print("ℹ️ Indexes already exist")
            else:
                print(f"⚠️ Index creation warning: {e}")
    
    def save_progress(
        self, 
        user_id: str, 
        lesson_id: str, 
        score: int,
        total_questions: int = 4
    ) -> Dict:
        try:
            # Tìm progress hiện tại
            existing_progress = self.collection.find_one({
                "user_id": user_id,
                "lesson_id": lesson_id
            })
            
            now = datetime.now()
            today = now.date().isoformat()
     
             
            self.db["learning_logs"].update_one(
                {
                    "user_id": user_id,
                    "date": today
                },
                {
                    "$setOnInsert": {
                        "user_id": user_id,
                        "date": today,
                        "created_at": now
                    }
                },
                upsert=True
            )

            
            if existing_progress:
                # Cập nhật progress hiện tại
                update_data = {
                    "$set": {
                        "last_score": score,
                        "updated_at": now
                    },
                    "$inc": {
                        "total_attempts": 1
                    },
                    "$max": {
                        "best_score": score  # Chỉ cập nhật nếu score mới cao hơn
                    }
                }
                
                # Nếu đạt điểm tối đa, tăng completion_count
                if score == total_questions:
                    update_data["$inc"]["completion_count"] = 1
                
                result = self.collection.update_one(
                    {"user_id": user_id, "lesson_id": lesson_id},
                    update_data
                )
                
                # Lấy document đã cập nhật
                updated_progress = self.collection.find_one({
                    "user_id": user_id,
                    "lesson_id": lesson_id
                })
                
                return self._format_progress(updated_progress)
            
            else:
                # Tạo progress mới
                new_progress = {
                    "user_id": user_id,
                    "lesson_id": lesson_id,
                    "completion_count": 1 if score == total_questions else 0,
                    "total_attempts": 1,
                    "last_score": score,
                    "best_score": score,
                    "created_at": now,
                    "updated_at": now
                }
                
                result = self.collection.insert_one(new_progress)
                new_progress["_id"] = result.inserted_id
                
                return self._format_progress(new_progress)
        
        except Exception as e:
            print(f"❌ Error saving progress: {e}")
            raise
    
    def get_user_progress(self, user_id: str, lesson_id: str) -> Optional[Dict]:
        """Lấy progress của user cho một lesson cụ thể"""
        try:
            progress = self.collection.find_one({
                "user_id": user_id,
                "lesson_id": lesson_id
            })
            
            if progress:
                return self._format_progress(progress)
            return None
        
        except Exception as e:
            print(f"❌ Error getting progress: {e}")
            raise
    
    def get_all_user_progress(self, user_id: str) -> List[Dict]:
        """Lấy tất cả progress của user"""
        try:
            progress_list = list(self.collection.find({"user_id": user_id}))
            return [self._format_progress(p) for p in progress_list]
        
        except Exception as e:
            print(f"❌ Error getting all progress: {e}")
            raise
    
    def get_user_stats(self, user_id: str) -> Dict:
        """Lấy thống kê tổng quan của user"""
        try:
            progress_list = self.get_all_user_progress(user_id)
            
            total_attempts = sum(p["total_attempts"] for p in progress_list)
            total_completed = sum(p["completion_count"] for p in progress_list)
            lessons_started = len(progress_list)
            
            # Tính điểm trung bình
            if progress_list:
                avg_best_score = sum(p["best_score"] for p in progress_list) / len(progress_list)
            else:
                avg_best_score = 0
            
            return {
                "lessons_started": lessons_started,
                "total_completed": total_completed,
                "total_attempts": total_attempts,
                "average_best_score": round(avg_best_score, 2)
            }
        
        except Exception as e:
            print(f"❌ Error getting user stats: {e}")
            raise
    
    def delete_progress(self, user_id: str, lesson_id: str) -> bool:
        """Xóa progress của user cho một lesson (dùng cho testing/reset)"""
        try:
            result = self.collection.delete_one({
                "user_id": user_id,
                "lesson_id": lesson_id
            })
            return result.deleted_count > 0
        
        except Exception as e:
            print(f"❌ Error deleting progress: {e}")
            raise
    
    def _format_progress(self, progress: Dict) -> Dict:
        """Format progress document để trả về API"""
        if not progress:
            return None
        
        # Convert datetime to string (ISO format)
        created_at = progress.get("created_at")
        updated_at = progress.get("updated_at")
        
        return {
            "id": str(progress["_id"]),
            "user_id": progress["user_id"],
            "lesson_id": progress["lesson_id"],
            "completion_count": progress.get("completion_count", 0),
            "total_attempts": progress.get("total_attempts", 0),
            "last_score": progress.get("last_score", 0),
            "best_score": progress.get("best_score", 0),
            "created_at": created_at.isoformat() if created_at else None,
            "updated_at": updated_at.isoformat() if updated_at else None
        }
    

 
    def get_user_streak(self, user_id: str) -> Dict:
        logs = list(
            self.db["learning_logs"]
            .find({"user_id": user_id})
            .sort("date", -1)
        )

        if not logs:
            return {
                "current_streak": 0,
                "last_active_date": None
            }

        dates = [
            datetime.strptime(log["date"], "%Y-%m-%d").date()
            for log in logs
        ]

        # ❗ DÙNG LOCAL DATE (KHÔNG UTC)
        today = datetime.now().date()

        streak = 0
        for i, d in enumerate(dates):
            if d == today - timedelta(days=i):
                streak += 1
            else:
                break

        return {
            "current_streak": streak,
            "last_active_date": dates[0].isoformat()
        }
