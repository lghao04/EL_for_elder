# app/services/conversation_service.py
import threading
import time
import uuid
from typing import List, Dict, Any, Optional

class ConversationStore:
    """
    In-memory conversation store.
    - ttl_seconds: thời gian không hoạt động trước khi session bị xóa
    - max_messages: tổng số message (bao gồm system) giữ lại
    """
    def __init__(self, ttl_seconds: int = 3600, max_messages: int = 20):
        self._store: Dict[str, Dict[str, Any]] = {}
        self._ttl = ttl_seconds
        self._max_messages = max_messages
        self._lock = threading.Lock()

    def create_session(self, system_prompt: Optional[str] = None) -> str:
        session_id = str(uuid.uuid4())
        with self._lock:
            sys_msg = system_prompt or (
                "You are an English conversation partner. Reply in natural, friendly English. "
                "Keep answers concise and encourage the user to speak. Use simple sentences for learners."
            )
            self._store[session_id] = {
                "created_at": time.time(),
                "updated_at": time.time(),
                "messages": [{"role": "system", "content": sys_msg}]
            }
        return session_id

    def get_messages(self, session_id: str) -> Optional[List[Dict[str, str]]]:
        with self._lock:
            item = self._store.get(session_id)
            if not item:
                return None
            item["updated_at"] = time.time()
            # return a shallow copy to avoid external mutation
            return list(item["messages"])

    def append_user_message(self, session_id: str, text: str) -> Optional[List[Dict[str, str]]]:
        with self._lock:
            if session_id not in self._store:
                return None
            msgs = self._store[session_id]["messages"]
            msgs.append({"role": "user", "content": text})
            # prune if too long (keep system + last N-1)
            if len(msgs) > self._max_messages:
                system = msgs[0]
                msgs = [system] + msgs[-(self._max_messages - 1):]
                self._store[session_id]["messages"] = msgs
            self._store[session_id]["updated_at"] = time.time()
            return list(self._store[session_id]["messages"])

    def append_assistant_message(self, session_id: str, text: str) -> Optional[List[Dict[str, str]]]:
        with self._lock:
            if session_id not in self._store:
                return None
            self._store[session_id]["messages"].append({"role": "assistant", "content": text})
            # prune
            msgs = self._store[session_id]["messages"]
            if len(msgs) > self._max_messages:
                system = msgs[0]
                msgs = [system] + msgs[-(self._max_messages - 1):]
                self._store[session_id]["messages"] = msgs
            self._store[session_id]["updated_at"] = time.time()
            return list(self._store[session_id]["messages"])

    def delete_session(self, session_id: str):
        with self._lock:
            if session_id in self._store:
                del self._store[session_id]

    def cleanup(self):
        """Remove expired sessions (call periodically if desired)."""
        now = time.time()
        with self._lock:
            for sid in list(self._store.keys()):
                if now - self._store[sid]["updated_at"] > self._ttl:
                    del self._store[sid]

# Module-level singleton
conv_store = ConversationStore(ttl_seconds=3600, max_messages=20)
