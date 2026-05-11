"""
StreakService
============
Quy tắc:
- Mỗi ngày user nộp bài đúng >= 1 câu → log ngày đó là "active".
- Nghỉ 1 ngày (không có log hôm qua) → streak về 0.
- streak > 1 VÀ hôm nay là ngày active MỚI → trả về streak_bonus=True
  để ActivityService gọi ScoreService.add_streak_bonus().
"""

from datetime import datetime, timedelta
from typing import Dict, List
from pymongo.database import Database


class StreakService:

    def __init__(self, db: Database):
        self.db = db
        self.logs = db["learning_logs"]
        self._ensure_indexes()

    def _ensure_indexes(self):
        try:
            self.logs.create_index(
                [("user_id", 1), ("date", 1)],
                unique=True,
                name="streak_user_date_idx"
            )
            self.logs.create_index([("user_id", 1)], name="streak_user_idx")
        except Exception as e:
            if "already exists" not in str(e).lower():
                print(f"⚠️  StreakService index: {e}")

    # ------------------------------------------------------------------
    # RECORD ACTIVITY  — gọi sau khi xác nhận user đúng >= 1 câu
    # ------------------------------------------------------------------

    def record_activity(self, user_id: str, skill: str) -> Dict:
        """
        Ghi nhận ngày học.

        Returns:
            {
                "is_new_day":     bool,
                "current_streak": int,
                "streak_bonus":   bool   # True → ScoreService cộng +10 điểm
            }
        """
        today = datetime.now().date().isoformat()
        now = datetime.now()

        existing = self.logs.find_one({"user_id": user_id, "date": today})
        is_new_day = existing is None

        # skills_done không được ở cả $setOnInsert lẫn $addToSet cùng lúc → conflict code 40.
        # Giải pháp: dùng 2 bước — insert trước nếu chưa có, rồi update.
        if is_new_day:
            # Document chưa tồn tại → insert_one để khởi tạo đầy đủ
            try:
                self.logs.insert_one({
                    "user_id":     user_id,
                    "date":        today,
                    "created_at":  now,
                    "last_updated": now,
                    "skills_done": [skill],
                    "submissions": 1,
                })
            except Exception:
                # Race condition: document vừa được insert bởi request khác → update bình thường
                self.logs.update_one(
                    {"user_id": user_id, "date": today},
                    {
                        "$addToSet": {"skills_done": skill},
                        "$inc":      {"submissions": 1},
                        "$set":      {"last_updated": now},
                    },
                )
        else:
            # Document đã tồn tại → update trực tiếp, không cần $setOnInsert
            self.logs.update_one(
                {"user_id": user_id, "date": today},
                {
                    "$addToSet": {"skills_done": skill},
                    "$inc":      {"submissions": 1},
                    "$set":      {"last_updated": now},
                },
            )

        streak_info = self.get_streak(user_id)
        current_streak = streak_info["current_streak"]

        # Thưởng: ngày mới + streak > 1
        streak_bonus = is_new_day and current_streak > 1

        return {
            "is_new_day": is_new_day,
            "current_streak": current_streak,
            "streak_bonus": streak_bonus,
        }

    # ------------------------------------------------------------------
    # GET STREAK
    # ------------------------------------------------------------------

    def get_streak(self, user_id: str) -> Dict:
        logs = list(self.logs.find({"user_id": user_id}).sort("date", -1))

        if not logs:
            return {
                "current_streak": 0,
                "longest_streak": 0,
                "last_active_date": None,
                "total_active_days": 0,
            }

        dates = [
            datetime.strptime(log["date"], "%Y-%m-%d").date()
            for log in logs
        ]

        today = datetime.now().date()
        yesterday = today - timedelta(days=1)

        # current streak
        current_streak = 0
        if dates[0] in (today, yesterday):
            expected = dates[0]
            for d in dates:
                if d == expected:
                    current_streak += 1
                    expected = d - timedelta(days=1)
                else:
                    break

        # longest streak
        longest = 1
        temp = 1
        for i in range(len(dates) - 1):
            if (dates[i] - dates[i + 1]).days == 1:
                temp += 1
                if temp > longest:
                    longest = temp
            else:
                temp = 1
        longest = max(longest, current_streak)

        return {
            "current_streak": current_streak,
            "longest_streak": longest,
            "last_active_date": dates[0].isoformat(),
            "total_active_days": len(dates),
        }

    # ------------------------------------------------------------------
    # CALENDAR  — dùng cho UI lịch học
    # ------------------------------------------------------------------

    def get_calendar(self, user_id: str, year: int, month: int) -> List[Dict]:
        start = f"{year}-{month:02d}-01"
        ey, em = (year + 1, 1) if month == 12 else (year, month + 1)
        end = f"{ey}-{em:02d}-01"

        logs = list(
            self.logs.find(
                {"user_id": user_id, "date": {"$gte": start, "$lt": end}},
                sort=[("date", 1)],
            )
        )
        return [
            {"date": log["date"], "skills_done": log.get("skills_done", [])}
            for log in logs
        ]