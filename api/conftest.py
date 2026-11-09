"""
api/conftest.py — shared pytest configuration.

Patches app.db and sqlalchemy.ext.asyncio before any app.* imports trigger
asyncpg/greenlet at module level. This allows test_detectors.py and
test_security.py to import app.* modules without requiring asyncpg or a
live database.
"""
import sys
import types
from unittest.mock import AsyncMock, MagicMock


def _make_fake_asyncio_module():
    """Return a fake sqlalchemy.ext.asyncio that doesn't require greenlet."""
    mod = types.ModuleType("sqlalchemy.ext.asyncio")
    mod.AsyncSession = MagicMock(name="AsyncSession")
    mod.create_async_engine = MagicMock(name="create_async_engine")
    mod.async_sessionmaker = MagicMock(name="async_sessionmaker")
    mod.AsyncEngine = MagicMock(name="AsyncEngine")
    return mod


class FakeBase:
    __subclasses__ = []
    metadata = MagicMock()

    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

def _make_fake_db_module():
    """Return a fake app.db module that does not import asyncpg."""
    mod = types.ModuleType("app.db")
    mod.engine = MagicMock(name="engine")
    mod.async_session_maker = MagicMock(name="async_session_maker")
    mod.Base = FakeBase
    mod.get_async_database_url = lambda url: url

    async def _fake_get_db():
        yield AsyncMock()

    mod.get_db = _fake_get_db
    mod.init_db = AsyncMock()
    mod.close_db = AsyncMock()
    return mod


# Install fakes before any test module has a chance to import the real modules.
# Order matters: sqlalchemy.ext.asyncio must be patched before app.db.
if "sqlalchemy.ext.asyncio" not in sys.modules:
    sys.modules["sqlalchemy.ext.asyncio"] = _make_fake_asyncio_module()

if "app.db" not in sys.modules:
    sys.modules["app.db"] = _make_fake_db_module()
