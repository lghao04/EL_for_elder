# test_groq.py
import asyncio
import os
from dotenv import load_dotenv

load_dotenv()

async def test():
    from services import llm_service
    
    # Init
    await llm_service.init_client()
    
    # Test
    messages = [
        {"role": "system", "content": "You are a helpful English teacher."},
        {"role": "user", "content": "Hello, how are you?"}
    ]
    
    response = await llm_service.chat_with_messages_async(messages)
    print(f"Response: {response}")
    
    # Close
    await llm_service.close_client()

if __name__ == "__main__":
    asyncio.run(test())