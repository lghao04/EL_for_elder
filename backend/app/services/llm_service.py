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