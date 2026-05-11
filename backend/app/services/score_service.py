"""
ScoreService - lưu điểm, giới hạn 3 lần tính, leaderboard

Collections:
  exercise_attempts  — mỗi lần submit 1 document
  exercise_records   — tổng hợp per (user, exercise, skill), unique
  user_totals        — tổng điểm cộng dồn per user
"""

from datetime import datetime
from typing import Dict, List, Optional
from pymongo.database import Database

MAX_COUNTED_ATTEMPTS = 3
STREAK_BONUS_POINTS  = 10

WRITING_RUBRIC_KEYS = [
    "task_achievement",
    "coherence_cohesion",
    "lexical_resource",
    "grammatical_range",
]


class ScoreService:

    def __init__(self, db: Database):
        self.db       = db
        self.attempts = db["exercise_attempts"]
        self.records  = db["exercise_records"]
        self.totals   = db["user_totals"]
        self._ensure_indexes()

    def _ensure_indexes(self):
        try:
            self.attempts.create_index(
                [("user_id", 1), ("exercise_id", 1), ("skill", 1)],
                name="attempt_main_idx"
            )
            self.attempts.create_index(
                [("user_id", 1), ("skill", 1), ("created_at", -1)],
                name="attempt_time_idx"
            )
            self.records.create_index(
                [("user_id", 1), ("exercise_id", 1), ("skill", 1)],
                unique=True,
                name="record_unique_idx"
            )
            self.records.create_index(
                [("user_id", 1), ("skill", 1)],
                name="record_skill_idx"
            )
            self.totals.create_index(
                [("user_id", 1)], unique=True, name="totals_user_idx"
            )
            self.totals.create_index(
                [("total_score", -1)], name="leaderboard_idx"
            )
        except Exception as e:
            if "already exists" not in str(e).lower():
                print(f"Warning ScoreService index: {e}")

    # ==================================================================
    # SUBMIT  (3 skill types)
    # ==================================================================

    def submit_listening(self, user_id, exercise_id, correct_answers, total_questions):
        if total_questions <= 0:
            raise ValueError("total_questions phai > 0")
        normalized = round(correct_answers / total_questions * 100, 2)
        return self._process_submit(
            user_id, "listening", exercise_id,
            raw_score=correct_answers,
            max_raw=total_questions,
            normalized=normalized,
            details={"correct_answers": correct_answers, "total_questions": total_questions},
        )

    def submit_reading(self, user_id, exercise_id, correct_answers, total_questions):
        if total_questions <= 0:
            raise ValueError("total_questions phai > 0")
        normalized = round(correct_answers / total_questions * 100, 2)
        return self._process_submit(
            user_id, "reading", exercise_id,
            raw_score=correct_answers,
            max_raw=total_questions,
            normalized=normalized,
            details={"correct_answers": correct_answers, "total_questions": total_questions},
        )

    def submit_writing(self, user_id, exercise_id, rubric_scores):
        missing = [k for k in WRITING_RUBRIC_KEYS if k not in rubric_scores]
        if missing:
            raise ValueError(f"Thieu rubric keys: {missing}")
        for k, v in rubric_scores.items():
            if not (0 <= v <= 9):
                raise ValueError(f"{k} phai 0-9, nhan: {v}")
        avg  = sum(rubric_scores[k] for k in WRITING_RUBRIC_KEYS) / 4
        band = self._round_half(avg)
        normalized = round(band / 9 * 100, 2)
        return self._process_submit(
            user_id, "writing", exercise_id,
            raw_score=band,
            max_raw=9,
            normalized=normalized,
            details={"ielts_band": band, "rubric_scores": rubric_scores},
        )

    # ==================================================================
    # STREAK BONUS
    # ==================================================================

    def add_streak_bonus(self, user_id: str) -> Dict:
        """Cong +10 diem thuong streak. Goi tu ActivityService."""
        now = datetime.now()
        # Dung find+update thay vi setOnInsert de tranh conflict
        existing = self.totals.find_one({"user_id": user_id})
        if existing:
            self.totals.update_one(
                {"user_id": user_id},
                {
                    "$inc": {
                        "total_score": STREAK_BONUS_POINTS,
                        "streak_bonus_total": STREAK_BONUS_POINTS,
                    },
                    "$set": {"last_activity": now, "updated_at": now},
                },
            )
        else:
            self.totals.insert_one({
                "user_id": user_id,
                "total_score": STREAK_BONUS_POINTS,
                "streak_bonus_total": STREAK_BONUS_POINTS,
                "skill_totals": {},
                "last_activity": now,
                "created_at": now,
                "updated_at": now,
            })
        doc = self.totals.find_one({"user_id": user_id})
        return {
            "bonus": STREAK_BONUS_POINTS,
            "new_total": round(doc.get("total_score", 0), 2),
        }

    # ==================================================================
    # QUERIES
    # ==================================================================

    def get_exercise_record(self, user_id, exercise_id, skill) -> Optional[Dict]:
        doc = self.records.find_one(
            {"user_id": user_id, "exercise_id": exercise_id, "skill": skill}
        )
        return self._format_record(doc) if doc else None

    def get_all_exercise_records(self, user_id, skill=None) -> List[Dict]:
        query: Dict = {"user_id": user_id}
        if skill:
            query["skill"] = skill
        docs = list(self.records.find(query).sort("last_attempt_at", -1))
        return [self._format_record(d) for d in docs]

    def get_attempt_history(self, user_id, exercise_id, skill) -> List[Dict]:
        docs = list(
            self.attempts.find(
                {"user_id": user_id, "exercise_id": exercise_id, "skill": skill},
                sort=[("attempt_number", 1)],
            )
        )
        return [self._format_attempt(d) for d in docs]

    def get_user_score_summary(self, user_id: str) -> Dict:
        doc = self.totals.find_one({"user_id": user_id})
        if not doc:
            return {
                "user_id": user_id,
                "total_score": 0,
                "streak_bonus_total": 0,
                "skill_totals": {
                    s: {"accumulated": 0, "attempts": 0, "best_single": 0, "average": 0}
                    for s in ("listening", "reading", "writing")
                },
                "last_activity": None,
            }
        skill_totals = doc.get("skill_totals", {})
        result = {}
        for skill in ("listening", "reading", "writing"):
            st       = skill_totals.get(skill, {})
            attempts = st.get("attempts", 0)
            acc      = st.get("accumulated", 0)
            result[skill] = {
                "accumulated": round(acc, 2),
                "attempts": attempts,
                "best_single": round(st.get("best_single", 0), 2),
                "average": round(acc / attempts, 2) if attempts else 0,
            }
        return {
            "user_id": user_id,
            "total_score": round(doc.get("total_score", 0), 2),
            "streak_bonus_total": round(doc.get("streak_bonus_total", 0), 2),
            "skill_totals": result,
            "last_activity": doc["last_activity"].isoformat()
                if doc.get("last_activity") else None,
        }

    def get_leaderboard(self, limit: int = 5) -> List[Dict]:
        docs = list(self.totals.find({}, sort=[("total_score", -1)], limit=limit))

        # Lấy thông tin profile của tất cả user trong leaderboard 1 lần
        # users._id là ObjectId, user_totals.user_id là string của ObjectId
        from bson import ObjectId as BsonObjectId
        user_ids = [d["user_id"] for d in docs]
        object_ids = []
        for uid in user_ids:
            try:
                object_ids.append(BsonObjectId(uid))
            except Exception:
                pass

        users_col = self.db["users"]
        user_profiles = {
            str(u["_id"]): u
            for u in users_col.find(
                {"_id": {"$in": object_ids}},
                {"_id": 1, "username": 1, "account_name": 1, "profile_image": 1}
            )
        }

        result = []
        for rank, doc in enumerate(docs, start=1):
            st      = doc.get("skill_totals", {})
            uid     = doc["user_id"]
            profile = user_profiles.get(uid, {})
            result.append({
                "rank":               rank,
                "user_id":            uid,
                "display_name":       profile.get("account_name") or profile.get("username") or f"User {uid[-4:]}",
                "profile_image":      profile.get("profile_image"),
                "total_score":        round(doc.get("total_score", 0), 2),
                "streak_bonus_total": round(doc.get("streak_bonus_total", 0), 2),
                "skill_scores": {
                    s: round(st.get(s, {}).get("accumulated", 0), 2)
                    for s in ("listening", "reading", "writing")
                },
                "last_activity": doc["last_activity"].isoformat()
                    if doc.get("last_activity") else None,
            })
        return result

    def get_user_rank(self, user_id: str) -> Dict:
        doc = self.totals.find_one({"user_id": user_id})
        if not doc:
            return {"user_id": user_id, "rank": None, "total_score": 0}
        score = doc.get("total_score", 0)
        rank  = self.totals.count_documents({"total_score": {"$gt": score}}) + 1
        return {"user_id": user_id, "rank": rank, "total_score": round(score, 2)}

    # ==================================================================
    # CORE LOGIC  — tách insert / update để tránh MongoDB operator conflict
    # ==================================================================

    def _process_submit(
        self,
        user_id: str,
        skill: str,
        exercise_id: str,
        raw_score: float,
        max_raw: float,
        normalized: float,
        details: Dict,
    ) -> Dict:
        now = datetime.now()

        # ── 1. Đọc record hiện tại (nếu có) ───────────────────────────
        record = self.records.find_one(
            {"user_id": user_id, "exercise_id": exercise_id, "skill": skill}
        )
        current_counted = record["counted_attempts"] if record else 0
        attempt_number  = (record["total_attempts"]  if record else 0) + 1
        score_counted   = current_counted < MAX_COUNTED_ATTEMPTS

        # ── 2. Lưu attempt document ────────────────────────────────────
        self.attempts.insert_one({
            "user_id":          user_id,
            "exercise_id":      exercise_id,
            "skill":            skill,
            "attempt_number":   attempt_number,
            "score_counted":    score_counted,
            "raw_score":        raw_score,
            "max_raw":          max_raw,
            "normalized_score": normalized,
            "details":          details,
            "created_at":       now,
        })

        # ── 3. Cập nhật exercise_record ────────────────────────────────
        # Tách insert mới / update cũ để tránh conflict operator MongoDB
        if record is None:
            # Lần submit đầu tiên → insert
            will_lock = score_counted and (MAX_COUNTED_ATTEMPTS == 1)
            self.records.insert_one({
                "user_id":          user_id,
                "exercise_id":      exercise_id,
                "skill":            skill,
                "total_attempts":   1,
                "counted_attempts": 1 if score_counted else 0,
                "best_score":       normalized if score_counted else 0.0,
                "best_raw":         raw_score  if score_counted else 0.0,
                "last_score":       normalized,
                "score_locked":     will_lock,
                "first_attempt_at": now,
                "last_attempt_at":  now,
            })
        else:
            # Lần tiếp theo → update với các toán tử riêng biệt
            set_fields: Dict = {"last_score": normalized, "last_attempt_at": now}
            inc_fields: Dict = {"total_attempts": 1}
            max_fields: Dict = {}

            if score_counted:
                inc_fields["counted_attempts"] = 1
                max_fields["best_score"] = normalized
                max_fields["best_raw"]   = raw_score
                if current_counted + 1 >= MAX_COUNTED_ATTEMPTS:
                    set_fields["score_locked"] = True

            update_op: Dict = {"$inc": inc_fields, "$set": set_fields}
            if max_fields:
                update_op["$max"] = max_fields

            self.records.update_one(
                {"user_id": user_id, "exercise_id": exercise_id, "skill": skill},
                update_op,
            )

        # ── 4. Cập nhật user_totals (chỉ khi score_counted) ───────────
        if score_counted:
            sf = f"skill_totals.{skill}"
            existing_total = self.totals.find_one({"user_id": user_id})
            if existing_total:
                self.totals.update_one(
                    {"user_id": user_id},
                    {
                        "$inc": {
                            "total_score":        normalized,
                            f"{sf}.accumulated":  normalized,
                            f"{sf}.attempts":     1,
                        },
                        "$max": {f"{sf}.best_single": normalized},
                        "$set": {"last_activity": now, "updated_at": now},
                    },
                )
            else:
                # User chưa có totals document → insert
                self.totals.insert_one({
                    "user_id":           user_id,
                    "total_score":       normalized,
                    "streak_bonus_total": 0,
                    "skill_totals": {
                        skill: {
                            "accumulated": normalized,
                            "attempts":    1,
                            "best_single": normalized,
                        }
                    },
                    "last_activity": now,
                    "created_at":    now,
                    "updated_at":    now,
                })

        # ── 5. Trả về kết quả ─────────────────────────────────────────
        updated_record = self.records.find_one(
            {"user_id": user_id, "exercise_id": exercise_id, "skill": skill}
        )
        counted_after = current_counted + (1 if score_counted else 0)

        return {
            "attempt_number": attempt_number,
            "score_counted":  score_counted,
            "normalized_score": normalized,
            "raw_score":      raw_score,
            "max_raw":        max_raw,
            "details":        details,
            "record":         self._format_record(updated_record),
            "message":        self._attempt_message(score_counted, counted_after),
        }

    # ==================================================================
    # HELPERS
    # ==================================================================

    @staticmethod
    def _attempt_message(score_counted: bool, counted_so_far: int) -> str:
        if not score_counted:
            return (
                f"Bai nay da duoc submit {MAX_COUNTED_ATTEMPTS} lan tinh diem. "
                "Ket qua lan nay khong duoc tinh vao tong diem."
            )
        remaining = MAX_COUNTED_ATTEMPTS - counted_so_far
        if remaining == 0:
            return "Diem da duoc tinh. Day la lan submit cuoi duoc tinh diem cho bai nay."
        return f"Diem da duoc tinh. Con {remaining} lan submit duoc tinh diem cho bai nay."

    @staticmethod
    def _format_record(doc: Dict) -> Optional[Dict]:
        if not doc:
            return None
        return {
            "id":                str(doc["_id"]),
            "user_id":           doc["user_id"],
            "exercise_id":       doc["exercise_id"],
            "skill":             doc["skill"],
            "total_attempts":    doc.get("total_attempts", 0),
            "counted_attempts":  doc.get("counted_attempts", 0),
            "max_counted_attempts": MAX_COUNTED_ATTEMPTS,
            "best_score":        doc.get("best_score", 0),
            "best_raw":          doc.get("best_raw", 0),
            "last_score":        doc.get("last_score", 0),
            "score_locked":      doc.get("score_locked", False),
            "first_attempt_at":  doc["first_attempt_at"].isoformat()
                                 if doc.get("first_attempt_at") else None,
            "last_attempt_at":   doc["last_attempt_at"].isoformat()
                                 if doc.get("last_attempt_at") else None,
        }

    @staticmethod
    def _format_attempt(doc: Dict) -> Dict:
        return {
            "id":               str(doc["_id"]),
            "attempt_number":   doc["attempt_number"],
            "score_counted":    doc["score_counted"],
            "raw_score":        doc["raw_score"],
            "max_raw":          doc["max_raw"],
            "normalized_score": doc["normalized_score"],
            "details":          doc.get("details", {}),
            "created_at":       doc["created_at"].isoformat()
                                if doc.get("created_at") else None,
        }

    @staticmethod
    def _round_half(value: float) -> float:
        """Lam tron IELTS band den 0.5 gan nhat."""
        return round(value * 2) / 2