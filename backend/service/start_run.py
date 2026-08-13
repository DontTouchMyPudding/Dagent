import asyncio
import json
import logging
from typing import Optional, List, Any, AsyncIterator
from langchain_core.messages import BaseMessage, ToolMessage, SystemMessage, HumanMessage
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from api_models.Chat import StreamChatBody
from config import Settings
from prompt.prompt import system_prompt
from runtime.stream_manage.base import StreamManager
from runtime.stream_manage.stream_manage import sm
from runtime.worker_manage.base import worker

settings = Settings()


async def agent_loop(
        llm,
        tools: list,
        messages: list[BaseMessage],
        max_iter: int = 10,
) -> AsyncIterator[dict]:
    tools_by_name = {t.name: t for t in tools}

    for step in range(max_iter):
        full_chunk = None

        async for chunk in llm.astream(messages):
            if reasoning_content := chunk.additional_kwargs.get("reasoning_content"):
                yield {"type": "think", "data": reasoning_content}
            if chunk.content:
                yield {"type": "token", "data": chunk.content}
            full_chunk = chunk if full_chunk is None else full_chunk + chunk

        if full_chunk is None:
            logging.warning("empty stream at step %s", step)
            break

        if not full_chunk.tool_calls:
            messages.append(full_chunk)
            break

        messages.append(full_chunk)

        for tc in full_chunk.tool_calls:
            yield {"type": "tool_call", "data": {"name": tc["name"], "args": tc["args"], "id": tc["id"]}}

            tool = tools_by_name.get(tc["name"])
            if tool is None:
                result = f"未找到工具: {tc['name']}"
                success = False
                error = result
            else:
                try:
                    result = await tool.ainvoke(tc["args"])
                    success = True
                    error = None
                except Exception as e:
                    result = f"工具执行出错: {e}"
                    success = False
                    error = str(e)

            yield {"type": "tool_result",
                   "data": {"name": tc["name"], "output": str(result), "success": success, "error": error}}
            messages.append(ToolMessage(content=str(result), tool_call_id=tc["id"]))

        if step == max_iter - 1:
            yield {"type": "warning", "data": "已达最大迭代次数，强制结束"}


async def run_agent(
        sm: StreamManager,
        task_id: str,
        messages: list[BaseMessage],
        tools: Optional[List[Any]] = None,
        system_prompt: Optional[str] = None):
    llm = ChatOpenAI(
        model=settings.LLM_MODEL_NAME,
        base_url=settings.LLM_BASE_URL,
        api_key=SecretStr(settings.LLM_API_KEY),
        streaming=True,
        timeout=60,
        extra_body={"enable_thinking": True}
    )
    llm_with_tools = llm.bind_tools(tools or [])
    full_messages = [SystemMessage(content=system_prompt or "你是一个AI助手"), *messages]
    try:
        async for chunk in agent_loop(llm_with_tools, tools or [], full_messages):
            await sm.publish(task_id, "token", json.dumps(chunk))
        await sm.publish_end(task_id)
        asyncio.create_task(sm.clear(task_id, 30))
    except Exception as e:
        logging.error(str(e))
        await sm.publish(task_id, "error", str(e))
        await sm.publish_end(task_id)
        asyncio.create_task(sm.clear(task_id, 30))


async def start_run(body: StreamChatBody):
    task_id = body.task_id
    message = HumanMessage(content=body.message)
    core = run_agent(sm, task_id, messages=[message], tools=[], system_prompt=system_prompt)
    worker.register(task_id, core)
