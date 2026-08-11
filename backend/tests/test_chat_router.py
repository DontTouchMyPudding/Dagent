import pytest
from unittest.mock import AsyncMock, patch

import httpx

from api_main import create_app
from core.database import get_db
from services.exceptions import SessionNotFoundError


@pytest.fixture
def client():
    app = create_app()
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    transport = httpx.ASGITransport(app=app)
    return httpx.AsyncClient(transport=transport, base_url="http://test")


@pytest.mark.anyio
async def test_get_chat_list_returns_success(client):
    with patch("router.chat.SessionService") as MockService:
        instance = MockService.return_value
        instance.list_sessions = AsyncMock(return_value={"list": [], "total": 0})

        response = await client.get("/api/chat/list?page=1&size=10")

    assert response.status_code == 200
    assert response.json()["code"] == 0
    assert response.json()["data"] == {"list": [], "total": 0}


@pytest.mark.anyio
async def test_create_chat_returns_success(client):
    with patch("router.chat.SessionService") as MockService:
        instance = MockService.return_value
        instance.create_session = AsyncMock(return_value={
            "id": "s1",
            "name": "新对话",
            "created_at": "c1",
            "updated_at": "u1",
        })

        response = await client.post("/api/chat/create")

    assert response.status_code == 200
    assert response.json()["code"] == 0
    assert response.json()["data"]["id"] == "s1"


@pytest.mark.anyio
async def test_rename_returns_success(client):
    with patch("router.chat.SessionService") as MockService:
        instance = MockService.return_value
        instance.rename_session = AsyncMock(return_value=None)

        response = await client.post("/api/chat/rename", json={"session_id": "s1", "name": "new"})

    assert response.status_code == 200
    assert response.json()["code"] == 0


@pytest.mark.anyio
async def test_rename_returns_404_when_not_found(client):
    with patch("router.chat.SessionService") as MockService:
        instance = MockService.return_value
        instance.rename_session = AsyncMock(
            side_effect=SessionNotFoundError("会话不存在或无权限操作")
        )

        response = await client.post("/api/chat/rename", json={"session_id": "missing", "name": "new"})

    assert response.status_code == 200
    assert response.json()["code"] == 404
