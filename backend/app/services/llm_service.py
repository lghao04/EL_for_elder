# app/services/llm_service.py
import os
from typing import List, Dict
from groq import AsyncGroq

# Global async client
_client = None

async def init_client():
    """Initialize Groq async client"""
    global _client
    
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise RuntimeError("GROQ_API_KEY not found in environment variables")
    
    _client = AsyncGroq(api_key=api_key)
    print("✅ Groq AsyncClient initialized")

async def close_client():
    """Close Groq client (if needed)"""
    global _client
    _client = None
    print("✅ Groq client closed")

async def chat_with_messages_async(
    messages: List[Dict[str, str]], 
    model: str = None,
    temperature: float = 0.7,
    max_tokens: int = 1024
) -> str:
    """
    Send messages to Groq LLM and get response
    
    Args:
        messages: List of message dicts with 'role' and 'content'
        model: Model name (defaults to GROQ_MODEL env var)
        temperature: Sampling temperature
        max_tokens: Maximum tokens in response
    
    Returns:
        Assistant's response text
    """
    global _client
    
    if _client is None:
        raise RuntimeError("Groq client not initialized. Call init_client() first.")
    
    # Get model from env if not specified
    if model is None:
        model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    
    try:
        print(f"=== Calling Groq LLM ({model}) ===")
        print(f"Messages: {len(messages)} messages")
        for msg in messages:
            print(f"  {msg['role']}: {msg['content'][:100]}...")
        
        # Call Groq API
        chat_completion = await _client.chat.completions.create(
            messages=messages,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        
        # Extract response
        response_text = chat_completion.choices[0].message.content
        
        print(f"=== LLM Response ===")
        print(f"{response_text[:200]}...")
        
        return response_text
        
    except Exception as e:
        print(f"❌ Groq API Error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise

# Optional: Quick test function
async def quick_test():
    """Test the Groq client"""
    if _client is None:
        print("❌ Client not initialized")
        return
    
    test_messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello! How are you?"}
    ]
    
    response = await chat_with_messages_async(test_messages)
    print(f"✅ Test successful: {response}")


     # app/services/llm_service.py
# import os
# import json
# import asyncio
# import inspect
# from typing import Optional, List, Dict, Any

# # Try to import groq SDK (may be sync or async)
# _groq_module = None
# try:
#     import groq as _groq_module  # type: ignore
# except Exception:
#     _groq_module = None

# # async http client fallback
# try:
#     import httpx  # pip install httpx
# except Exception:
#     httpx = None

# # Global client (could be SDK client or our HTTP wrapper)
# _client: Optional[Any] = None
# _client_type: Optional[str] = None  # "sdk-async", "sdk-sync", "httpx"

# # -----------------------
# # Init / shutdown
# # -----------------------
# async def init_client() -> None:
#     """
#     Async initialize the Groq client.
#     - If `groq` SDK exists and provides an async client -> use it.
#     - Else, use httpx.AsyncClient as REST fallback.
#     Required env:
#       - GROQ_API_KEY
#       - if using REST fallback: GROQ_API_BASE (e.g., https://api.groq.ai/v1)
#     """
#     global _client, _client_type
#     if _client is not None:
#         return  # already init

#     api_key = os.getenv("GROQ_API_KEY")
#     if not api_key:
#         raise RuntimeError("GROQ_API_KEY không được đặt trong environment.")

#     # Try SDK path
#     if _groq_module is not None:
#         # heuristics: see if module exposes an async client or Client class
#         ClientCls = getattr(_groq_module, "AsyncClient", None) or getattr(_groq_module, "Client", None) or getattr(_groq_module, "GroqClient", None)
#         if ClientCls is not None:
#             # try instantiate and detect if async-capable
#             try:
#                 # try common constructor patterns
#                 try:
#                     client = ClientCls(api_key=api_key)
#                 except TypeError:
#                     try:
#                         client = ClientCls({"api_key": api_key})
#                     except Exception:
#                         client = ClientCls()
#                 # detect async methods
#                 if hasattr(client, "chat") and inspect.iscoroutinefunction(getattr(client, "chat")):
#                     _client = client
#                     _client_type = "sdk-async"
#                     return
#                 # if chat is sync, still accept but mark as sync
#                 if hasattr(client, "chat") or hasattr(client, "infer") or hasattr(client, "generate"):
#                     _client = client
#                     _client_type = "sdk-sync"
#                     return
#             except Exception:
#                 # fall through to httpx fallback
#                 pass

#     # HTTP fallback
#     base = os.getenv("GROQ_API_BASE")
#     if not base:
#         raise RuntimeError("Không tìm thấy Groq SDK và GROQ_API_BASE chưa đặt. Set GROQ_API_BASE nếu muốn dùng REST fallback.")
#     if httpx is None:
#         raise RuntimeError("httpx chưa được cài. Cài bằng `pip install httpx` để dùng REST fallback.")

#     async_client = httpx.AsyncClient(
#         base_url=base.rstrip("/"),
#         headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
#         timeout=30.0,
#     )
#     _client = async_client
#     _client_type = "httpx"


# async def close_client() -> None:
#     """
#     Close resources (httpx client) if needed.
#     """
#     global _client, _client_type
#     if _client is None:
#         return
#     try:
#         if _client_type == "httpx" and isinstance(_client, httpx.AsyncClient):
#             await _client.aclose()
#     except Exception:
#         pass
#     _client = None
#     _client_type = None


# # -----------------------
# # Helpers
# # -----------------------
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


# def _extract_text_from_response(resp: Any) -> str:
#     # try common patterns
#     try:
#         if hasattr(resp, "text") and isinstance(resp.text, str) and resp.text:
#             return resp.text
#         if hasattr(resp, "output_text") and resp.output_text:
#             return resp.output_text
#     except Exception:
#         pass

#     if isinstance(resp, dict):
#         if "text" in resp and isinstance(resp["text"], str):
#             return resp["text"]
#         if "output_text" in resp and isinstance(resp["output_text"], str):
#             return resp["output_text"]
#         # try outputs/results/choices
#         for key in ("outputs", "results", "choices", "generations"):
#             outs = resp.get(key)
#             if isinstance(outs, list) and outs:
#                 first = outs[0]
#                 if isinstance(first, dict):
#                     for k in ("content", "text", "output"):
#                         if k in first:
#                             val = first[k]
#                             if isinstance(val, str):
#                                 return val
#                             if isinstance(val, list) and val:
#                                 # join strings or dict->text
#                                 if all(isinstance(i, str) for i in val):
#                                     return "".join(val)
#                                 try:
#                                     return "".join([i.get("text", "") for i in val if isinstance(i, dict)])
#                                 except Exception:
#                                     pass
#     try:
#         return str(resp)
#     except Exception:
#         return ""


# # -----------------------
# # Main chat function (async)
# # -----------------------
# async def chat_with_messages_async(messages: List[Dict[str, str]], model: Optional[str] = None, **call_opts) -> str:
#     """
#     Async chat wrapper.
#     - messages: list of {role, content}
#     - model: override model (else GROQ_MODEL env or 'groq-1')
#     - call_opts: forwarded (temperature, max_tokens...) depending on client support
#     """
#     global _client, _client_type
#     if _client is None:
#         raise RuntimeError("Groq client chưa được khởi tạo. Gọi await init_client() trong startup.")

#     model = model or os.getenv("GROQ_MODEL") or "groq-1"
#     prompt = _messages_to_text(messages)

#     # 1) SDK async
#     if _client_type == "sdk-async":
#         # assume method client.chat(model=..., messages=..., **call_opts) is coroutine
#         try:
#             resp = await _client.chat(model=model, messages=messages, **call_opts)
#             return _extract_text_from_response(resp)
#         except Exception as e:
#             # try generate/infer style
#             pass

#     # 2) SDK sync (wrap in executor)
#     if _client_type == "sdk-sync":
#         loop = asyncio.get_running_loop()
#         # try common sync methods in executor
#         def _sync_call():
#             # try chat.create or chat or infer or generate in order
#             if hasattr(_client, "chat"):
#                 try:
#                     fn = getattr(_client, "chat")
#                     # some SDKs expect .chat.create
#                     if hasattr(fn, "create"):
#                         return fn.create(model=model, messages=messages, **call_opts)
#                     return fn(model=model, messages=messages, **call_opts)
#                 except TypeError:
#                     # try other signatures
#                     try:
#                         return fn(model=model, input=_messages_to_text(messages), **call_opts)
#                     except Exception:
#                         pass
#             for name in ("infer", "generate", "create", "predict", "complete"):
#                 if hasattr(_client, name):
#                     fn = getattr(_client, name)
#                     try:
#                         return fn(model=model, input=prompt, **call_opts)
#                     except TypeError:
#                         try:
#                             return fn(model=model, prompt=prompt, **call_opts)
#                         except Exception:
#                             pass
#             # if nothing matched, raise
#             raise RuntimeError("No suitable sync method found on SDK client.")
#         resp = await loop.run_in_executor(None, _sync_call)
#         return _extract_text_from_response(resp)

#     # 3) HTTPX fallback
#     if _client_type == "httpx":
#         # default REST shape: POST /models/{model}/infer with {"input": "..."}
#         url = f"/models/{model}/infer"
#         payload = {"input": prompt}
#         # merge call_opts (e.g., temperature, max_tokens) if provided
#         payload.update(call_opts or {})
#         assert isinstance(_client, httpx.AsyncClient)
#         resp = await _client.post(url, json=payload)
#         resp.raise_for_status()
#         data = resp.json()
#         return _extract_text_from_response(data)

#     # unknown client type
#     raise RuntimeError(f"Unsupported client type: {_client_type}")


# # Optional quick async test
# async def quick_test_async():
#     if _client is None:
#         print("Client chưa sẵn sàng. Gọi init_client() trước.")
#         return
#     model = os.getenv("GROQ_MODEL", "groq-1")
#     out = await chat_with_messages_async([{"role": "user", "content": "Xin chào Groq!"}], model=model)
#     print("Quick test output:", out)