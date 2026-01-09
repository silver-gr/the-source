"""Async SQLite database connection manager using aiosqlite."""

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

import aiosqlite

from app.config import Settings, get_settings

logger = logging.getLogger(__name__)


class Database:
    """Async database connection manager for SQLite using aiosqlite."""

    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize database manager.

        Args:
            settings: Application settings. Uses default settings if not provided.
        """
        self._settings = settings or get_settings()
        self._connection: aiosqlite.Connection | None = None

    @property
    def db_path(self) -> Path:
        """Get the database file path."""
        return self._settings.database_path

    async def connect(self) -> None:
        """Establish database connection and run migrations."""
        self._settings.ensure_data_directory()

        self._connection = await aiosqlite.connect(
            self.db_path,
            check_same_thread=False,
        )
        # Enable foreign keys and WAL mode for better concurrency
        await self._connection.execute("PRAGMA foreign_keys = ON")
        await self._connection.execute("PRAGMA journal_mode = WAL")
        # Use Row factory for dict-like access
        self._connection.row_factory = aiosqlite.Row

        logger.info(f"Connected to database: {self.db_path}")

        # Run migrations on startup
        await self.run_migrations()

    async def disconnect(self) -> None:
        """Close database connection."""
        if self._connection:
            await self._connection.close()
            self._connection = None
            logger.info("Disconnected from database")

    async def run_migrations(self) -> None:
        """Run all pending migrations."""
        if not self._connection:
            raise RuntimeError("Database not connected")

        migrations_dir = Path(__file__).parent.parent / "migrations"
        if not migrations_dir.exists():
            logger.warning(f"Migrations directory not found: {migrations_dir}")
            return

        # Get list of migration files
        migration_files = sorted(migrations_dir.glob("*.sql"))

        for migration_file in migration_files:
            logger.info(f"Running migration: {migration_file.name}")
            sql = migration_file.read_text()

            # Execute migration (split by semicolons for multiple statements)
            await self._connection.executescript(sql)
            await self._connection.commit()

        logger.info(f"Completed {len(migration_files)} migration(s)")

    @asynccontextmanager
    async def get_connection(self) -> AsyncGenerator[aiosqlite.Connection, None]:
        """Get database connection as async context manager.

        Yields:
            Active database connection.

        Raises:
            RuntimeError: If database is not connected.
        """
        if not self._connection:
            raise RuntimeError("Database not connected. Call connect() first.")
        yield self._connection

    async def execute(
        self, sql: str, parameters: tuple | dict | None = None
    ) -> aiosqlite.Cursor:
        """Execute a SQL query.

        Args:
            sql: SQL query string.
            parameters: Query parameters.

        Returns:
            Cursor for the executed query.
        """
        if not self._connection:
            raise RuntimeError("Database not connected")
        return await self._connection.execute(sql, parameters or ())

    async def execute_many(
        self, sql: str, parameters: list[tuple | dict]
    ) -> aiosqlite.Cursor:
        """Execute a SQL query with multiple parameter sets.

        Args:
            sql: SQL query string.
            parameters: List of query parameters.

        Returns:
            Cursor for the executed query.
        """
        if not self._connection:
            raise RuntimeError("Database not connected")
        return await self._connection.executemany(sql, parameters)

    async def fetchone(
        self, sql: str, parameters: tuple | dict | None = None
    ) -> aiosqlite.Row | None:
        """Execute query and fetch single row.

        Args:
            sql: SQL query string.
            parameters: Query parameters.

        Returns:
            Single row or None if no results.
        """
        cursor = await self.execute(sql, parameters)
        return await cursor.fetchone()

    async def fetchall(
        self, sql: str, parameters: tuple | dict | None = None
    ) -> list[aiosqlite.Row]:
        """Execute query and fetch all rows.

        Args:
            sql: SQL query string.
            parameters: Query parameters.

        Returns:
            List of rows.
        """
        cursor = await self.execute(sql, parameters)
        return await cursor.fetchall()

    async def commit(self) -> None:
        """Commit current transaction."""
        if self._connection:
            await self._connection.commit()


# Global database instance
_database: Database | None = None


def get_database() -> Database:
    """Get the global database instance.

    Returns:
        Database instance.

    Raises:
        RuntimeError: If database has not been initialized.
    """
    global _database
    if _database is None:
        _database = Database()
    return _database


async def init_database(settings: Settings | None = None) -> Database:
    """Initialize and connect the global database instance.

    Args:
        settings: Optional settings override.

    Returns:
        Connected database instance.
    """
    global _database
    _database = Database(settings)
    await _database.connect()
    return _database


async def close_database() -> None:
    """Close the global database connection."""
    global _database
    if _database:
        await _database.disconnect()
        _database = None
