import asyncio
from typing import Dict, Coroutine
from asyncio import Task


class Worker:
    def __init__(self):
        self.container: Dict[str, Task] = {}

    def _callback(self, task_id: str):
        self.container.pop(task_id)

    def check_task(self, task_id: str):
        """检查task_id是否已经创建"""
        return task_id in self.container

    def register(self, task_id: str, task: Coroutine):
        """注册任务"""
        if self.check_task(task_id):
            return
        self.container[task_id] = asyncio.create_task(task)
        self.container[task_id].add_done_callback(lambda _: self._callback(task_id))

    def stop(self, task_id: str):
        """停止任务"""
        if not self.check_task(task_id):
            return
        self.container[task_id].cancel()


worker: Worker = Worker()
