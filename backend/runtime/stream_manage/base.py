import abc
import asyncio
from dataclasses import dataclass, field
from typing import AsyncGenerator, Any, Optional


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
    async def publish(self, task_id: str, event: str, data: Any):
        """提交StreamEvent到对应Task的events"""
        pass

    @abc.abstractmethod
    async def publish_end(self, task_id):
        """发送结束信号"""
        pass

    @abc.abstractmethod
    async def subscribe(
            self,
            task_id: str,
            *,
            last_event_id: Optional[int] = None,
            heartbeat_interval: float = 1.5
    ) -> AsyncGenerator[StreamEvent, None]:
        """订阅事件"""
        pass

    @abc.abstractmethod
    async def clear(self, task_id: str, delay: float = 0):
        """清楚指定的task_id,用于结束时清楚"""
        pass

    @abc.abstractmethod
    async def close(self):
        """清楚所有"""
        pass
