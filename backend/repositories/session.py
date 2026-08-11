from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from models.chat_model import Sessions


class SessionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_paginated(self, page: int, size: int) -> tuple[list[Sessions], int]:
        count_stmt = select(func.count()).select_from(Sessions)
        total = (await self.db.execute(count_stmt)).scalar()

        stmt = (
            select(Sessions)
            .order_by(Sessions.updated_at)
            .offset((page - 1) * size)
            .limit(size)
        )
        sessions = (await self.db.execute(stmt)).scalars().all()
        return sessions, total

    async def create(self) -> Sessions:
        session = Sessions()
        self.db.add(session)
        return session

    async def rename_by_id(self, session_id: str, name: str) -> Sessions | None:
        stmt = select(Sessions).where(Sessions.id == session_id)
        result = await self.db.execute(stmt)
        session = result.scalar_one_or_none()
        if session is None:
            return None
        session.name = name
        return session
