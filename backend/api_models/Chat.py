from typing import Optional

from pydantic import BaseModel


class StreamChatBody(BaseModel):
    message: Optional[str] = None
    task_id: str


class ResumeChatBody(BaseModel):
    task_id: str
