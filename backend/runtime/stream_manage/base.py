import abc
import asyncio
from dataclasses import dataclass, field
from typing import AsyncGenerator, Any


@dataclass(frozen=True)
class StreamEvent:
    id: str
    event: str
    data: Any


@dataclass
class Task:
    events: list[StreamEvent] = field(default_factory=list)
    task: asyncio.Task | None = None


END_EVENT = StreamEvent(id='', event='__end__', data=None)
HEARTBEAT_EVENT = StreamEvent(id='', event='__heartbeat__', data=None)


class StreamManager(abc.ABC):
    @abc.abstractmethod
    def commit(self, task_id: str, event: StreamEvent) -> None:
        """"""
        pass

    @abc.abstractmethod
    def publish(self, task_id, coro, *args, **kwargs) -> str:
        """提交StreamEvent到对应Task的events"""
        pass

    @abc.abstractmethod
    async def subscribe(self, task_id: str) -> AsyncGenerator[StreamEvent, None]:
        """订阅事件"""
        pass

    @abc.abstractmethod
    async def stop(self, task_id) -> None:
        """停止订阅"""
        pass
