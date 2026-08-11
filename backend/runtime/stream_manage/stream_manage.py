import asyncio
import logging
from typing import Dict, AsyncGenerator

from runtime.stream_manage.base import StreamManager, Task, StreamEvent


class StreamManageByMemo(StreamManager):
    def __init__(self):
        self._container: Dict[str, Task] = {}

    def commit(self, task_id: str, event: StreamEvent) -> None:
        self._container[task_id].events.append(event)

    def __callback(self, task_id: str):
        logging.info(f"task {task_id} over! clear container cache")
        if task_id not in self._container:
            return
        self._container.pop(task_id)

    def publish(self, task_id: str, coro, *args, **kwargs):
        if self._container.get(task_id) is not None:
            return task_id
        self._container[task_id] = Task()
        task = asyncio.create_task(coro(task_id, self.commit, *args, **kwargs))
        task.add_done_callback(lambda _: self.__callback(task_id))
        self._container[task_id].task = task
        return task_id

    async def subscribe(self, task_id: str) -> AsyncGenerator[StreamEvent, None]:
        target = self._container[task_id]
        if not target:
            raise Exception(f"task {task_id} not found")
        events = target.events
        index = 0
        while not target.task.done():
            if index < len(events):
                yield events[index]
                index += 1
            else:
                await asyncio.sleep(0.1)

    async def stop(self, task_id: str):
        target = self._container[task_id]
        if not target:
            raise Exception(f"task {task_id} not found")
        if target.task.done():
            raise Exception(f"task {task_id} already done")
        target.task.cancel()
        logging.info("任务: %s,已经取消", task_id)


sm = StreamManageByMemo()
