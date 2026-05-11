"""
ActivityService
===============
Entry point duy nhất cho toàn bộ luồng submit bài.

Luồng khi user nộp bài:
  1. ScoreService xử lý điểm (giới hạn 3 lần tính điểm)
  2. Nếu đúng >= 1 câu → StreakService.record_activity()
  3. Nếu streak_bonus=True → ScoreService.add_streak_bonus() (+10 điểm)
  4. Trả về kết quả tổng hợp

Luồng read:
  - get_dashboard()    → thông tin cá nhân đầy đủ
  - get_leaderboard()  → top 5 toàn server
  - get_calendar()     → lịch học trong tháng
"""

from typing import Dict, List, Optional
from pymongo.database import Database

from app.services.streak_service import StreakService
from app.services.score_service import ScoreService

# Writing: band tối thiểu để tính là "đúng ít nhất 1 câu"
MIN_WRITING_BAND = 1.0


class ActivityService:

    def __init__(self, db: Database):
        self.streak_svc = StreakService(db)
        self.score_svc = ScoreService(db)

    # ==================================================================
    # SUBMIT
    # ==================================================================

    def submit_listening(
        self,
        user_id: str,
        exercise_id: str,
        correct_answers: int,
        total_questions: int,
    ) -> Dict:
        score_result = self.score_svc.submit_listening(
            user_id, exercise_id, correct_answers, total_questions
        )
        streak_result, bonus_result = None, None
        if correct_answers >= 1:
            streak_result = self.streak_svc.record_activity(user_id, "listening")
            if streak_result["streak_bonus"]:
                bonus_result = self.score_svc.add_streak_bonus(user_id)

        return self._build_response("listening", score_result, streak_result, bonus_result)

    def submit_reading(
        self,
        user_id: str,
        exercise_id: str,
        correct_answers: int,
        total_questions: int,
    ) -> Dict:
        score_result = self.score_svc.submit_reading(
            user_id, exercise_id, correct_answers, total_questions
        )
        streak_result, bonus_result = None, None
        if correct_answers >= 1:
            streak_result = self.streak_svc.record_activity(user_id, "reading")
            if streak_result["streak_bonus"]:
                bonus_result = self.score_svc.add_streak_bonus(user_id)

        return self._build_response("reading", score_result, streak_result, bonus_result)

    def submit_writing(
        self,
        user_id: str,
        exercise_id: str,
        rubric_scores: Dict[str, float],
    ) -> Dict:
        score_result = self.score_svc.submit_writing(user_id, exercise_id, rubric_scores)
        band = score_result["details"].get("ielts_band", 0)

        streak_result, bonus_result = None, None
        if band >= MIN_WRITING_BAND:
            streak_result = self.streak_svc.record_activity(user_id, "writing")
            if streak_result["streak_bonus"]:
                bonus_result = self.score_svc.add_streak_bonus(user_id)

        return self._build_response("writing", score_result, streak_result, bonus_result)

    # ==================================================================
    # READ
    # ==================================================================

    def get_dashboard(self, user_id: str) -> Dict:
        """Dữ liệu đầy đủ cho trang Dashboard cá nhân."""
        score_summary = self.score_svc.get_user_score_summary(user_id)
        streak_info = self.streak_svc.get_streak(user_id)
        rank_info = self.score_svc.get_user_rank(user_id)

        return {
            "user_id": user_id,
            "total_score": score_summary["total_score"],
            "streak_bonus_total": score_summary["streak_bonus_total"],
            "rank": rank_info["rank"],
            "streak": {
                "current": streak_info["current_streak"],
                "longest": streak_info["longest_streak"],
                "total_active_days": streak_info["total_active_days"],
                "last_active_date": streak_info["last_active_date"],
            },
            "skill_scores": score_summary["skill_totals"],
        }

    def get_leaderboard(self, limit: int = 5) -> List[Dict]:
        """Top N user theo tổng điểm."""
        return self.score_svc.get_leaderboard(limit=limit)

    def get_exercise_record(
        self, user_id: str, exercise_id: str, skill: str
    ) -> Optional[Dict]:
        """Chi tiết 1 bài test của user."""
        return self.score_svc.get_exercise_record(user_id, exercise_id, skill)

    def get_attempt_history(
        self, user_id: str, exercise_id: str, skill: str
    ) -> List[Dict]:
        """Lịch sử toàn bộ lần nộp bài."""
        return self.score_svc.get_attempt_history(user_id, exercise_id, skill)

    def get_all_records(
        self, user_id: str, skill: Optional[str] = None
    ) -> List[Dict]:
        """Tất cả bài test của user (lọc theo skill)."""
        return self.score_svc.get_all_exercise_records(user_id, skill)

    def get_learning_calendar(self, user_id: str, year: int, month: int) -> Dict:
        days = self.streak_svc.get_calendar(user_id, year, month)
        return {"user_id": user_id, "year": year, "month": month, "active_days": days}

    # ==================================================================
    # INTERNAL
    # ==================================================================

    @staticmethod
    def _build_response(
        skill: str,
        score: Dict,
        streak: Optional[Dict],
        bonus: Optional[Dict],
    ) -> Dict:
        return {
            "status": "ok",
            "skill": skill,
            "score": {
                "normalized": score["normalized_score"],
                "raw": score["raw_score"],
                "max_raw": score["max_raw"],
                "details": score["details"],
                "attempt_number": score["attempt_number"],
                "score_counted": score["score_counted"],
                "message": score["message"],
            },
            "record": score["record"],
            "streak": {
                "counted": streak is not None,
                "current": streak["current_streak"] if streak else None,
                "is_new_day": streak["is_new_day"] if streak else None,
            },
            "streak_bonus": {
                "awarded": bonus is not None,
                "points": bonus["bonus"] if bonus else 0,
                "new_total": bonus["new_total"] if bonus else None,
            },
        }