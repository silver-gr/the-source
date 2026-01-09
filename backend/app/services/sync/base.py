"""Base sync worker class with common functionality."""

import asyncio
import logging
from abc import ABC, abstractmethod
from datetime import datetime
from typing import Any

from app.database import get_database
from app.repositories.item_repo import ItemRepository
from app.repositories.sync_repo import SyncRepository
from app.schemas.item import ItemCreate

logger = logging.getLogger(__name__)


class BaseSyncWorker(ABC):
    """Abstract base class for sync workers."""

    SOURCE_NAME: str = "unknown"
    RATE_LIMIT_DELAY: float = 2.0  # Default delay between requests
    PROGRESS_LOG_INTERVAL: int = 100  # Log progress every N items

    def __init__(self) -> None:
        """Initialize the sync worker."""
        self._db = get_database()
        self._item_repo = ItemRepository(self._db)
        self._sync_repo = SyncRepository(self._db)
        self._log_id: int | None = None
        self._items_synced: int = 0
        self._items_skipped: int = 0
        self._errors: list[str] = []
        self._existing_ids: set[str] = set()

    async def _start_sync_log(self) -> int:
        """Create a new sync log entry.

        Returns:
            Log entry ID.
        """
        entry = await self._sync_repo.create_log_entry(self.SOURCE_NAME)
        self._log_id = entry["id"]
        self._items_synced = 0
        self._items_skipped = 0
        self._errors = []

        # Pre-load existing source_ids for fast duplicate checking (O(1) lookups)
        self._existing_ids = await self._item_repo.get_existing_source_ids(
            self.SOURCE_NAME
        )
        logger.info(
            f"Started sync for {self.SOURCE_NAME} (log_id={self._log_id}, "
            f"existing_items={len(self._existing_ids)})"
        )
        return self._log_id

    async def _complete_sync_log(self) -> None:
        """Mark sync as completed."""
        if self._log_id:
            errors_str = "\n".join(self._errors) if self._errors else None
            await self._sync_repo.complete_sync(
                self._log_id, self._items_synced, errors_str
            )
            logger.info(
                f"Completed sync for {self.SOURCE_NAME}: "
                f"{self._items_synced} new, {self._items_skipped} skipped, "
                f"{len(self._errors)} errors"
            )

    async def _fail_sync_log(self, error: str) -> None:
        """Mark sync as failed.

        Args:
            error: Error message.
        """
        if self._log_id:
            await self._sync_repo.fail_sync(self._log_id, error)
            logger.error(f"Sync failed for {self.SOURCE_NAME}: {error}")

    async def _add_error(self, error: str) -> None:
        """Add a non-fatal error to the log.

        Args:
            error: Error message.
        """
        self._errors.append(error)
        logger.warning(f"Sync error for {self.SOURCE_NAME}: {error}")

    async def _create_or_update_item(self, item_data: dict[str, Any]) -> bool:
        """Create or update an item in the database.

        Uses pre-loaded source_ids set for O(1) duplicate checking.

        Args:
            item_data: Item data dictionary.

        Returns:
            True if item was created/updated successfully.
        """
        source_id = item_data["source_id"]

        try:
            # O(1) duplicate check using pre-loaded set
            if source_id in self._existing_ids:
                self._items_skipped += 1
                return False

            # Create new item
            item = ItemCreate(**item_data)
            await self._item_repo.create(item)
            self._items_synced += 1

            # Add to set to prevent duplicates within this sync batch
            self._existing_ids.add(source_id)

            logger.info(f"Created item: {source_id} - {item_data.get('title', '')[:50]}")
            return True

        except Exception as e:
            await self._add_error(f"Failed to create item {source_id}: {e}")
            return False

    async def _rate_limit(self) -> None:
        """Apply rate limiting delay."""
        await asyncio.sleep(self.RATE_LIMIT_DELAY)

    async def is_running(self) -> bool:
        """Check if a sync is currently running.

        Returns:
            True if sync is running.
        """
        return await self._sync_repo.is_sync_running(self.SOURCE_NAME)

    async def get_last_sync(self) -> datetime | None:
        """Get the timestamp of the last successful sync.

        Returns:
            Last sync timestamp or None.
        """
        entry = await self._sync_repo.get_last_successful_sync(self.SOURCE_NAME)
        if entry and entry.get("completed_at"):
            return datetime.fromisoformat(entry["completed_at"])
        return None

    @abstractmethod
    async def _fetch_items(self, force: bool = False) -> list[dict[str, Any]]:
        """Fetch items from the source.

        Args:
            force: If True, force full sync ignoring last sync time.

        Returns:
            List of item data dictionaries.
        """
        pass

    @abstractmethod
    async def validate_credentials(self) -> tuple[bool, str]:
        """Validate that credentials/access is configured correctly.

        Returns:
            Tuple of (is_valid, message).
        """
        pass

    async def sync(self, force: bool = False) -> dict[str, Any]:
        """Run the sync operation.

        Args:
            force: If True, force full sync.

        Returns:
            Sync result dictionary.
        """
        # Check if already running
        if await self.is_running():
            return {
                "success": False,
                "error": f"Sync already running for {self.SOURCE_NAME}",
                "items_synced": 0,
            }

        # Validate credentials
        is_valid, message = await self.validate_credentials()
        if not is_valid:
            return {
                "success": False,
                "error": f"Credential validation failed: {message}",
                "items_synced": 0,
            }

        # Start sync
        await self._start_sync_log()

        try:
            # Fetch items
            items = await self._fetch_items(force)
            total_items = len(items)
            logger.info(f"Fetched {total_items} items from {self.SOURCE_NAME}")

            # Process items with progress logging
            for idx, item_data in enumerate(items, 1):
                await self._create_or_update_item(item_data)

                # Log progress every N items
                if idx % self.PROGRESS_LOG_INTERVAL == 0:
                    logger.info(
                        f"Progress: {idx}/{total_items} processed "
                        f"({self._items_synced} new, {self._items_skipped} skipped)"
                    )

            # Complete sync
            await self._complete_sync_log()

            return {
                "success": True,
                "items_synced": self._items_synced,
                "errors": self._errors if self._errors else None,
            }

        except Exception as e:
            error_msg = str(e)
            await self._fail_sync_log(error_msg)
            return {
                "success": False,
                "error": error_msg,
                "items_synced": self._items_synced,
            }
