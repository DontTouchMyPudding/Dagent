import asyncio
import json
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

import httpx
import pytest

from api_main import create_app
from router.chat import ChatRequest, event_stream_task
from utils.stream_manage import sm


class FakeChunk:
    def json(self):
        return json.dumps({"choices": [{"delta": {"content": "hi"}}]})


async def fake_call_llm(*_args, **_kwargs):
    yield FakeChunk()
    yield FakeChunk()


def test_subscript_exits_after_llm_finishes():
    """LLM 流正常结束后，subscript 生成器必须退出并发出 [DONE] 标记。"""

    async def run():
        request = ChatRequest(message="hello")
        with patch("router.chat.call_llm", fake_call_llm):
            task_id = sm.create_stream_task(event_stream_task, request=request)
            chunks = []
            async for chunk in sm.subscript(task_id):
                chunks.append(chunk)
        return chunks

    chunks = asyncio.run(run())

    assert len(chunks) == 3  # 两个 token 事件 + 一个 [DONE] 事件
    assert "data: [DONE]" in chunks[-1]


@pytest.mark.anyio
async def test_http_stream_closes_when_llm_finishes():
    """通过 HTTP SSE 接口验证 LLM 流结束后响应自动关闭。"""
    with patch("router.chat.call_llm", fake_call_llm):
        transport = httpx.ASGITransport(app=create_app())
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            async with client.stream("POST", "/chat/stream", json={"message": "hello"}) as response:
                response.raise_for_status()
                body = b""
                async for chunk in response.aiter_bytes():
                    body += chunk

    assert b"event: token" in body
    assert b"data: [DONE]" in body
