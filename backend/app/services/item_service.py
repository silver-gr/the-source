"""Service layer for Item business logic."""

import logging
import math
from datetime import datetime, timedelta
from typing import Any, Literal

from app.database import Database, get_database
from app.repositories.item_repo import ItemRepository
from app.schemas.item import (
    BulkFetchTitlesRequest,
    BulkFetchTitlesResponse,
    BulkProcessedResponse,
    DomainCount,
    DomainsResponse,
    FetchTitleResponse,
    FilterParams,
    ItemCreate,
    ItemResponse,
    ItemUpdate,
    PaginatedResponse,
    SubredditCount,
    SubredditsResponse,
    TagCount,
    TagsResponse,
)
from app.services.title_fetcher import (
    clean_title,
    fetch_title_from_url,
    is_generic_title,
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

    async def get_subreddits(self) -> SubredditsResponse:
        """Get all unique subreddits with item counts.

        Returns:
            SubredditsResponse with list of subreddits and total count.
        """
        subreddits_data = await self._repo.get_subreddits_with_counts()
        subreddits = [SubredditCount(**sr) for sr in subreddits_data]
        return SubredditsResponse(subreddits=subreddits, total=len(subreddits))

    async def apply_review_action(
        self,
        item_id: str,
        action: Literal["tomorrow", "week", "archive"],
        reddit_details: dict[str, Any] | None = None,
    ) -> ItemResponse | None:
        """Apply a review action to an item, scheduling it for future review.

        Args:
            item_id: Item ID.
            action: Review action to apply:
                - "tomorrow": Schedule for review in 1 day
                - "week": Schedule for review in 7 days
                - "archive": Schedule for review in 30 days and set action to "archive"
            reddit_details: Optional Reddit post details to cache for archived/processed items.

        Returns:
            Updated ItemResponse or None if item not found.
        """
        # Get existing item
        item_data = await self._repo.get_by_id(item_id)
        if not item_data:
            return None

        now = datetime.utcnow()

        # Calculate next_review_at based on action
        if action == "tomorrow":
            next_review = now + timedelta(days=1)
            item_action = None
        elif action == "week":
            next_review = now + timedelta(days=7)
            item_action = None
        else:  # archive
            next_review = now + timedelta(days=30)
            item_action = "archive"

        # Increment review count
        current_count = item_data.get("review_count") or 0

        # Build update
        update = ItemUpdate(
            next_review_at=next_review,
            review_count=current_count + 1,
            last_reviewed_at=now,
        )

        # Only set action for archive
        if item_action:
            update.action = item_action

        # Cache Reddit details if provided (typically when archiving)
        if reddit_details:
            update.reddit_details = reddit_details

        updated_data = await self._repo.update(item_id, update)
        if not updated_data:
            return None

        logger.info(
            f"Applied review action '{action}' to item {item_id}, "
            f"next review at {next_review.isoformat()}"
        )
        return ItemResponse.model_validate(updated_data)

    async def fetch_title_for_item(self, item_id: str) -> FetchTitleResponse:
        """Fetch and update the title for a single item.

        Args:
            item_id: Item ID.

        Returns:
            FetchTitleResponse with operation result.
        """
        # Get the item
        item_data = await self._repo.get_by_id(item_id)
        if not item_data:
            return FetchTitleResponse(
                item_id=item_id,
                old_title="",
                new_title=None,
                updated=False,
                error="Item not found",
            )

        old_title = item_data["title"]
        url = item_data["url"]

        # Check if item has a URL
        if not url:
            return FetchTitleResponse(
                item_id=item_id,
                old_title=old_title,
                new_title=None,
                updated=False,
                error="No URL to fetch from",
            )

        # Fetch the title
        try:
            fetched_title = await fetch_title_from_url(url)
            if not fetched_title:
                return FetchTitleResponse(
                    item_id=item_id,
                    old_title=old_title,
                    new_title=None,
                    updated=False,
                    error="Failed to fetch title from URL",
                )

            # Clean the fetched title
            new_title = clean_title(fetched_title)

            # Update the item if title is different
            if new_title != old_title:
                update_data = ItemUpdate(
                    title=new_title,
                    modified_from_source=True,
                )
                await self._repo.update(item_id, update_data)
                logger.info(f"Updated title for item {item_id}: {old_title} -> {new_title}")
                return FetchTitleResponse(
                    item_id=item_id,
                    old_title=old_title,
                    new_title=new_title,
                    updated=True,
                    error=None,
                )
            else:
                return FetchTitleResponse(
                    item_id=item_id,
                    old_title=old_title,
                    new_title=new_title,
                    updated=False,
                    error="Fetched title is the same as current title",
                )

        except Exception as e:
            logger.error(f"Error fetching title for item {item_id}: {e}")
            return FetchTitleResponse(
                item_id=item_id,
                old_title=old_title,
                new_title=None,
                updated=False,
                error=str(e),
            )

    async def bulk_fetch_titles(
        self, request: BulkFetchTitlesRequest
    ) -> BulkFetchTitlesResponse:
        """Fetch and update titles for multiple items.

        Args:
            request: Bulk fetch request with filters.

        Returns:
            BulkFetchTitlesResponse with operation results.
        """
        # Determine which items to process
        if request.item_ids:
            # Use specific item IDs
            items_to_process = []
            for item_id in request.item_ids:
                item_data = await self._repo.get_by_id(item_id)
                if item_data:
                    items_to_process.append(item_data)
        else:
            # Build filters based on request
            filters = FilterParams(
                page=1,
                page_size=request.limit or 1000,
                source=request.source,
            )
            items_data, _ = await self._repo.list_items(filters)
            items_to_process = items_data

        # Filter for generic titles if requested
        if request.generic_only:
            items_to_process = [
                item for item in items_to_process if is_generic_title(item["title"])
            ]

        # Process each item
        results: list[FetchTitleResponse] = []
        successful_updates = 0
        failed_fetches = 0
        skipped = 0

        for item_data in items_to_process:
            # Skip items without URLs
            if not item_data["url"]:
                skipped += 1
                results.append(
                    FetchTitleResponse(
                        item_id=item_data["id"],
                        old_title=item_data["title"],
                        new_title=None,
                        updated=False,
                        error="No URL",
                    )
                )
                continue

            # Fetch and update title
            result = await self.fetch_title_for_item(item_data["id"])
            results.append(result)

            if result.updated:
                successful_updates += 1
            elif result.error:
                failed_fetches += 1

        return BulkFetchTitlesResponse(
            total_processed=len(results),
            successful_updates=successful_updates,
            failed_fetches=failed_fetches,
            skipped=skipped,
            items=results,
        )


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
