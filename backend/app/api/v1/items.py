"""API endpoints for Items."""

import logging
from datetime import datetime
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.schemas.item import (
    BulkFetchTitlesRequest,
    BulkFetchTitlesResponse,
    BulkProcessedRequest,
    BulkProcessedResponse,
    DomainsResponse,
    FetchTitleResponse,
    FilterParams,
    ItemCreate,
    ItemResponse,
    ItemUpdate,
    PaginatedResponse,
    TagsResponse,
)
from app.services.item_service import ItemService, get_item_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/items", tags=["items"])


def get_service() -> ItemService:
    """Dependency to get ItemService instance."""
    return get_item_service()


@router.get("", response_model=PaginatedResponse[ItemResponse])
async def list_items(
    service: Annotated[ItemService, Depends(get_service)],
    page: int = Query(default=1, ge=1, description="Page number"),
    page_size: int = Query(default=50, ge=1, le=200, description="Items per page"),
    source: str | None = Query(default=None, description="Filter by source platform"),
    sources: list[str] | None = Query(default=None, description="Filter by multiple sources"),
    processed: bool | None = Query(default=None, description="Filter by processed status"),
    action: str | None = Query(default=None, description="Filter by action"),
    author: str | None = Query(default=None, description="Filter by author"),
    priority_min: int | None = Query(default=None, ge=1, le=10, description="Min priority"),
    priority_max: int | None = Query(default=None, ge=1, le=10, description="Max priority"),
    domain: str | None = Query(default=None, description="Filter by URL domain"),
    saved_after: datetime | None = Query(default=None, description="Saved after date"),
    saved_before: datetime | None = Query(default=None, description="Saved before date"),
    synced_after: datetime | None = Query(default=None, description="Synced after date"),
    synced_before: datetime | None = Query(default=None, description="Synced before date"),
    search: str | None = Query(default=None, description="Full-text search query"),
    sort_by: str = Query(
        default="synced_at",
        description="Sort field",
        pattern="^(synced_at|saved_at|created_at|priority|title)$",
    ),
    sort_order: str = Query(
        default="desc",
        description="Sort order",
        pattern="^(asc|desc)$",
    ),
) -> PaginatedResponse[ItemResponse]:
    """List items with filtering, pagination, and sorting.

    - **page**: Page number (starting from 1)
    - **page_size**: Number of items per page (max 200)
    - **source**: Filter by single source platform
    - **sources**: Filter by multiple source platforms
    - **processed**: Filter by processed status
    - **action**: Filter by action (archive, delete, favorite, etc.)
    - **author**: Filter by author (partial match)
    - **priority_min/max**: Filter by priority range
    - **domain**: Filter by URL domain (e.g., 'reddit.com', 'github.com')
    - **saved_after/before**: Filter by saved date range
    - **synced_after/before**: Filter by sync date range
    - **search**: Full-text search across title, description, content, author, tags
    - **sort_by**: Field to sort by
    - **sort_order**: Sort direction (asc or desc)
    """
    filters = FilterParams(
        page=page,
        page_size=page_size,
        source=source,
        sources=sources,
        processed=processed,
        action=action,
        author=author,
        priority_min=priority_min,
        priority_max=priority_max,
        domain=domain,
        saved_after=saved_after,
        saved_before=saved_before,
        synced_after=synced_after,
        synced_before=synced_before,
        search=search,
        sort_by=sort_by,  # type: ignore
        sort_order=sort_order,  # type: ignore
    )

    return await service.list_items(filters)


@router.get("/sources", response_model=list[str])
async def get_sources(
    service: Annotated[ItemService, Depends(get_service)],
) -> list[str]:
    """Get list of unique source platforms."""
    return await service.get_sources()


@router.get("/stats", response_model=dict[str, Any])
async def get_stats(
    service: Annotated[ItemService, Depends(get_service)],
) -> dict[str, Any]:
    """Get item statistics.

    Returns:
        - total_items: Total number of items
        - processed_items: Number of processed items
        - unprocessed_items: Number of unprocessed items
        - source_count: Number of unique sources
        - items_by_source: Count of items per source
    """
    return await service.get_stats()


@router.get("/tags", response_model=TagsResponse)
async def get_tags(
    service: Annotated[ItemService, Depends(get_service)],
    with_counts: bool = Query(
        default=True, description="Include item counts per tag"
    ),
) -> TagsResponse:
    """Get all unique tags with item counts.

    Returns a list of all unique tags found across all items, sorted by
    the number of items tagged with each tag (descending).

    - **with_counts**: If true, includes item count per tag (default: true)
    """
    return await service.get_tags(with_counts=with_counts)


@router.get("/domains", response_model=DomainsResponse)
async def get_domains(
    service: Annotated[ItemService, Depends(get_service)],
) -> DomainsResponse:
    """Get all unique domains with item counts.

    Extracts the domain from each item's URL and aggregates counts.
    Domains are normalized by removing the 'www.' prefix.
    Results are sorted by count descending.

    Returns:
        - domains: List of domains with their item counts
        - total: Total number of unique domains
    """
    return await service.get_domains()


@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(
    item_id: str,
    service: Annotated[ItemService, Depends(get_service)],
) -> ItemResponse:
    """Get a single item by ID.

    - **item_id**: Unique item identifier
    """
    item = await service.get_item(item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id '{item_id}' not found",
        )
    return item


@router.post("", response_model=ItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    item: ItemCreate,
    service: Annotated[ItemService, Depends(get_service)],
) -> ItemResponse:
    """Create a new item.

    Required fields:
    - **source**: Source platform (reddit, youtube, twitter, etc.)
    - **source_id**: Original ID from the source platform
    - **title**: Title or headline

    Optional fields:
    - **url**: URL to the original content
    - **description**: Short description or excerpt
    - **content_text**: Full text content
    - **author**: Author/creator name
    - **thumbnail_url**: Thumbnail or preview image URL
    - **tags**: List of tags
    - **source_metadata**: Source-specific metadata as JSON
    - **created_at**: Original creation timestamp
    - **saved_at**: When the user saved it on the source
    - **priority**: Priority level 1-10 (default: 5)
    """
    try:
        return await service.create_item(item)
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=str(e),
        )


@router.patch("/{item_id}", response_model=ItemResponse)
async def update_item(
    item_id: str,
    updates: ItemUpdate,
    service: Annotated[ItemService, Depends(get_service)],
) -> ItemResponse:
    """Update an existing item.

    All fields are optional. Only provided fields will be updated.

    - **item_id**: Unique item identifier
    """
    item = await service.update_item(item_id, updates)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id '{item_id}' not found",
        )
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: str,
    service: Annotated[ItemService, Depends(get_service)],
) -> None:
    """Delete an item.

    - **item_id**: Unique item identifier
    """
    deleted = await service.delete_item(item_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id '{item_id}' not found",
        )


@router.post("/bulk/processed", response_model=BulkProcessedResponse)
async def bulk_mark_processed(
    request: BulkProcessedRequest,
    service: Annotated[ItemService, Depends(get_service)],
) -> BulkProcessedResponse:
    """Bulk mark items as processed or unprocessed.

    - **item_ids**: List of item IDs to update
    - **processed**: Processed status to set (default: true)
    """
    return await service.bulk_mark_processed(request.item_ids, request.processed)


@router.post("/{item_id}/fetch-title", response_model=FetchTitleResponse)
async def fetch_title(
    item_id: str,
    service: Annotated[ItemService, Depends(get_service)],
) -> FetchTitleResponse:
    """Fetch and update the title for a single item from its URL.

    This endpoint will:
    1. Fetch the HTML content from the item's URL
    2. Extract the <title> tag
    3. Update the item's title if different
    4. Set modified_from_source=True to track the change

    - **item_id**: Unique item identifier
    """
    result = await service.fetch_title_for_item(item_id)
    if result.error and result.error == "Item not found":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id '{item_id}' not found",
        )
    return result


@router.post("/bulk/fetch-titles", response_model=BulkFetchTitlesResponse)
async def bulk_fetch_titles(
    request: BulkFetchTitlesRequest,
    service: Annotated[ItemService, Depends(get_service)],
) -> BulkFetchTitlesResponse:
    """Fetch and update titles for multiple items.

    This endpoint processes multiple items in batch to fetch their actual
    page titles from URLs and update the database. Useful for fixing
    generic titles like "Saved item from r/subreddit".

    Parameters:
    - **item_ids**: Specific item IDs to process (optional, uses filters if not provided)
    - **source**: Filter by source platform (e.g., "reddit")
    - **generic_only**: Only process items with generic titles (default: true)
    - **limit**: Maximum number of items to process (max: 1000)

    Returns:
    - **total_processed**: Number of items processed
    - **successful_updates**: Number of items successfully updated
    - **failed_fetches**: Number of items that failed to fetch
    - **skipped**: Number of items skipped (no URL, etc.)
    - **items**: Detailed results for each item
    """
    return await service.bulk_fetch_titles(request)
