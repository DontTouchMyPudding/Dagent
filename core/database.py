from typing import Optional, AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession, AsyncEngine

_engine: Optional[AsyncEngine] = None
_async_session_maker: Optional[async_sessionmaker[AsyncSession]] = None


def init_db(base_url: str):
    global _engine, _async_session_maker
    _engine = create_async_engine(
        base_url,
        echo=True,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
        pool_recycle=3600,
    )
    _async_session_maker = async_sessionmaker(_engine, class_=AsyncSession, expire_on_commit=False)
    return _engine


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """【依赖注入核心】所有路由都通过 Depends 调用这个函数"""
    if _async_session_maker is None:
        raise RuntimeError("数据库未初始化，请先调用 init_db")
    async with _async_session_maker() as session:
        yield session


async def dispose_db():
    """应用关闭时调用，释放连接池"""
    global _engine
    if _engine:
        await _engine.dispose()
