import pytest
from unittest.mock import AsyncMock, MagicMock

from repositories.session import SessionRepository
from models.chat_model import Sessions


@pytest.fixture
def fake_db():
    db = AsyncMock()
    db.add = MagicMock()
    return db


@pytest.mark.anyio
async def test_list_paginated_returns_sessions_and_total(fake_db):
    session = Sessions(id="s1", name="test")

    count_result = MagicMock()
    count_result.scalar.return_value = 1

    list_result = MagicMock()
    list_result.scalars.return_value.all.return_value = [session]

    fake_db.execute.side_effect = [count_result, list_result]

    repo = SessionRepository(fake_db)
    sessions, total = await repo.list_paginated(page=1, size=10)

    assert total == 1
    assert len(sessions) == 1
    assert sessions[0].id == "s1"


@pytest.mark.anyio
async def test_create_returns_new_session(fake_db):
    repo = SessionRepository(fake_db)
    session = await repo.create()

    assert isinstance(session, Sessions)
    fake_db.add.assert_called_once_with(session)


@pytest.mark.anyio
async def test_rename_by_id_returns_updated_session(fake_db):
    updated = Sessions(id="s1", name="new")
    result = MagicMock()
    result.scalar_one_or_none.return_value = updated
    fake_db.execute.return_value = result

    repo = SessionRepository(fake_db)
    found = await repo.rename_by_id("s1", "new")

    assert found is not None
    assert found.name == "new"
    assert found is updated


@pytest.mark.anyio
async def test_rename_by_id_returns_none_when_not_found(fake_db):
    result = MagicMock()
    result.scalar_one_or_none.return_value = None
    fake_db.execute.return_value = result

    repo = SessionRepository(fake_db)
    found = await repo.rename_by_id("missing", "new")

    assert found is None
