import logging
from typing import Optional

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam

from config import Settings

settings = Settings()
client = AsyncOpenAI(api_key=settings.LLM_API_KEY, base_url=settings.LLM_BASE_URL)


async def call_llm(messages: list[ChatCompletionMessageParam], system_prompt: Optional[str] = None):
    inputs = [{"content": system_prompt, "role": "system"}, *messages]
    index = 0 if system_prompt else 1
    safe_messages = inputs[index:]
    logging.info(f"Safe messages: {safe_messages}")
    stream = await client.chat.completions.create(
        model=settings.LLM_MODEL_NAME,
        messages=safe_messages,
        stream=True,
        timeout=60
    )

    async for message in stream:
        yield message
