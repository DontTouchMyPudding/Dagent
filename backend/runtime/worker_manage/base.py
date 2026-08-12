import asyncio
from typing import Dict, Coroutine
from asyncio import Task


class Worker:
    def __init__(self):
        self.container: Dict[str, Task] = {}

    def check_task(self, task_id: str):
        """检查task_id是否已经创建"""
        return task_id in self.container

    def register(self, task_id: str, task: Coroutine):
        """注册任务"""
        if self.check_task(task_id):
            return
        self.container[task_id] = asyncio.create_task(task)

    def stop(self, task_id: str):
        """停止任务"""
        if not self.check_task(task_id):
            return
        self.container[task_id].cancel()
        self.container.pop(task_id)


worker: Worker = Worker()
