# app/services/writing_service.py
from typing import Optional, List, Dict
from pymongo.collection import Collection


class WritingService:
    """Service xử lý Writing Questions (Quora dataset)"""

    def __init__(self, collection: Collection):
        self.collection = collection

    def get_prompt_by_id(self, prompt_id: str) -> Optional[Dict]:
        """
        Lấy question theo custom id (vd: "quora_0", "quora_1", ...)

        Returns:
            { "id": "quora_0", "question": "...", "topic": "..." }
        """
        try:
            doc = self.collection.find_one({"id": prompt_id}, {"_id": 0})
            return doc
        except Exception as e:
            print(f"❌ Error getting question: {e}")
            return None

    def get_random_prompt(self, topic: Optional[str] = None) -> Optional[Dict]:
        """
        Lấy random một question.
        Nếu truyền topic thì random trong topic đó.

        Returns:
            Random question document
        """
        try:
            pipeline = []
            if topic:
                pipeline.append({"$match": {"topic": topic}})
            pipeline.append({"$sample": {"size": 1}})

            result = list(self.collection.aggregate(pipeline))
            if not result:
                return None
            doc = result[0]
            doc.pop("_id", None)
            return doc
        except Exception as e:
            print(f"❌ Error getting random question: {e}")
            return None

    def get_prompts_paginated(
        self,
        skip: int = 0,
        limit: int = 20,
        topic: Optional[str] = None,
    ) -> tuple[List[Dict], int]:
        """
        Lấy danh sách questions với pagination, có thể lọc theo topic.

        Returns:
            (list_questions, total_count)
        """
        try:
            query = {"topic": topic} if topic else {}
            total = self.collection.count_documents(query)
            cursor = (
                self.collection
                .find(query, {"_id": 0})
                .skip(skip)
                .limit(limit)
            )
            return list(cursor), total
        except Exception as e:
            print(f"❌ Error getting questions: {e}")
            return [], 0

    def search_prompts(
        self,
        keyword: str,
        skip: int = 0,
        limit: int = 20,
        topic: Optional[str] = None,
    ) -> tuple[List[Dict], int]:
        """
        Tìm kiếm questions theo keyword (case-insensitive).
        Có thể kết hợp filter theo topic.

        Returns:
            (list_questions, total_count)
        """
        try:
            query: Dict = {"question": {"$regex": keyword, "$options": "i"}}
            if topic:
                query["topic"] = topic

            total = self.collection.count_documents(query)
            cursor = (
                self.collection
                .find(query, {"_id": 0})
                .skip(skip)
                .limit(limit)
            )
            return list(cursor), total
        except Exception as e:
            print(f"❌ Error searching questions: {e}")
            return [], 0

    def get_prompts_by_difficulty(
        self,
        difficulty: str = "all",
        skip: int = 0,
        limit: int = 20,
        topic: Optional[str] = None,
    ) -> tuple[List[Dict], int]:
        """
        Lấy questions theo độ khó (dựa vào độ dài question).
            easy:   <= 60  ký tự
            medium: 61-120 ký tự
            hard:   > 120  ký tự

        Returns:
            (list_questions, total_count)
        """
        try:
            length_filter = {
                "easy":   {"$expr": {"$lte": [{"$strLenCP": "$question"}, 60]}},
                "medium": {"$expr": {"$and": [
                    {"$gt":  [{"$strLenCP": "$question"}, 60]},
                    {"$lte": [{"$strLenCP": "$question"}, 120]},
                ]}},
                "hard":   {"$expr": {"$gt": [{"$strLenCP": "$question"}, 120]}},
            }
            query = length_filter.get(difficulty, {})
            if topic:
                query["topic"] = topic  # type: ignore[index]

            total = self.collection.count_documents(query)
            cursor = (
                self.collection
                .find(query, {"_id": 0})
                .skip(skip)
                .limit(limit)
            )
            return list(cursor), total
        except Exception as e:
            print(f"❌ Error filtering by difficulty: {e}")
            return [], 0

    def get_topics(self) -> List[Dict]:
        """
        Trả về danh sách tất cả topic kèm số lượng question.
        Dùng để hiển thị menu chọn chủ đề.

        Returns:
            [{ "topic": "Education", "count": 1234 }, ...]
        """
        try:
            pipeline = [
                {"$group": {"_id": "$topic", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
            ]
            return [
                {"topic": r["_id"] or "Other", "count": r["count"]}
                for r in self.collection.aggregate(pipeline)
            ]
        except Exception as e:
            print(f"❌ Error getting topics: {e}")
            return []

    def get_total_count(self, topic: Optional[str] = None) -> int:
        """Lấy tổng số questions, có thể lọc theo topic."""
        try:
            query = {"topic": topic} if topic else {}
            return self.collection.count_documents(query)
        except Exception as e:
            print(f"❌ Error counting questions: {e}")
            return 0

    def search_topics(
        self,
        keyword: str,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[List[Dict], int]:
        """
        Tìm kiếm topics có chứa keyword (case-insensitive).
        Trả về danh sách topic + số question, mỗi lần tối đa 50.

        Ví dụ keyword="heal" trả về:
            [{ "topic": "Health & Medicine", "count": 987 }, ...]

        Args:
            keyword: Từ người dùng gõ vào
            skip:    Pagination offset
            limit:   Tối đa 50 để không ảnh hưởng tốc độ

        Returns:
            (list_topics, total_matched_topics)
        """
        try:
            pipeline = [
                # Gom nhóm theo topic, đếm số question
                {"": {"_id": "", "count": {"": 1}}},
                # Lọc topic chứa keyword (case-insensitive)
                {"": {
                    "_id": {"": keyword, "": "i"}
                }},
                {"": {"count": -1}},
                # Dùng \ để lấy total + data trong 1 query
                {"": {
                    "total": [{"": "n"}],
                    "data":  [{"": skip}, {"": limit}],
                }},
            ]

            result = list(self.collection.aggregate(pipeline))
            if not result:
                return [], 0

            facet  = result[0]
            total  = facet["total"][0]["n"] if facet["total"] else 0
            topics = [
                {"topic": r["_id"] or "Other", "count": r["count"]}
                for r in facet["data"]
            ]
            return topics, total

        except Exception as e:
            print(f"❌ Error searching topics: {e}")
            return [], 0