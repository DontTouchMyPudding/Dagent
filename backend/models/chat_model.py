import uuid
from enum import Enum as _Enum
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Text, Enum, Index, String

from backend.models.base import Base


class Role(_Enum):
    USER = 'user'
    ASSISTANT = 'assistant'
    SYSTEM = 'system'


class Sessions(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(20), default="新对话")


class Messages(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uuid.uuid4)
    session_id: Mapped[str] = mapped_column(String(36), nullable=False)
    role: Mapped[Role] = mapped_column(Enum(Role), nullable=False)
    content: Mapped[str] = mapped_column(Text)

    __table_args__ = (
        Index("idx_session_created", "session_id", "created_at"),
    )
