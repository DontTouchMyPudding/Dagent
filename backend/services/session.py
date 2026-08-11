from sqlalchemy.ext.asyncio import AsyncSession

from repositories.session import SessionRepository
from services.exceptions import SessionNotFoundError


class SessionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = SessionRepository(db)

    async def list_sessions(self, page: int, size: int) -> dict:
        sessions, total = await self.repo.list_paginated(page=page, size=size)
        return {"list": [s.to_dict_method1() for s in sessions], "total": total}

    async def create_session(self) -> dict:
        session = await self.repo.create()
        try:
            await self.db.commit()
            return {
                "id": session.id,
                "name": session.name,
                "created_at": session.created_at,
                "updated_at": session.updated_at,
            }
        except Exception:
            await self.db.rollback()
            raise

    async def rename_session(self, session_id: str, name: str) -> None:
        updated = await self.repo.rename_by_id(session_id, name)
        if updated is None:
            raise SessionNotFoundError("会话不存在或无权限操作")
        try:
            await self.db.commit()
        except Exception:
            await self.db.rollback()
            raise
