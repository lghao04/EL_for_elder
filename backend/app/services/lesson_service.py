# app/services/lesson_service.py
from typing import Any, Dict, List, Optional, Union
from bson import ObjectId
import pymongo


class LessonService:
    """
    LessonService expects a pymongo Collection (e.g., db.lessons).
    Methods return plain python dicts / lists (documents from Mongo).
    
    Supports both MongoDB _id (ObjectId) and custom id (e.g., 'mc160.train.0')
    """

    def __init__(self, collection: pymongo.collection.Collection):
        self.col = collection

    def _build_query(self, mongo_id_or_custom_id: str) -> Dict[str, Any]:
        """
        Build query to support both:
        - MongoDB ObjectId: "6938ff2ddb793a1844b9bc4d"
        - Custom ID: "mc160.train.0", "mc160.train.1", etc.
        """
        # First, try to parse as ObjectId (24-char hex string)
        if len(mongo_id_or_custom_id) == 24:
            try:
                if ObjectId.is_valid(mongo_id_or_custom_id):
                    return {"_id": ObjectId(mongo_id_or_custom_id)}
            except Exception:
                pass
        
        # Otherwise, treat as custom id field (like 'mc160.train.0')
        return {"id": mongo_id_or_custom_id}

    def get_full_lesson(self, mongo_id_or_custom_id: str) -> Optional[Dict[str, Any]]:
        q = self._build_query(mongo_id_or_custom_id)
        doc = self.col.find_one(q)
        
        if doc:
            doc["_id"] = str(doc["_id"])

            if "id" not in doc:
                doc["id"] = doc["_id"]

            # NEW
            doc["score"] = doc.get("score")

        return doc


    def get_story(self, mongo_id_or_custom_id: str) -> Optional[str]:
        """
        Return only the story string (projection) or None if not found.
        
        Args:
            mongo_id_or_custom_id: Either MongoDB _id or custom id like 'mc160.train.0'
            
        Returns:
            Story text or None
        """
        q = self._build_query(mongo_id_or_custom_id)
        doc = self.col.find_one(q, {"story": 1})
        return doc.get("story") if doc else None

    def get_questions(self, mongo_id_or_custom_id: str) -> List[Dict[str, Any]]:
        """
        Return the list of question objects (possibly empty).
        Normalizes answer field to int.
        
        Args:
            mongo_id_or_custom_id: Either MongoDB _id or custom id like 'mc160.train.0'
            
        Returns:
            List of question dicts
        """
        q = self._build_query(mongo_id_or_custom_id)
        doc = self.col.find_one(q, {"questions": 1})
        qs = doc.get("questions", []) if doc else []
        
        # Normalize answer field to int if it's stored as string or nested
        normalized = []
        for qitem in qs:
            item = dict(qitem)  # shallow copy
            ans = item.get("answer")
            
            # Handle MongoDB export format: {"$numberInt": "2"}
            if isinstance(ans, dict):
                if "$numberInt" in ans:
                    try:
                        item["answer"] = int(ans["$numberInt"])
                    except (ValueError, TypeError):
                        print(f"⚠️ Warning: Could not parse answer: {ans}")
                        item["answer"] = 0  # fallback
                else:
                    item["answer"] = ans
            # Handle string numbers: "2" -> 2
            elif isinstance(ans, str) and ans.isdigit():
                item["answer"] = int(ans)
            # Already int or other type
            else:
                item["answer"] = ans if ans is not None else 0
                
            normalized.append(item)
            
        return normalized

    def get_questions_with_correct_answer_text(self, mongo_id_or_custom_id: str) -> List[Dict[str, Any]]:
        """
        Return questions enriched with 'correct_index' (int) and 'correct_text' (str or None).
        
        Example return item keys: 
            - type
            - question
            - choices
            - answer (original)
            - correct_index (int)
            - correct_text (str)
        
        Args:
            mongo_id_or_custom_id: Either MongoDB _id or custom id like 'mc160.train.0'
            
        Returns:
            List of enriched question dicts
        """
        qs = self.get_questions(mongo_id_or_custom_id)
        out = []
        
        for q in qs:
            choices = q.get("choices") or []
            raw_ans = q.get("answer")
            
            # Prefer integer
            try:
                correct_index = int(raw_ans) if raw_ans is not None else None
            except (ValueError, TypeError):
                print(f"⚠️ Warning: Invalid answer index: {raw_ans}")
                correct_index = None
                
            correct_text = None
            if correct_index is not None and 0 <= correct_index < len(choices):
                correct_text = choices[correct_index]
            else:
                print(f"⚠️ Warning: Answer index {correct_index} out of range for question: {q.get('question', '')[:50]}")
                
            item = dict(q)
            item["correct_index"] = correct_index
            item["correct_text"] = correct_text
            out.append(item)
            
        return out

    def list_all_lessons(self, limit: int = 100, skip: int = 0) -> List[Dict[str, Any]]:
       
        cursor = self.col.find({}, {
            "id": 1,
            "story": 1,
            "_id": 1,
            "questions": 1,
            "score": 1   # NEW
        }).skip(skip).limit(limit)

        lessons = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if "id" not in doc:
                doc["id"] = doc["_id"]

            doc["score"] = doc.get("score")   # NEW
            
            lessons.append(doc)

        return lessons

    
    def search_lessons_by_keyword(self, keyword: str, limit: int = 20) -> List[Dict[str, Any]]:
       
        query = {
            "$or": [
                {"story": {"$regex": keyword, "$options": "i"}},
                {"id": {"$regex": keyword, "$options": "i"}}
            ]
        }
        
        cursor = self.col.find(query, {
            "id": 1,
            "story": 1,
            "_id": 1,
            "score": 1  # NEW
        }).limit(limit)

        lessons = []
        for doc in cursor:
            doc["_id"] = str(doc["_id"])
            if "id" not in doc:
                doc["id"] = doc["_id"]
            
            doc["score"] = doc.get("score")  # NEW

            if "story" in doc:
                doc["story_preview"] = doc["story"][:200] + "..." if len(doc["story"]) > 200 else doc["story"]

            lessons.append(doc)

                
        return lessons

    # Utility: validate questions schema
    @staticmethod
    def validate_questions_schema(questions: List[Dict[str, Any]]) -> List[str]:
        """
        Validate questions list; return list of error messages (empty if ok).
        
        Checks:
          - each question has 'question' and 'choices' (list) and 'answer' index valid
          
        Returns:
            List of error messages (empty if valid)
        """
        errors = []
        for idx, q in enumerate(questions):
            if "question" not in q:
                errors.append(f"question[{idx}]: missing 'question' field")
                
            if "choices" not in q or not isinstance(q["choices"], list) or len(q["choices"]) == 0:
                errors.append(f"question[{idx}]: 'choices' must be a non-empty list")
                
            # Check answer index
            ans = q.get("answer")
            try:
                ai = int(ans)
                if ai < 0 or ai >= len(q.get("choices", [])):
                    errors.append(f"question[{idx}]: 'answer' index {ai} out of range (choices: {len(q.get('choices', []))})")
            except (ValueError, TypeError):
                errors.append(f"question[{idx}]: 'answer' is not an integer index (got: {ans})")
                
        return errors