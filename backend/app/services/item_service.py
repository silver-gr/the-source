"""Service layer for Item business logic."""

import logging
import math
from typing import Any

from app.database import Database, get_database
from app.repositories.item_repo import ItemRepository
from app.schemas.item import (
    BulkProcessedResponse,
    DomainCount,
    DomainsResponse,
    FilterParams,
    ItemCreate,
    ItemResponse,
    ItemUpdate,
    PaginatedResponse,
    TagCount,
    TagsResponse,
)

logger = logging.getLogger(__name__)


class ItemService:
    """Service for Item business operations."""

    def __init__(self, database: Database | None = None) -> None:
        """Initialize service with optional database.

        Args:
            database: Database instance. Uses global instance if not provided.
        """
        self._db = database or get_database()
        self._repo = ItemRepository(self._db)

    async def get_item(self, item_id: str) -> ItemResponse | None:
        """Get item by ID.

        Args:
            item_id: Item ID.

        Returns:
            ItemResponse or None if not found.
        """
        item_data = await self._repo.get_by_id(item_id)
        if not item_data:
            return None
        return ItemResponse.model_validate(item_data)

    async def get_item_by_source(
        self, source: str, source_id: str
    ) -> ItemResponse | None:
        """Get item by source platform and source ID.

        Args:
            source: Source platform name.
            source_id: ID from source platform.

        Returns:
            ItemResponse or None if not found.
        """
        item_data = await self._repo.get_by_source_id(source, source_id)
        if not item_data:
            return None
        return ItemResponse.model_validate(item_data)

    async def create_item(self, item: ItemCreate) -> ItemResponse:
        """Create a new item.

        Args:
            item: Item creation data.

        Returns:
            Created ItemResponse.

        Raises:
            ValueError: If item with same source/source_id already exists.
        """
        # Check for duplicate
        existing = await self._repo.get_by_source_id(item.source, item.source_id)
        if existing:
            raise ValueError(
                f"Item with source={item.source} and source_id={item.source_id} already exists"
            )

        item_data = await self._repo.create(item)
        return ItemResponse.model_validate(item_data)

    async def update_item(
        self, item_id: str, updates: ItemUpdate
    ) -> ItemResponse | None:
        """Update an existing item.

        Args:
            item_id: Item ID.
            updates: Fields to update.

        Returns:
            Updated ItemResponse or None if not found.
        """
        item_data = await self._repo.update(item_id, updates)
        if not item_data:
            return None
        return ItemResponse.model_validate(item_data)

    async def delete_item(self, item_id: str) -> bool:
        """Delete an item.

        Args:
            item_id: Item ID.

        Returns:
            True if deleted, False if not found.
        """
        return await self._repo.delete(item_id)

    async def list_items(
        self, filters: FilterParams
    ) -> PaginatedResponse[ItemResponse]:
        """List items with filtering and pagination.

        Args:
            filters: Filter and pagination parameters.

        Returns:
            Paginated response with items.
        """
        items_data, total = await self._repo.list_items(filters)

        items = [ItemResponse.model_validate(item) for item in items_data]
        total_pages = math.ceil(total / filters.page_size) if total > 0 else 0

        return PaginatedResponse(
            items=items,
            total=total,
            page=filters.page,
            page_size=filters.page_size,
            total_pages=total_pages,
            has_next=filters.page < total_pages,
            has_previous=filters.page > 1,
        )

    async def bulk_mark_processed(
        self, item_ids: list[str], processed: bool = True
    ) -> BulkProcessedResponse:
        """Bulk mark items as processed or unprocessed.

        Args:
            item_ids: List of item IDs.
            processed: Processed status to set.

        Returns:
            BulkProcessedResponse with update count.
        """
        updated_ids = await self._repo.bulk_update_processed(item_ids, processed)
        return BulkProcessedResponse(
            updated_count=len(updated_ids),
            item_ids=updated_ids,
        )

    async def get_sources(self) -> list[str]:
        """Get list of unique source platforms.

        Returns:
            List of source names.
        """
        return await self._repo.get_sources()

    async def get_stats(self) -> dict[str, Any]:
        """Get item statistics.

        Returns:
            Dictionary with statistics.
        """
        return await self._repo.get_stats()

    async def upsert_item(self, item: ItemCreate) -> tuple[ItemResponse, bool]:
        """Create or update an item based on source/source_id.

        Args:
            item: Item data.

        Returns:
            Tuple of (ItemResponse, was_created).
        """
        existing = await self._repo.get_by_source_id(item.source, item.source_id)

        if existing:
            # Update existing item
            update_data = ItemUpdate(
                url=item.url,
                title=item.title,
                description=item.description,
                content_text=item.content_text,
                author=item.author,
                thumbnail_url=item.thumbnail_url,
                media_path=item.media_path,
                tags=item.tags,
                source_metadata=item.source_metadata,
                processed=item.processed,
                action=item.action,
                priority=item.priority,
            )
            updated = await self._repo.update(existing["id"], update_data)
            return ItemResponse.model_validate(updated), False
        else:
            # Create new item
            created = await self._repo.create(item)
            return ItemResponse.model_validate(created), True

    async def get_tags(self, with_counts: bool = True) -> TagsResponse:
        """Get all unique tags with optional item counts.

        Args:
            with_counts: If True, include item counts per tag.

        Returns:
            TagsResponse with list of tags and total count.
        """
        tags_data = await self._repo.get_tags_with_counts(with_counts)
        tags = [TagCount(**tag) for tag in tags_data]
        return TagsResponse(tags=tags, total=len(tags))

    async def get_domains(self) -> DomainsResponse:
        """Get all unique domains with item counts.

        Returns:
            DomainsResponse with list of domains and total count.
        """
        domains_data = await self._repo.get_domains_with_counts()
        domains = [DomainCount(**domain) for domain in domains_data]
        return DomainsResponse(domains=domains, total=len(domains))


# Dependency injection helper
_service_instance: ItemService | None = None


def get_item_service() -> ItemService:
    """Get or create ItemService instance.

    Returns:
        ItemService instance.
    """
    global _service_instance
    if _service_instance is None:
        _service_instance = ItemService()
    return _service_instance


def reset_item_service() -> None:
    """Reset the service instance (for testing)."""
    global _service_instance
    _service_instance = None
