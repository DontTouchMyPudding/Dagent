import logging
import time
from random import randint
from typing import Annotated
from fastapi import APIRouter, Depends, Request
from fastapi.params import Query
from langchain_core.tools import tool
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.responses import StreamingResponse

from api_models.Chat import StreamChatBody, ResumeChatBody
from core.database import get_db
from runtime.worker_manage.base import worker
from schemas.response import Response
from service.sse_consumer import sse_consumer
from service.start_run import start_run
from services.exceptions import SessionNotFoundError
from services.session import SessionService

chat_app = APIRouter(prefix="/chat", tags=["chat"])

SessionDep = Annotated[AsyncSession, Depends(get_db)]


@tool
def get_water(city: str):
    """
    @param city: 城市
    获取指定城市当前的天气
    """
    time.sleep(randint(1, 5))
    return {"city": city, "water": "36°C"}


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
async def chat_stream(body: StreamChatBody, request: Request):
    await start_run(body)

    return StreamingResponse(sse_consumer(body.task_id, request), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "Transfer-Encoding": "chunked"
    })


@chat_app.post("/resume")
async def resume_chat_stream(body: ResumeChatBody, request: Request):
    return StreamingResponse(sse_consumer(body.task_id, request), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
        "Transfer-Encoding": "chunked"
    })


@chat_app.post("/stop/{task_id}")
async def stop_stream(task_id: str):
    try:
        await worker.stop(task_id)
        return Response.success()
    except Exception as e:
        return Response.error(500, str(e))
