import json
import logging
import uuid
from typing import Annotated
from fastapi import APIRouter, Depends
from fastapi.params import Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update
from starlette.responses import StreamingResponse

from core.database import get_db
from schemas.response import Response
from service import call_llm
from utils.stream_manage import sm
from models.chat_model import Sessions

chat_app = APIRouter(prefix="/chat", tags=["chat"])

SessionDep = Annotated[AsyncSession, Depends(get_db)]


class ChatRequest(BaseModel):
    message: str
    task_id: str


async def event_stream_task(task_id, commit, request: ChatRequest):
    try:
        history_message = [{"role": "user", "content": request.message}]
        async for steam_chunk in call_llm(history_message):
            await commit(task_id, json.dumps(steam_chunk.json(), ensure_ascii=False))
    except Exception as e:
        await commit(task_id, json.dumps({'error': str(e)}, ensure_ascii=False))


@chat_app.get("/list")
async def get_chat_list(
        db: SessionDep,
        page: int = Query(1, ge=1, description="页码"),
        size: int = Query(10, ge=1, le=100, description="每页条数")):
    try:
        count_stmt = select(func.count()).select_from(Sessions)
        count = (await db.execute(count_stmt)).scalar()
        stmt = select(Sessions).order_by(Sessions.updated_at).offset(page - 1).limit(size)
        sessions = (await db.execute(stmt)).scalars().all()
        return Response.success({"list": [i.to_dict_method1() for i in sessions], "total": count})
    except Exception as e:
        return Response.error(500, str(e))


@chat_app.post("/create")
async def create_chat(db: SessionDep):
    nid = uuid.uuid4()
    session = Sessions(id=nid)
    try:
        db.add(session)
        await db.commit()
        return Response.success(
            {
                "id": session.id,
                "name": session.name,
                "created_at": session.created_at,
                "updated_at": session.updated_at
            }
        )
    except Exception as e:
        await db.rollback()
        return Response.error(500, str(e))


class RenameRequest(BaseModel):
    session_id: str = Field(..., description="会话ID")
    name: str = Field(..., min_length=1, max_length=50, description="新的会话名称")


@chat_app.post("/rename")
async def rename(db: SessionDep, request: RenameRequest):
    try:
        stmt = update(Sessions).where(Sessions.id == request.session_id).values({"name": request.name}).returning(
            Sessions)
        result = await db.execute(stmt)
        updated = await result.first()
        if updated is None:
            return Response.error(
                code=404,
                msg="会话不存在或无权限操作"
            )
        return Response.success()
    except Exception as e:
        return Response.error(500, str(e))


@chat_app.post("/stream")
async def chat_stream(request: ChatRequest):
    task_id = sm.create_stream_task(request.task_id, event_stream_task, request=request)

    async def streaming():
        local_id = 0
        try:
            async for data in sm.subscript(task_id):
                local_id += 1
                yield f"id: {local_id}\nevent: token\ndata: {data}\n\n"
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
