import asyncio
import logging
from dataclasses import dataclass, field
from typing import Dict, AsyncGenerator, Any, Optional, List

from runtime.stream_manage.base import StreamEvent, END_EVENT, HEARTBEAT_EVENT, StreamManager


@dataclass
class _RunStream:
    events: List[StreamEvent] = field(default_factory=list)
    condition: asyncio.Condition = field(default_factory=asyncio.Condition)


class StreamManageByMemo(StreamManager):
    def __init__(self):
        self._streams: Dict[str, _RunStream] = {}
        self._event_id_container: Dict[str, int] = {}

    def _get_or_create_stream(self, task_id: str) -> _RunStream:
        """创建或者获取StreamHistory"""
        if task_id not in self._streams:
            self._streams[task_id] = _RunStream()
            self._event_id_container[task_id] = 0
        return self._streams[task_id]

    def _get_next_id(self, task_id: str) -> str:
        """自增id"""
        current_id = self._event_id_container[task_id]
        self._event_id_container[task_id] += 1
        return str(current_id + 1)

    async def publish_end(self, task_id):
        stream = self._get_or_create_stream(task_id)
        async with stream.condition:
            stream.events.append(END_EVENT)
            stream.condition.notify_all()

    async def publish(self, task_id: str, event: str, data: Any):
        """主要负责发布event到self._streams"""
        stream = self._get_or_create_stream(task_id)
        stream_event = StreamEvent(id=str(self._get_next_id(task_id)), event=event, data=data)
        async with stream.condition:
            stream.events.append(stream_event)
            stream.condition.notify_all()

    async def subscribe(
            self,
            task_id: str,
            *,
            last_event_id: Optional[int] = None,
            heartbeat_interval: float = 1.5
    ) -> AsyncGenerator[StreamEvent, None]:
        stream = self._get_or_create_stream(task_id)
        index = last_event_id or 0
        while True:
            async with stream.condition:
                if stream and index < len(stream.events):
                    event = stream.events[index]
                    index += 1

                    if event is END_EVENT:
                        event = END_EVENT
                else:
                    try:
                        await asyncio.wait_for(stream.condition.wait(), timeout=heartbeat_interval)
                    except asyncio.TimeoutError:
                        event = HEARTBEAT_EVENT
                    else:
                        continue

            yield event
            if event is END_EVENT:
                break

    async def clear(self, task_id: str, delay: float = 0):
        if delay > 0:
            await asyncio.sleep(delay)
        self._streams.pop(task_id)
        self._event_id_container.pop(task_id)

    async def close(self):
        self._streams.clear()
        self._event_id_container.clear()


sm = StreamManageByMemo()
