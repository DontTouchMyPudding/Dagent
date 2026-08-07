import asyncio
import logging
from typing import Dict
from dataclasses import dataclass, field


@dataclass
class Task:
    history: asyncio.Queue = field(default_factory=asyncio.Queue)
    task: asyncio.Task | None = None


class StreamManage:
    def __init__(self):
        self._container: Dict[str, Task] = {}

    async def commit(self, task_id: str, values: str) -> None:
        await self._container[task_id].history.put(values)

    def __callback(self, task_id: str):
        logging.info(f"task {task_id} over! clear container cache")
        if task_id not in self._container:
            return
        self._container.pop(task_id)

    def create_stream_task(self, task_id: str, coro, *args, **kwargs):
        if self._container.get(task_id) is not None:
            return task_id
        self._container[task_id] = Task()
        task = asyncio.create_task(coro(task_id, self.commit, *args, **kwargs))
        task.add_done_callback(lambda _: self.__callback(task_id))
        self._container[task_id].task = task
        return task_id

    async def subscript(self, task_id: str):
        target = self._container[task_id]
        if not target:
            raise Exception(f"task {task_id} not found")
        logging.info("task id: %s", task_id)
        queue = target.history
        while not target.task.done() or not queue.empty():
            try:
                data = await asyncio.wait_for(queue.get(), timeout=1)
                yield data
            except asyncio.TimeoutError:
                continue

    async def stop(self, task_id: str):
        target = self._container[task_id]
        if not target:
            raise Exception(f"task {task_id} not found")
        if target.task.done():
            raise Exception(f"task {task_id} already done")
        target.task.cancel()
        logging.info("任务: %s,已经取消", task_id)


sm = StreamManage()
