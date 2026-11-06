"""
Alembic migration initialization script.
Run this after Docker containers are up.
"""

import asyncio
import logging
from sqlalchemy import text
from app.db import get_db_context
from app.db import Base

logger = logging.getLogger(__name__)


async def init_migrations():
    """Initialize database for Alembic migrations."""
    async with get_db_context() as session:
        try:
            # Enable pgvector extension
            await session.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
            await session.commit()
            logger.info("✓ pgvector extension enabled")
        except Exception as e:
            logger.warning(f"pgvector extension: {e}")

        try:
            # Create all tables from models
            async with session.connection() as conn:
                await conn.run_sync(Base.metadata.create_all)
            await session.commit()
            logger.info("✓ Database tables created")
        except Exception as e:
            logger.error(f"Failed to create tables: {e}")
            await session.rollback()
            raise


if __name__ == "__main__":
    asyncio.run(init_migrations())
