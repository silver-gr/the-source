"""Repository for Item data access operations."""

import json
import logging
import uuid
from datetime import datetime
from typing import Any

import aiosqlite

from app.database import Database
from app.schemas.item import FilterParams, ItemCreate, ItemUpdate

logger = logging.getLogger(__name__)


class ItemRepository:
    """Repository for Item CRUD operations and queries."""

    def __init__(self, database: Database) -> None:
        """Initialize repository with database connection.

        Args:
            database: Database instance.
        """
        self._db = database

    def _row_to_dict(self, row: aiosqlite.Row) -> dict[str, Any]:
        """Convert database row to dictionary with proper type handling.

        Args:
            row: Database row.

        Returns:
            Dictionary representation of the row.
        """
        result = dict(row)

        # Parse JSON fields
        if result.get("tags"):
            try:
                result["tags"] = json.loads(result["tags"])
            except json.JSONDecodeError:
                result["tags"] = []
        else:
            result["tags"] = []

        if result.get("source_metadata"):
            try:
                result["source_metadata"] = json.loads(result["source_metadata"])
            except json.JSONDecodeError:
                result["source_metadata"] = None

        # Convert boolean
        result["processed"] = bool(result.get("processed", False))

        return result

    async def get_by_id(self, item_id: str) -> dict[str, Any] | None:
        """Get item by ID.

        Args:
            item_id: Item ID.

        Returns:
            Item dictionary or None if not found.
        """
        row = await self._db.fetchone(
            "SELECT * FROM items WHERE id = ?", (item_id,)
        )
        return self._row_to_dict(row) if row else None

    async def get_by_source_id(self, source: str, source_id: str) -> dict[str, Any] | None:
        """Get item by source and source_id.

        Args:
            source: Source platform.
            source_id: ID from source platform.

        Returns:
            Item dictionary or None if not found.
        """
        row = await self._db.fetchone(
            "SELECT * FROM items WHERE source = ? AND source_id = ?",
            (source, source_id),
        )
        return self._row_to_dict(row) if row else None

    async def create(self, item: ItemCreate) -> dict[str, Any]:
        """Create a new item.

        Args:
            item: Item creation schema.

        Returns:
            Created item dictionary.
        """
        item_id = item.id or str(uuid.uuid4())
        synced_at = datetime.utcnow().isoformat()

        # Serialize JSON fields
        tags_json = json.dumps(item.tags)
        metadata_json = json.dumps(item.source_metadata) if item.source_metadata else None

        sql = """
            INSERT INTO items (
                id, source, source_id, url, title, description, content_text,
                author, thumbnail_url, media_path, tags, source_metadata,
                created_at, saved_at, synced_at, processed, action, priority
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """

        await self._db.execute(
            sql,
            (
                item_id,
                item.source,
                item.source_id,
                item.url,
                item.title,
                item.description,
                item.content_text,
                item.author,
                item.thumbnail_url,
                item.media_path,
                tags_json,
                metadata_json,
                item.created_at.isoformat() if item.created_at else None,
                item.saved_at.isoformat() if item.saved_at else None,
                synced_at,
                item.processed,
                item.action,
                item.priority,
            ),
        )
        await self._db.commit()

        logger.info(f"Created item: {item_id}")
        return await self.get_by_id(item_id)  # type: ignore

    async def update(self, item_id: str, updates: ItemUpdate) -> dict[str, Any] | None:
        """Update an existing item.

        Args:
            item_id: Item ID.
            updates: Item update schema.

        Returns:
            Updated item dictionary or None if not found.
        """
        # Get existing item
        existing = await self.get_by_id(item_id)
        if not existing:
            return None

        # Build update query dynamically based on provided fields
        update_data = updates.model_dump(exclude_unset=True)
        if not update_data:
            return existing

        # Handle JSON fields
        if "tags" in update_data:
            update_data["tags"] = json.dumps(update_data["tags"])
        if "source_metadata" in update_data:
            update_data["source_metadata"] = (
                json.dumps(update_data["source_metadata"])
                if update_data["source_metadata"]
                else None
            )

        # Build SET clause
        set_parts = [f"{key} = ?" for key in update_data.keys()]
        values = list(update_data.values())
        values.append(item_id)

        sql = f"UPDATE items SET {', '.join(set_parts)} WHERE id = ?"
        await self._db.execute(sql, tuple(values))
        await self._db.commit()

        logger.info(f"Updated item: {item_id}")
        return await self.get_by_id(item_id)

    async def delete(self, item_id: str) -> bool:
        """Delete an item.

        Args:
            item_id: Item ID.

        Returns:
            True if deleted, False if not found.
        """
        # Check if exists
        existing = await self.get_by_id(item_id)
        if not existing:
            return False

        await self._db.execute("DELETE FROM items WHERE id = ?", (item_id,))
        await self._db.commit()

        logger.info(f"Deleted item: {item_id}")
        return True

    async def list_items(
        self, filters: FilterParams
    ) -> tuple[list[dict[str, Any]], int]:
        """List items with filtering, pagination, and sorting.

        Args:
            filters: Filter parameters.

        Returns:
            Tuple of (items list, total count).
        """
        # Build WHERE clause
        conditions: list[str] = []
        params: list[Any] = []

        if filters.source:
            conditions.append("source = ?")
            params.append(filters.source)

        if filters.sources:
            placeholders = ", ".join("?" * len(filters.sources))
            conditions.append(f"source IN ({placeholders})")
            params.extend(filters.sources)

        if filters.processed is not None:
            conditions.append("processed = ?")
            params.append(filters.processed)

        if filters.action:
            conditions.append("action = ?")
            params.append(filters.action)

        if filters.author:
            conditions.append("author LIKE ?")
            params.append(f"%{filters.author}%")

        if filters.priority_min is not None:
            conditions.append("priority >= ?")
            params.append(filters.priority_min)

        if filters.priority_max is not None:
            conditions.append("priority <= ?")
            params.append(filters.priority_max)

        if filters.saved_after:
            conditions.append("saved_at >= ?")
            params.append(filters.saved_after.isoformat())

        if filters.saved_before:
            conditions.append("saved_at <= ?")
            params.append(filters.saved_before.isoformat())

        if filters.synced_after:
            conditions.append("synced_at >= ?")
            params.append(filters.synced_after.isoformat())

        if filters.synced_before:
            conditions.append("synced_at <= ?")
            params.append(filters.synced_before.isoformat())

        # Full-text search
        if filters.search:
            conditions.append(
                "id IN (SELECT rowid FROM items_fts WHERE items_fts MATCH ?)"
            )
            # Escape special FTS5 characters and format query
            search_query = filters.search.replace('"', '""')
            params.append(f'"{search_query}"')

        where_clause = " AND ".join(conditions) if conditions else "1=1"

        # Get total count
        count_sql = f"SELECT COUNT(*) as count FROM items WHERE {where_clause}"
        count_row = await self._db.fetchone(count_sql, tuple(params))
        total = count_row["count"] if count_row else 0

        # Build ORDER BY clause
        order_direction = "DESC" if filters.sort_order == "desc" else "ASC"
        order_clause = f"{filters.sort_by} {order_direction}"

        # Add secondary sort for consistency
        if filters.sort_by != "id":
            order_clause += ", id ASC"

        # Pagination
        offset = (filters.page - 1) * filters.page_size
        limit = filters.page_size

        # Fetch items
        items_sql = f"""
            SELECT * FROM items
            WHERE {where_clause}
            ORDER BY {order_clause}
            LIMIT ? OFFSET ?
        """
        params.extend([limit, offset])

        rows = await self._db.fetchall(items_sql, tuple(params))
        items = [self._row_to_dict(row) for row in rows]

        return items, total

    async def bulk_update_processed(
        self, item_ids: list[str], processed: bool
    ) -> list[str]:
        """Bulk update processed status for multiple items.

        Args:
            item_ids: List of item IDs.
            processed: Processed status to set.

        Returns:
            List of updated item IDs.
        """
        if not item_ids:
            return []

        placeholders = ", ".join("?" * len(item_ids))
        sql = f"UPDATE items SET processed = ? WHERE id IN ({placeholders})"

        params = [processed] + item_ids
        await self._db.execute(sql, tuple(params))
        await self._db.commit()

        logger.info(f"Bulk updated {len(item_ids)} items processed={processed}")
        return item_ids

    async def get_sources(self) -> list[str]:
        """Get list of unique sources.

        Returns:
            List of source names.
        """
        rows = await self._db.fetchall(
            "SELECT DISTINCT source FROM items ORDER BY source"
        )
        return [row["source"] for row in rows]

    async def get_existing_source_ids(self, source: str) -> set[str]:
        """Get all existing source_ids for a given source.

        This is used for batch duplicate checking during sync operations.

        Args:
            source: Source platform name.

        Returns:
            Set of existing source_ids.
        """
        rows = await self._db.fetchall(
            "SELECT source_id FROM items WHERE source = ?", (source,)
        )
        return {row["source_id"] for row in rows}

    async def get_stats(self) -> dict[str, Any]:
        """Get statistics about items.

        Returns:
            Dictionary with statistics.
        """
        stats_sql = """
            SELECT
                COUNT(*) as total_items,
                COUNT(CASE WHEN processed = 1 THEN 1 END) as processed_items,
                COUNT(CASE WHEN processed = 0 THEN 1 END) as unprocessed_items,
                COUNT(DISTINCT source) as source_count
            FROM items
        """
        row = await self._db.fetchone(stats_sql)

        # Get items per source
        source_counts_sql = """
            SELECT source, COUNT(*) as count
            FROM items
            GROUP BY source
            ORDER BY count DESC
        """
        source_rows = await self._db.fetchall(source_counts_sql)

        return {
            "total_items": row["total_items"] if row else 0,
            "processed_items": row["processed_items"] if row else 0,
            "unprocessed_items": row["unprocessed_items"] if row else 0,
            "source_count": row["source_count"] if row else 0,
            "items_by_source": {r["source"]: r["count"] for r in source_rows},
        }
