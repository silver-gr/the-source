"""Repository for sync_log data access operations."""

import logging
from datetime import datetime
from typing import Any, Literal

from app.database import Database

logger = logging.getLogger(__name__)


class SyncRepository:
    """Repository for sync log CRUD operations and queries."""

    def __init__(self, database: Database) -> None:
        """Initialize repository with database connection.

        Args:
            database: Database instance.
        """
        self._db = database

    def _row_to_dict(self, row) -> dict[str, Any]:
        """Convert database row to dictionary.

        Args:
            row: Database row.

        Returns:
            Dictionary representation of the row.
        """
        return dict(row)

    async def create_log_entry(self, source: str) -> dict[str, Any]:
        """Create a new sync log entry when sync starts.

        Args:
            source: Source platform name.

        Returns:
            Created log entry dictionary.
        """
        started_at = datetime.utcnow().isoformat()

        sql = """
            INSERT INTO sync_log (source, started_at, status, items_synced)
            VALUES (?, ?, 'running', 0)
        """
        cursor = await self._db.execute(sql, (source, started_at))
        await self._db.commit()

        log_id = cursor.lastrowid
        logger.info(f"Created sync log entry {log_id} for source: {source}")

        return await self.get_by_id(log_id)  # type: ignore

    async def get_by_id(self, log_id: int) -> dict[str, Any] | None:
        """Get sync log entry by ID.

        Args:
            log_id: Log entry ID.

        Returns:
            Log entry dictionary or None if not found.
        """
        row = await self._db.fetchone(
            "SELECT * FROM sync_log WHERE id = ?", (log_id,)
        )
        return self._row_to_dict(row) if row else None

    async def update_log_entry(
        self,
        log_id: int,
        status: Literal["running", "completed", "failed"],
        items_synced: int | None = None,
        errors: str | None = None,
    ) -> dict[str, Any] | None:
        """Update a sync log entry.

        Args:
            log_id: Log entry ID.
            status: New status.
            items_synced: Number of items synced.
            errors: Error message if any.

        Returns:
            Updated log entry or None if not found.
        """
        completed_at = datetime.utcnow().isoformat() if status in ("completed", "failed") else None

        update_parts = ["status = ?"]
        params: list[Any] = [status]

        if completed_at:
            update_parts.append("completed_at = ?")
            params.append(completed_at)

        if items_synced is not None:
            update_parts.append("items_synced = ?")
            params.append(items_synced)

        if errors is not None:
            update_parts.append("errors = ?")
            params.append(errors)

        params.append(log_id)

        sql = f"UPDATE sync_log SET {', '.join(update_parts)} WHERE id = ?"
        await self._db.execute(sql, tuple(params))
        await self._db.commit()

        logger.info(f"Updated sync log entry {log_id}: status={status}")
        return await self.get_by_id(log_id)

    async def complete_sync(
        self, log_id: int, items_synced: int, errors: str | None = None
    ) -> dict[str, Any] | None:
        """Mark a sync as completed.

        Args:
            log_id: Log entry ID.
            items_synced: Total items synced.
            errors: Any non-fatal errors that occurred.

        Returns:
            Updated log entry.
        """
        return await self.update_log_entry(
            log_id, status="completed", items_synced=items_synced, errors=errors
        )

    async def fail_sync(self, log_id: int, error_message: str) -> dict[str, Any] | None:
        """Mark a sync as failed.

        Args:
            log_id: Log entry ID.
            error_message: Error description.

        Returns:
            Updated log entry.
        """
        return await self.update_log_entry(
            log_id, status="failed", errors=error_message
        )

    async def get_latest_by_source(self, source: str) -> dict[str, Any] | None:
        """Get the most recent sync log entry for a source.

        Args:
            source: Source platform name.

        Returns:
            Latest log entry or None.
        """
        row = await self._db.fetchone(
            """
            SELECT * FROM sync_log
            WHERE source = ?
            ORDER BY started_at DESC
            LIMIT 1
            """,
            (source,),
        )
        return self._row_to_dict(row) if row else None

    async def get_last_successful_sync(self, source: str) -> dict[str, Any] | None:
        """Get the most recent successful sync for a source.

        Args:
            source: Source platform name.

        Returns:
            Latest successful log entry or None.
        """
        row = await self._db.fetchone(
            """
            SELECT * FROM sync_log
            WHERE source = ? AND status = 'completed'
            ORDER BY started_at DESC
            LIMIT 1
            """,
            (source,),
        )
        return self._row_to_dict(row) if row else None

    async def is_sync_running(self, source: str) -> bool:
        """Check if a sync is currently running for a source.

        Args:
            source: Source platform name.

        Returns:
            True if a sync is running.
        """
        row = await self._db.fetchone(
            """
            SELECT 1 FROM sync_log
            WHERE source = ? AND status = 'running'
            LIMIT 1
            """,
            (source,),
        )
        return row is not None

    async def get_history(
        self,
        source: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        """Get sync history with optional filtering.

        Args:
            source: Optional source filter.
            limit: Maximum entries to return.
            offset: Number of entries to skip.

        Returns:
            Tuple of (entries list, total count).
        """
        conditions = []
        params: list[Any] = []

        if source:
            conditions.append("source = ?")
            params.append(source)

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        # Get total count
        count_sql = f"SELECT COUNT(*) as count FROM sync_log WHERE {where_clause}"
        count_row = await self._db.fetchone(count_sql, tuple(params))
        total = count_row["count"] if count_row else 0

        # Fetch entries
        entries_sql = f"""
            SELECT * FROM sync_log
            WHERE {where_clause}
            ORDER BY started_at DESC
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])

        rows = await self._db.fetchall(entries_sql, tuple(params))
        entries = [self._row_to_dict(row) for row in rows]

        return entries, total

    async def get_all_statuses(self) -> list[dict[str, Any]]:
        """Get the current sync status for all sources.

        Returns:
            List of status dictionaries for each source.
        """
        # Get latest entry for each source
        sql = """
            SELECT s1.*
            FROM sync_log s1
            INNER JOIN (
                SELECT source, MAX(started_at) as max_started
                FROM sync_log
                GROUP BY source
            ) s2 ON s1.source = s2.source AND s1.started_at = s2.max_started
            ORDER BY s1.source
        """
        rows = await self._db.fetchall(sql)
        return [self._row_to_dict(row) for row in rows]

    async def cleanup_old_entries(self, days: int = 30) -> int:
        """Remove sync log entries older than specified days.

        Args:
            days: Number of days to keep.

        Returns:
            Number of deleted entries.
        """
        # Simple approach: delete entries older than N days
        sql = """
            DELETE FROM sync_log
            WHERE started_at < datetime('now', ?)
        """
        cursor = await self._db.execute(sql, (f"-{days} days",))
        await self._db.commit()

        deleted = cursor.rowcount
        if deleted > 0:
            logger.info(f"Cleaned up {deleted} old sync log entries")
        return deleted
