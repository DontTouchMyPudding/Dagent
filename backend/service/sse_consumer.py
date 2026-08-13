import logging
from fastapi import Request
from runtime.stream_manage.stream_manage import sm


async def sse_consumer(task_id: str, request: Request):
    try:
        async for data in sm.subscribe(task_id):
            if await request.is_disconnected():
                break
            yield f"id: {data.id}\nevent: {data.event}\ndata: {data.data}\n\n"
    except Exception as e:
        logging.error(str(e))
        yield f"event: error\ndata: {str(e)}"
