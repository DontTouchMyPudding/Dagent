import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, APIRouter
from sqlalchemy.engine.base import Connection

from core.database import init_db, dispose_db
from router import chat_app
from alembic import context

logging.basicConfig(level=logging.INFO)
from models.base import Base

target_metadata = Base.metadata


@asynccontextmanager
async def lifespan(app: FastAPI):
    logging.info("正在初始化数据库连接池...")
    engine = init_db("mysql+asyncmy://root:123456@127.0.0.1:3306/agent_project")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    logging.info("关闭数据库链接....")
    await dispose_db()


def create_app():
    app = FastAPI(lifespan=lifespan)
    api_router = APIRouter(prefix="/api")
    api_router.include_router(chat_app)
    app.include_router(api_router)
    return app


if __name__ == '__main__':
    uvicorn.run(
        "api_main:create_app",
        host="0.0.0.0",
        port=8000,
        env_file=".env"
    )
