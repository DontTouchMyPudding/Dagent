import json
import logging
import time
from random import randint
from typing import Annotated, Optional
from fastapi import APIRouter, Depends
from fastapi.params import Query
from langchain_core.tools import tool
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from core.database import get_db
from runtime.stream_manage.base import StreamEvent
from runtime.stream_manage.stream_manage import sm
from schemas.response import Response
from service import run_agent
from services.exceptions import SessionNotFoundError
from services.session import SessionService

chat_app = APIRouter(prefix="/chat", tags=["chat"])

SessionDep = Annotated[AsyncSession, Depends(get_db)]


class ChatRequest(BaseModel):
    message: Optional[str] = None
    task_id: str


@tool
def get_water(city: str):
    """
    @param city: 城市
    获取指定城市当前的天气
    """
    time.sleep(randint(1, 5))
    return {"city": city, "water": "36°C"}


async def event_stream_task(task_id, commit, request: ChatRequest):
    local_id = 0
    try:
        history_message = [{"role": "user", "content": request.message}]
        async for steam_chunk in run_agent(history_message, tools=[get_water]):
            local_id += 1
            event = StreamEvent(id=str(local_id), event="token",
                                data=json.dumps(steam_chunk, ensure_ascii=False))
            commit(task_id, event)
    except Exception as e:
        logging.error(e)
        local_id += 1
        event = StreamEvent(id=str(local_id), event="error", data=str(e))
        commit(task_id, event)


@chat_app.get("/list")
async def get_chat_list(
        db: SessionDep,
        page: int = Query(1, ge=1, description="页码"),
        size: int = Query(10, ge=1, le=100, description="每页条数")):
    try:
        service = SessionService(db)
        data = await service.list_sessions(page=page, size=size)
        return Response.success(data)
    except Exception as e:
        logging.exception("get_chat_list failed")
        return Response.error(500, str(e))


@chat_app.post("/create")
async def create_chat(db: SessionDep):
    try:
        service = SessionService(db)
        data = await service.create_session()
        return Response.success(data)
    except Exception as e:
        logging.exception("create_chat failed")
        return Response.error(500, str(e))


class RenameRequest(BaseModel):
    session_id: str = Field(..., description="会话ID")
    name: str = Field(..., min_length=1, max_length=50, description="新的会话名称")


@chat_app.post("/rename")
async def rename(db: SessionDep, request: RenameRequest):
    try:
        service = SessionService(db)
        await service.rename_session(request.session_id, request.name)
        return Response.success()
    except SessionNotFoundError as e:
        return Response.error(
            code=404,
            msg=str(e)
        )
    except Exception as e:
        logging.exception("rename failed")
        return Response.error(500, str(e))


@chat_app.post("/stream")
async def chat_stream(body: ChatRequest):
    task_id = sm.publish(body.task_id, event_stream_task, request=body)

    async def streaming():
        try:
            async for data in sm.subscribe(task_id):
                yield f"id: {data.id}\nevent: {data.event}\ndata: {data.data}\n\n"
        except Exception as e:
            yield f"event: error\ndata: {str(e)}"

    return StreamingResponse(streaming(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "Transfer-Encoding": "chunked"
    })


@chat_app.post("/stop/{task_id}")
async def stop_stream(task_id: str):
    try:
        await sm.stop(task_id)
        return Response.success()
    except Exception as e:
        return Response.error(500, str(e))
