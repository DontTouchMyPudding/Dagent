import json
import logging
from typing import Optional, List, Any, AsyncIterator

from langchain.agents import create_agent
from langchain_core.messages import BaseMessage, ToolMessage, SystemMessage
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

from config import Settings

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
        messages: list[BaseMessage],
        tools: Optional[List[Any]] = None,
        system_prompt: Optional[str] = None) -> AsyncIterator[dict]:
    llm = ChatOpenAI(
        model=settings.LLM_MODEL_NAME,
        base_url=settings.LLM_BASE_URL,
        api_key=SecretStr(settings.LLM_API_KEY),
        streaming=True,
        timeout=60,
        extra_body={"enable_thinking": True}
    )
    llm_with_tools = llm.bind_tools(tools or [])
    full_messages = [SystemMessage(content=system_prompt or ""), *messages]
    async for chunk in agent_loop(llm_with_tools, tools or [], full_messages):
        yield chunk


async def run_agent2(messages: list[BaseMessage],
                     tools: Optional[List[Any]] = None, ):
    llm = ChatOpenAI(
        model=settings.LLM_MODEL_NAME,
        base_url=settings.LLM_BASE_URL,
        api_key=SecretStr(settings.LLM_API_KEY),
        streaming=True,
        timeout=60,
        extra_body={"enable_thinking": True}
    )
    agent = create_agent(model=llm, tools=tools)
    stream = await agent.astream_events(input={"messages": messages}, version="v2")
    async for message in stream.messages:
        if hasattr(message, "tool_calls") and message.tool_calls:
            async for tool_call in message.tool_calls:
                result = {"type": "tools", "content": tool_call}
                logging.info(result)
                yield result
        async for chunk in message.text:
            result = {"type": "token", "content": chunk}
            logging.info(result)
            yield result
