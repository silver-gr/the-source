"""Repository for social mentions data access."""

import logging
from datetime import datetime
from typing import Any

from app.database import Database
from app.schemas.social import SocialMentionCreate

logger = logging.getLogger(__name__)


class SocialMentionsRepository:
    """Repository for social_mentions CRUD operations."""

    def __init__(self, database: Database) -> None:
        """Initialize repository with database connection."""
        self._db = database

    def _row_to_dict(self, row) -> dict[str, Any]:
        """Convert database row to dictionary."""
        result = dict(row)
        # Parse datetime strings
        if result.get("posted_at"):
            result["posted_at"] = datetime.fromisoformat(result["posted_at"])
        if result.get("checked_at"):
            result["checked_at"] = datetime.fromisoformat(result["checked_at"])
        return result

    async def get_by_item_id(self, item_id: str) -> list[dict[str, Any]]:
        """Get all social mentions for an item.

        Args:
            item_id: The item ID to look up.

        Returns:
            List of social mention dictionaries.
        """
        rows = await self._db.fetchall(
            """
            SELECT * FROM social_mentions
            WHERE item_id = ?
            ORDER BY platform, score DESC
            """,
            (item_id,)
        )
        return [self._row_to_dict(row) for row in rows]

    async def get_by_item_and_platform(
        self, item_id: str, platform: str
    ) -> list[dict[str, Any]]:
        """Get social mentions for an item on a specific platform."""
        rows = await self._db.fetchall(
            """
            SELECT * FROM social_mentions
            WHERE item_id = ? AND platform = ?
            ORDER BY score DESC
            """,
            (item_id, platform)
        )
        return [self._row_to_dict(row) for row in rows]

    async def upsert(self, mention: SocialMentionCreate) -> dict[str, Any]:
        """Insert or update a social mention.

        Uses UPSERT to handle duplicates based on (item_id, platform, external_id).
        """
        sql = """
            INSERT INTO social_mentions (
                item_id, platform, external_id, url, title, score,
                comment_count, posted_at, top_comment, subreddit, author,
                checked_at, raw_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
            ON CONFLICT(item_id, platform, external_id) DO UPDATE SET
                url = excluded.url,
                title = excluded.title,
                score = excluded.score,
                comment_count = excluded.comment_count,
                posted_at = excluded.posted_at,
                top_comment = excluded.top_comment,
                subreddit = excluded.subreddit,
                author = excluded.author,
                checked_at = datetime('now'),
                raw_data = excluded.raw_data
        """
        await self._db.execute(
            sql,
            (
                mention.item_id,
                mention.platform,
                mention.external_id,
                mention.url,
                mention.title,
                mention.score,
                mention.comment_count,
                mention.posted_at.isoformat() if mention.posted_at else None,
                mention.top_comment,
                mention.subreddit,
                mention.author,
                mention.raw_data,
            ),
        )
        await self._db.commit()

        logger.info(
            f"Upserted social mention: {mention.platform}/{mention.external_id} "
            f"for item {mention.item_id}"
        )

        # Return the upserted row
        row = await self._db.fetchone(
            """
            SELECT * FROM social_mentions
            WHERE item_id = ? AND platform = ? AND external_id = ?
            """,
            (mention.item_id, mention.platform, mention.external_id)
        )
        return self._row_to_dict(row) if row else {}

    async def delete_by_item_id(self, item_id: str) -> int:
        """Delete all social mentions for an item.

        Returns:
            Number of rows deleted.
        """
        result = await self._db.execute(
            "DELETE FROM social_mentions WHERE item_id = ?",
            (item_id,)
        )
        await self._db.commit()
        return result.rowcount if result else 0

    async def get_last_check_time(self, item_id: str) -> datetime | None:
        """Get the most recent check time for an item."""
        row = await self._db.fetchone(
            """
            SELECT MAX(checked_at) as last_check
            FROM social_mentions
            WHERE item_id = ?
            """,
            (item_id,)
        )
        if row and row["last_check"]:
            return datetime.fromisoformat(row["last_check"])
        return None

    async def get_items_with_mentions(self) -> list[str]:
        """Get list of item IDs that have social mentions."""
        rows = await self._db.fetchall(
            "SELECT DISTINCT item_id FROM social_mentions"
        )
        return [row["item_id"] for row in rows]

    async def get_mention_counts_for_items(
        self, item_ids: list[str]
    ) -> dict[str, dict[str, Any]]:
        """Get mention counts per platform for multiple items.

        Returns:
            Dict mapping item_id to {platform: count}.
        """
        if not item_ids:
            return {}

        placeholders = ", ".join("?" * len(item_ids))
        rows = await self._db.fetchall(
            f"""
            SELECT item_id, platform, COUNT(*) as count, MAX(score) as top_score
            FROM social_mentions
            WHERE item_id IN ({placeholders})
            GROUP BY item_id, platform
            """,
            tuple(item_ids)
        )

        result: dict[str, dict[str, Any]] = {}
        for row in rows:
            item_id = row["item_id"]
            if item_id not in result:
                result[item_id] = {}
            result[item_id][row["platform"]] = {
                "count": row["count"],
                "top_score": row["top_score"]
            }
        return result
