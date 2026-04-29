# app/services/listening_service.py
from typing import Optional, List, Dict
from pymongo.collection import Collection
from bson import ObjectId


class ListeningService:

    def __init__(self, collection: Collection):
        self.collection = collection

    def get_all_exercises(self, skip: int = 0, limit: int = 20) -> List[Dict]:
        try:
            cursor = self.collection.find({}, {"text": 1}).skip(skip).limit(limit)
            return [
                {"id": str(doc["_id"]), "preview": doc.get("text", "")[:60]}
                for doc in cursor
            ]
        except Exception as e:
            print(f"❌ Error getting exercises: {e}")
            return []

    def get_exercise_full(self, exercise_id: str) -> Optional[Dict]:
        try:
            doc = self.collection.find_one({"_id": ObjectId(exercise_id)})
            if not doc:
                return None
            return {
                "id":    str(doc["_id"]),
                "text":  doc.get("text", ""),
                "audio": doc.get("audio", {})
            }
        except Exception as e:
            print(f"❌ Error getting exercise: {e}")
            return None

    def get_random_exercise(self) -> Optional[Dict]:
        try:
            result = list(self.collection.aggregate([{"$sample": {"size": 1}}]))
            if not result:
                return None
            doc = result[0]
            return {
                "id":    str(doc["_id"]),
                "text":  doc.get("text", ""),
                "audio": doc.get("audio", {})
            }
        except Exception as e:
            print(f"❌ Error getting random exercise: {e}")
            return None

    def get_total_count(self) -> int:
        try:
            return self.collection.count_documents({})
        except Exception as e:
            print(f"❌ Error counting exercises: {e}")
            return 0