from datetime import datetime, timedelta
from typing import Optional, List, Dict
from bson import ObjectId
from pymongo.database import Database


class ProgressService:
    """Service để quản lý user progress trong MongoDB"""
    
    def __init__(self, db: Database):
        self.db = db
        self.collection = db["user_progress"]
        self.learning_logs = db["learning_logs"]
        # Tạo index để tăng performance
        self._ensure_indexes()
    
    def _ensure_indexes(self):
        """Tạo các index cần thiết"""
        try:
            # Index cho user_progress
            self.collection.create_index(
                [("user_id", 1), ("lesson_id", 1)], 
                unique=True,
                name="user_lesson_idx"
            )
            self.collection.create_index([("user_id", 1)], name="user_idx")
            
            # Index cho learning_logs (streak tracking)
            self.learning_logs.create_index(
                [("user_id", 1), ("date", 1)],
                unique=True,
                name="user_date_idx"
            )
            self.learning_logs.create_index([("user_id", 1)], name="logs_user_idx")
            
            print("✅ Progress indexes created")
        except Exception as e:
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
        """Lưu progress và cập nhật learning log cho streak"""
        try:
            existing_progress = self.collection.find_one({
                "user_id": user_id,
                "lesson_id": lesson_id
            })
            
            now = datetime.now()
            today = now.date().isoformat()
            
            # 🔥 Cập nhật learning log (cho streak tracking)
            # Chỉ tạo 1 log/ngày bất kể học bao nhiêu lesson
            self.learning_logs.update_one(
                {
                    "user_id": user_id,
                    "date": today
                },
                {
                    "$setOnInsert": {
                        "user_id": user_id,
                        "date": today,
                        "created_at": now
                    },
                    "$inc": {
                        "lessons_completed": 1  # Đếm số lesson học trong ngày
                    },
                    "$set": {
                        "last_updated": now
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
                        "best_score": score
                    }
                }
                
                # Nếu đạt điểm tối đa, tăng completion_count
                if score == total_questions:
                    update_data["$inc"]["completion_count"] = 1
                
                result = self.collection.update_one(
                    {"user_id": user_id, "lesson_id": lesson_id},
                    update_data
                )
                
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
        """Lấy thống kê tổng quan của user (bao gồm streak)"""
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
            
            # 🔥 Lấy streak info
            streak_info = self.get_user_streak(user_id)
            
            return {
                "lessons_started": lessons_started,
                "total_completed": total_completed,
                "total_attempts": total_attempts,
                "average_best_score": round(avg_best_score, 2),
                "current_streak": streak_info["current_streak"],
                "longest_streak": streak_info.get("longest_streak", 0),
                "last_active_date": streak_info["last_active_date"]
            }
        
        except Exception as e:
            print(f"❌ Error getting user stats: {e}")
            raise
    
    def get_user_streak(self, user_id: str) -> Dict:
        """
        Tính streak của user dựa trên learning logs
        
        Returns:
            {
                "current_streak": int,  # Số ngày streak hiện tại
                "longest_streak": int,  # Streak dài nhất từng đạt được
                "last_active_date": str,  # Ngày active gần nhất
                "total_active_days": int  # Tổng số ngày đã học
            }
        """
        try:
            # Lấy tất cả learning logs, sắp xếp giảm dần theo ngày
            logs = list(
                self.learning_logs
                .find({"user_id": user_id})
                .sort("date", -1)  # -1 = descending
            )
            
            if not logs:
                return {
                    "current_streak": 0,
                    "longest_streak": 0,
                    "last_active_date": None,
                    "total_active_days": 0
                }
            
            # Parse dates
            dates = [
                datetime.strptime(log["date"], "%Y-%m-%d").date()
                for log in logs
            ]
            
            # Dùng local date (không UTC)
            today = datetime.now().date()
            
            # 🔥 Tính current streak
            current_streak = 0
            
            # Kiểm tra xem có học hôm nay hoặc hôm qua không
            if dates[0] == today or dates[0] == today - timedelta(days=1):
                # Bắt đầu đếm streak
                expected_date = dates[0]
                
                for date in dates:
                    if date == expected_date:
                        current_streak += 1
                        expected_date = date - timedelta(days=1)
                    elif date < expected_date:
                        # Có gap trong streak
                        break
            
            # 🔥 Tính longest streak
            longest_streak = 0
            temp_streak = 0
            
            if dates:
                temp_streak = 1
                longest_streak = 1
                
                for i in range(len(dates) - 1):
                    diff = (dates[i] - dates[i + 1]).days
                    
                    if diff == 1:
                        # Ngày liên tiếp
                        temp_streak += 1
                        longest_streak = max(longest_streak, temp_streak)
                    else:
                        # Có gap, reset temp_streak
                        temp_streak = 1
            
            return {
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "last_active_date": dates[0].isoformat(),
                "total_active_days": len(dates)
            }
        
        except Exception as e:
            print(f"❌ Error calculating streak: {e}")
            raise
    
    def get_learning_calendar(self, user_id: str, year: int, month: int) -> List[str]:
        """
        Lấy các ngày đã học trong tháng (dùng cho calendar UI)
        
        Args:
            user_id: ID của user
            year: Năm (VD: 2025)
            month: Tháng (1-12)
        
        Returns:
            List các ngày đã học trong tháng (format: "YYYY-MM-DD")
        """
        try:
            # Tạo range cho tháng
            start_date = f"{year}-{month:02d}-01"
            
            if month == 12:
                end_year = year + 1
                end_month = 1
            else:
                end_year = year
                end_month = month + 1
            
            end_date = f"{end_year}-{end_month:02d}-01"
            
            # Query logs trong tháng
            logs = list(
                self.learning_logs.find({
                    "user_id": user_id,
                    "date": {
                        "$gte": start_date,
                        "$lt": end_date
                    }
                }).sort("date", 1)
            )
            
            return [log["date"] for log in logs]
        
        except Exception as e:
            print(f"❌ Error getting learning calendar: {e}")
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