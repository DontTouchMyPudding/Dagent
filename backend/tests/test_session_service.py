import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from services.exceptions import SessionNotFoundError
from services.session import SessionService


@pytest.fixture
def fake_db():
    return AsyncMock()


@pytest.fixture
def service_with_mocks(fake_db):
    with patch("services.session.SessionRepository") as MockRepo:
        repo_instance = AsyncMock()
        MockRepo.return_value = repo_instance
        service = SessionService(fake_db)
        yield service, repo_instance, fake_db


@pytest.mark.anyio
async def test_list_sessions_returns_formatted_data(service_with_mocks):
    service, repo, _ = service_with_mocks
    session = MagicMock()
    session.to_dict_method1.return_value = {"id": "s1", "name": "test"}
    repo.list_paginated.return_value = ([session], 1)

    result = await service.list_sessions(page=1, size=10)

    assert result == {"list": [{"id": "s1", "name": "test"}], "total": 1}
    repo.list_paginated.assert_awaited_once_with(page=1, size=10)


@pytest.mark.anyio
async def test_create_session_commits_and_returns_fields(service_with_mocks):
    service, repo, db = service_with_mocks
    session = MagicMock()
    session.id = "s1"
    session.name = "新对话"
    session.created_at = "c1"
    session.updated_at = "u1"
    repo.create.return_value = session

    result = await service.create_session()

    assert result == {
        "id": "s1",
        "name": "新对话",
        "created_at": "c1",
        "updated_at": "u1",
    }
    db.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_create_session_rolls_back_on_error(service_with_mocks):
    service, repo, db = service_with_mocks
    repo.create.return_value = MagicMock()
    db.commit.side_effect = RuntimeError("db error")

    with pytest.raises(RuntimeError):
        await service.create_session()

    db.rollback.assert_awaited_once()


@pytest.mark.anyio
async def test_rename_session_commits_when_found(service_with_mocks):
    service, repo, db = service_with_mocks
    repo.rename_by_id.return_value = MagicMock()

    await service.rename_session("s1", "new")

    repo.rename_by_id.assert_awaited_once_with("s1", "new")
    db.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_rename_session_raises_when_not_found(service_with_mocks):
    service, repo, _ = service_with_mocks
    repo.rename_by_id.return_value = None

    with pytest.raises(SessionNotFoundError):
        await service.rename_session("missing", "new")
