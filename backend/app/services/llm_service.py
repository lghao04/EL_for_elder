# app/services/llm_service.py
import os
from typing import Optional, List, Dict, Any

_CLIENT_LIB = None
_genai_module = None

# Try import google.genai first, then genai
try:
    # google-genai package exposes module google.genai
    from google import genai as _genai_module  # type: ignore
    _CLIENT_LIB = "google.genai"
except Exception:
    try:
        import genai as _genai_module  # type: ignore
        _CLIENT_LIB = "genai"
    except Exception:
        _genai_module = None
        _CLIENT_LIB = None


def get_client():
    """
    Khởi tạo và trả về client GenAI. Nếu package hoặc API key thiếu, ném lỗi rõ ràng.
    Caller nên gọi get_client() khi cần (lazy init).
    """
    if _genai_module is None:
        raise ImportError(
            "Không tìm thấy thư viện GenAI. Cài bằng một trong các lệnh:\n"
            "  pip install google-genai\n"
            "hoặc\n"
            "  pip install genai\n"
            "Kiểm tra bằng: pip show google-genai ; pip show genai"
        )

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("GEMINI_API_KEY không được đặt trong environment. Thêm vào .env hoặc export trước khi chạy.")

    # Các package có thể có interface khác nhau; handle common constructors
    try:
        ClientCls = getattr(_genai_module, "Client", None)
        if ClientCls is None:
            ClientCls = getattr(_genai_module, "GenAIClient", None) or getattr(_genai_module, "GenAI", None)
        if ClientCls is None:
            raise RuntimeError("Không tìm thấy lớp Client trong package GenAI import được.")
        # instantiate (try keyword first)
        try:
            client = ClientCls(api_key=api_key)
        except TypeError:
            try:
                client = ClientCls({"api_key": api_key})
            except Exception:
                client = ClientCls()
        return client
    except Exception as e:
        raise RuntimeError(f"Lỗi khi khởi tạo GenAI client ({_CLIENT_LIB}): {e}") from e


# Lazy-init global client variable (initialized on module import)
try:
    client = get_client()
    print(f"✅ GenAI client initialized using {_CLIENT_LIB}")
except Exception as e:
    # Không raise trực tiếp ở import time để còn có thể unit-test module khác; nhưng ghi log rõ ràng
    client = None
    print(f"⚠️  GenAI client not initialized: {e}")


def _extract_text_from_response(resp: Any) -> str:
    """
    Trích text từ nhiều dạng response khác nhau.
    """
    try:
        if hasattr(resp, "text") and resp.text:
            return resp.text
        if hasattr(resp, "output_text") and resp.output_text:
            return resp.output_text
    except Exception:
        pass

    if isinstance(resp, dict):
        try:
            ch0 = resp.get("results", {}).get("channels", [])[0]
            alt0 = ch0.get("alternatives", [])[0]
            if alt0.get("transcript"):
                return alt0.get("transcript")
        except Exception:
            pass
        if resp.get("output_text"):
            return resp.get("output_text")
        if resp.get("text"):
            return resp.get("text")
        try:
            out = resp.get("output", [])
            if out:
                c0 = out[0].get("content", [])
                if c0 and isinstance(c0[0], dict) and c0[0].get("text"):
                    return c0[0]["text"]
        except Exception:
            pass

    try:
        out = getattr(resp, "output", None)
        if out:
            first = out[0]
            content = getattr(first, "content", None) or (first.get("content") if isinstance(first, dict) else None)
            if content:
                item = content[0]
                text = getattr(item, "text", None) or (item.get("text") if isinstance(item, dict) else None)
                if text:
                    return text
    except Exception:
        pass

    try:
        return str(resp)
    except Exception:
        return ""


def _messages_to_text(messages: List[Dict[str, str]]) -> str:
    """
    Chuyển history messages thành 1 prompt string.
    Format: system at top (if any), rồi luân phiên User/Assistant.
    """
    parts = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role == "system":
            parts.append(f"[System] {content}")
        elif role == "user":
            parts.append(f"[User] {content}")
        else:
            parts.append(f"[Assistant] {content}")
    return "\n".join(parts)


def chat_with_messages(messages: List[Dict[str, str]], model: Optional[str] = None) -> str:
    """
    Robust chat wrapper: thử nhiều cách gọi khác nhau tùy SDK.
    - Nếu SDK hỗ trợ messages list (models/chats), thử trực tiếp.
    - Nếu không, chuyển messages thành 1 string và gọi bằng `input`/`prompt`/`contents`.
    """
    if client is None:
        raise RuntimeError("GenAI client chưa được khởi tạo. Kiểm tra GEMINI_API_KEY và package google-genai/genai.")

    model = model or os.getenv("GEMINI_MODEL") or "gemini-2.0-flash"
    messages_text = _messages_to_text(messages)

    # 1) try client.chats.create with messages (best-case)
    try:
        if hasattr(client, "chats") and hasattr(client.chats, "create"):
            try:
                resp = client.chats.create(model=model, messages=messages)
                return _extract_text_from_response(resp)
            except TypeError as e:
                # maybe this chats.create expects 'input' instead of 'messages'
                try:
                    resp = client.chats.create(model=model, input=messages_text)
                    return _extract_text_from_response(resp)
                except Exception:
                    # try 'prompt' if available
                    try:
                        resp = client.chats.create(model=model, prompt=messages_text)
                        return _extract_text_from_response(resp)
                    except Exception:
                        print("WARN: client.chats.create variants failed:", e)
    except Exception as e:
        print("WARN: client.chats.create failed:", e)

    # 2) try client.chat.completions.create (older shape)
    try:
        if hasattr(client, "chat") and hasattr(client.chat, "completions"):
            try:
                resp = client.chat.completions.create(model=model, messages=messages)
                return _extract_text_from_response(resp)
            except TypeError:
                # try input string fallback
                try:
                    resp = client.chat.completions.create(model=model, input=messages_text)
                    return _extract_text_from_response(resp)
                except Exception as e:
                    print("WARN: client.chat.completions.create fallback failed:", e)
    except Exception as e:
        print("WARN: client.chat.completions.create failed:", e)

    # 3) try client.models.generate_content (expects contents as list[str] or list of Content objects)
    try:
        if hasattr(client, "models") and hasattr(client.models, "generate_content"):
            # first try passing list of simple strings
            try:
                resp = client.models.generate_content(model=model, contents=[messages_text])
                return _extract_text_from_response(resp)
            except TypeError as e:
                # maybe expects 'input' or 'prompt'
                try:
                    resp = client.models.generate_content(model=model, input=messages_text)
                    return _extract_text_from_response(resp)
                except Exception:
                    print("WARN: client.models.generate_content fallback failed:", e)
    except Exception as e:
        print("WARN: client.models.generate_content failed:", e)

    # 4) try client.models.generate (some SDKs)
    try:
        if hasattr(client, "models") and hasattr(client.models, "generate"):
            try:
                # many variants: input=string or prompt=string
                try:
                    resp = client.models.generate(model=model, input=messages_text)
                except TypeError:
                    resp = client.models.generate(model=model, prompt=messages_text)
                return _extract_text_from_response(resp)
            except Exception as e:
                print("WARN: client.models.generate failed:", e)
    except Exception as e:
        print("WARN: client.models.generate (outer) failed:", e)

    # 5) last resort: try a plain text call if available (e.g., client.predict / client.complete)
    try:
        if hasattr(client, "predict"):
            try:
                resp = client.predict(model=model, input=messages_text)
                return _extract_text_from_response(resp)
            except Exception as e:
                print("WARN: client.predict failed:", e)
        if hasattr(client, "complete"):
            try:
                resp = client.complete(model=model, prompt=messages_text)
                return _extract_text_from_response(resp)
            except Exception as e:
                print("WARN: client.complete failed:", e)
    except Exception as e:
        print("WARN: fallback plain text calls failed:", e)

    # Nếu tất cả thất bại, raise với hướng debug
    # Gợi ý debug: in dir(client) và signature của vài hàm để biết tên tham số
    import inspect
    client_attrs = [n for n in dir(client) if not n.startswith("_")]
    raise RuntimeError(
        "Không thể gọi Gemini/GenAI: SDK hiện tại không hỗ trợ phương thức mong đợi.\n"
        f"Client attrs sample: {client_attrs[:80]}\n"
        "Bạn có thể kiểm tra bằng cách in dir(client) và inspect.signature trên phương thức mà bạn muốn dùng."
    )
# app/services/llm_service.py
# import os
# import re
# import time
# import asyncio
# from typing import Optional, List, Dict, Any

# _CLIENT_LIB = None
# _genai_module = None
# _client = None  # cached client (lazy)

# # Try import google.genai first, then genai
# try:
#     from google import genai as _genai_module  # type: ignore
#     _CLIENT_LIB = "google.genai"
# except Exception:
#     try:
#         import genai as _genai_module  # type: ignore
#         _CLIENT_LIB = "genai"
#     except Exception:
#         _genai_module = None
#         _CLIENT_LIB = None


# def _current_api_key() -> Optional[str]:
#     return os.getenv("GEMINI_API_KEY")


# def reload_client():
#     """Force re-initialize client (useful after changing env vars)."""
#     global _client
#     _client = None
#     return _init_client()


# def _init_client():
#     """Lazy initialize and cache the GenAI client. Raises informative errors."""
#     global _client
#     if _client is not None:
#         return _client

#     if _genai_module is None:
#         raise ImportError(
#             "Không tìm thấy thư viện GenAI. Cài bằng một trong các lệnh:\n"
#             "  pip install google-genai\n"
#             "hoặc\n"
#             "  pip install genai\n"
#             "Kiểm tra: pip show google-genai ; pip show genai"
#         )

#     api_key = _current_api_key()
#     if not api_key:
#         raise RuntimeError("GEMINI_API_KEY không được đặt trong environment. Thêm vào .env hoặc export trước khi chạy.")

#     # Try to find a Client class
#     ClientCls = getattr(_genai_module, "Client", None) \
#                 or getattr(_genai_module, "GenAIClient", None) \
#                 or getattr(_genai_module, "GenAI", None)

#     if ClientCls is None:
#         raise RuntimeError("Không tìm thấy lớp Client trong package GenAI import được.")

#     # Try common constructors
#     last_exc = None
#     try:
#         client = ClientCls(api_key=api_key)
#     except TypeError as e:
#         last_exc = e
#         try:
#             client = ClientCls({"api_key": api_key})
#         except Exception:
#             try:
#                 client = ClientCls()
#             except Exception as e2:
#                 raise RuntimeError(f"Lỗi tạo client GenAI: {e2}") from e2
#     except Exception as e:
#         raise RuntimeError(f"Lỗi khi khởi tạo GenAI client: {e}") from e

#     _client = client
#     print(f"✅ GenAI client initialized using {_CLIENT_LIB}")
#     return _client


# def _maybe_run_coroutine(val):
#     """If val is a coroutine, run it synchronously (blocks current thread)."""
#     if asyncio.iscoroutine(val):
#         try:
#             return asyncio.run(val)
#         except RuntimeError:
#             # If already in event loop (unlikely for FastAPI sync thread), fallback to loop run
#             loop = asyncio.new_event_loop()
#             try:
#                 return loop.run_until_complete(val)
#             finally:
#                 loop.close()
#     return val


# def list_models() -> List[str]:
#     """Return list of model names known to the client (best-effort)."""
#     client = _init_client()
#     names = []
#     try:
#         # prefer client.models.list()
#         if hasattr(client.models, "list"):
#             resp = _maybe_run_coroutine(client.models.list())
#         elif hasattr(client.models, "list_models"):
#             resp = _maybe_run_coroutine(client.models.list_models())
#         else:
#             # fallback: attempt to access attr directly
#             resp = None

#         # Try to extract model names from common shapes
#         models = getattr(resp, "models", None) or getattr(resp, "results", None) or resp
#         if models:
#             for m in models:
#                 name = getattr(m, "name", None) or (m.get("name") if isinstance(m, dict) else None)
#                 if name:
#                     names.append(name)
#     except Exception as e:
#         print("WARN: list_models failed:", e)
#     return names


# def _extract_text_from_response(resp: Any) -> str:
#     """Robust extraction of text from many SDK response shapes."""
#     try:
#         if hasattr(resp, "text") and resp.text:
#             return resp.text
#         if hasattr(resp, "output_text") and resp.output_text:
#             return resp.output_text
#     except Exception:
#         pass

#     if isinstance(resp, dict):
#         try:
#             ch0 = resp.get("results", {}).get("channels", [])[0]
#             alt0 = ch0.get("alternatives", [])[0]
#             if alt0.get("transcript"):
#                 return alt0.get("transcript")
#         except Exception:
#             pass
#         if resp.get("output_text"):
#             return resp.get("output_text")
#         if resp.get("text"):
#             return resp.get("text")
#         try:
#             out = resp.get("output", [])
#             if out:
#                 c0 = out[0].get("content", [])
#                 if c0 and isinstance(c0[0], dict) and c0[0].get("text"):
#                     return c0[0]["text"]
#         except Exception:
#             pass

#     try:
#         out = getattr(resp, "output", None)
#         if out:
#             first = out[0]
#             content = getattr(first, "content", None) or (first.get("content") if isinstance(first, dict) else None)
#             if content:
#                 item = content[0]
#                 text = getattr(item, "text", None) or (item.get("text") if isinstance(item, dict) else None)
#                 if text:
#                     return text
#     except Exception:
#         pass

#     try:
#         return str(resp)
#     except Exception:
#         return ""


# def _messages_to_text(messages: List[Dict[str, str]]) -> str:
#     parts = []
#     for m in messages:
#         role = m.get("role", "user")
#         content = m.get("content", "")
#         if role == "system":
#             parts.append(f"[System] {content}")
#         elif role == "user":
#             parts.append(f"[User] {content}")
#         else:
#             parts.append(f"[Assistant] {content}")
#     return "\n".join(parts)


# def _parse_retry_seconds_from_error(e: Exception) -> Optional[int]:
#     """Try to parse retryDelay in seconds from google-style error details or text."""
#     # try dict-like in args
#     try:
#         maybe = e.args[0] if getattr(e, "args", None) else None
#         if isinstance(maybe, dict):
#             for d in maybe.get("error", {}).get("details", []):
#                 if d.get("@type", "").endswith("RetryInfo") and "retryDelay" in d:
#                     s = d["retryDelay"]
#                     m = re.search(r"(\d+)", s)
#                     if m:
#                         return int(m.group(1))
#         # fallback regex on string
#         s = str(e)
#         m = re.search(r"retry.*?(\d+)\.?s", s, re.IGNORECASE) or re.search(r"retryDelay.*?(\d+)\.?s", s, re.IGNORECASE)
#         if m:
#             return int(m.group(1))
#     except Exception:
#         pass
#     return None


# def chat_with_messages(messages: List[Dict[str, str]], model: Optional[str] = None) -> str:
#     """
#     Call GenAI in a robust way:
#     - lazy init client
#     - try several method shapes
#     - handle coroutine returns
#     - provide informative errors for 404 (model not found) and 429 (quota)
#     """
#     client = _init_client()
#     model = model or os.getenv("GEMINI_MODEL") or "gemini-2.0-flash"
#     messages_text = _messages_to_text(messages)

#     def try_call(fn, *args, **kwargs):
#         val = None
#         try:
#             val = fn(*args, **kwargs)
#             return _maybe_run_coroutine(val)
#         except TypeError:
#             # rethrow to let fallback try different param names
#             raise

#     # 1) try client.chats.create
#     try:
#         if hasattr(client, "chats") and hasattr(client.chats, "create"):
#             try:
#                 resp = try_call(client.chats.create, model=model, messages=messages)
#                 return _extract_text_from_response(resp)
#             except TypeError:
#                 try:
#                     resp = try_call(client.chats.create, model=model, input=messages_text)
#                     return _extract_text_from_response(resp)
#                 except Exception:
#                     try:
#                         resp = try_call(client.chats.create, model=model, prompt=messages_text)
#                         return _extract_text_from_response(resp)
#                     except Exception as e:
#                         print("WARN: client.chats.create variants failed:", e)
#     except Exception as e:
#         print("WARN: client.chats.create failed:", e)

#     # 2) try older chat.completions shape
#     try:
#         if hasattr(client, "chat") and hasattr(client.chat, "completions"):
#             try:
#                 resp = try_call(client.chat.completions.create, model=model, messages=messages)
#                 return _extract_text_from_response(resp)
#             except TypeError:
#                 try:
#                     resp = try_call(client.chat.completions.create, model=model, input=messages_text)
#                     return _extract_text_from_response(resp)
#                 except Exception as e:
#                     print("WARN: client.chat.completions.create fallback failed:", e)
#     except Exception as e:
#         print("WARN: client.chat.completions.create failed:", e)

#     # 3) try client.models.generate_content
#     try:
#         if hasattr(client, "models") and hasattr(client.models, "generate_content"):
#             try:
#                 resp = try_call(client.models.generate_content, model=model, contents=[messages_text])
#                 return _extract_text_from_response(resp)
#             except Exception as e:
#                 # parse specific notable errors
#                 msg = str(e)
#                 if "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
#                     retry = _parse_retry_seconds_from_error(e)
#                     raise RuntimeError(f"RESOURCE_EXHAUSTED retry_after={retry} {msg}") from e
#                 if "NOT_FOUND" in msg or "not found" in msg.lower():
#                     # list models to help debugging
#                     print("Model not found for generate_content. Available models sample:", list_models()[:50])
#                     raise RuntimeError(f"MODEL_NOT_FOUND: {msg}") from e
#                 print("WARN: client.models.generate_content fallback failed:", e)
#     except Exception as e:
#         print("WARN: client.models.generate_content failed:", e)

#     # 4) try client.models.generate (other sdks)
#     try:
#         if hasattr(client, "models") and hasattr(client.models, "generate"):
#             try:
#                 try:
#                     resp = try_call(client.models.generate, model=model, input=messages_text)
#                 except TypeError:
#                     resp = try_call(client.models.generate, model=model, prompt=messages_text)
#                 return _extract_text_from_response(resp)
#             except Exception as e:
#                 msg = str(e)
#                 if "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower():
#                     retry = _parse_retry_seconds_from_error(e)
#                     raise RuntimeError(f"RESOURCE_EXHAUSTED retry_after={retry} {msg}") from e
#                 if "NOT_FOUND" in msg or "not found" in msg.lower():
#                     print("Model not found for generate. Available models sample:", list_models()[:50])
#                     raise RuntimeError(f"MODEL_NOT_FOUND: {msg}") from e
#                 print("WARN: client.models.generate failed:", e)
#     except Exception as e:
#         print("WARN: client.models.generate (outer) failed:", e)

#     # 5) last resort: plain text calls
#     try:
#         if hasattr(client, "predict"):
#             try:
#                 resp = try_call(client.predict, model=model, input=messages_text)
#                 return _extract_text_from_response(resp)
#             except Exception as e:
#                 print("WARN: client.predict failed:", e)
#         if hasattr(client, "complete"):
#             try:
#                 resp = try_call(client.complete, model=model, prompt=messages_text)
#                 return _extract_text_from_response(resp)
#             except Exception as e:
#                 print("WARN: client.complete failed:", e)
#     except Exception as e:
#         print("WARN: fallback plain text calls failed:", e)

#     # If nothing worked, show helpful debug
#     client_attrs = [n for n in dir(client) if not n.startswith("_")]
#     raise RuntimeError(
#         "Không thể gọi Gemini/GenAI: SDK hiện tại không hỗ trợ phương thức mong đợi.\n"
#         f"Client attrs sample: {client_attrs[:80]}\n"
#         "Gọi list_models() để biết tên model khả dụng hoặc kiểm tra GEMINI_MODEL env."
#     )
