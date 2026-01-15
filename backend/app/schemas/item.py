"""Pydantic schemas for Item model."""

from datetime import datetime
from typing import Any, Generic, Literal, TypeVar

from pydantic import BaseModel, ConfigDict, Field


class RedditComment(BaseModel):
    """Schema for a Reddit comment with nested replies."""

    author: str | None = Field(None, description="Comment author username")
    body: str = Field(..., description="Comment body text")
    score: int = Field(..., description="Comment score (upvotes - downvotes)")
    created_utc: datetime | None = Field(None, description="When the comment was created")
    depth: int = Field(default=0, description="Nesting depth (0 = top-level)")
    replies: list["RedditComment"] = Field(
        default_factory=list, description="Nested reply comments"
    )


# Rebuild model to resolve forward reference
RedditComment.model_rebuild()


class RedditPostDetails(BaseModel):
    """Schema for full Reddit post details with top comments."""

    id: str = Field(..., description="Reddit submission ID")
    title: str = Field(..., description="Post title")
    selftext: str | None = Field(None, description="Post body text (for self posts)")
    url: str | None = Field(None, description="Post URL (for link posts)")
    author: str | None = Field(None, description="Post author username")
    subreddit: str = Field(..., description="Subreddit name (without r/ prefix)")
    score: int = Field(..., description="Post score (upvotes - downvotes)")
    num_comments: int = Field(..., description="Total number of comments")
    created_utc: datetime | None = Field(None, description="When the post was created")
    permalink: str | None = Field(None, description="Reddit permalink path")
    is_self: bool = Field(..., description="True if text post, False if link post")
    thumbnail_url: str | None = Field(None, description="Thumbnail image URL")
    comments: list[RedditComment] = Field(
        default_factory=list, description="Top comments sorted by score"
    )


class ItemBase(BaseModel):
    """Base schema for Item with common fields."""

    source: str = Field(..., description="Source platform (reddit, youtube, twitter, etc.)")
    source_id: str = Field(..., description="Original ID from the source platform")
    url: str | None = Field(None, description="URL to the original content")
    title: str = Field(..., min_length=1, max_length=1000, description="Title or headline")
    description: str | None = Field(None, max_length=5000, description="Short description")
    content_text: str | None = Field(None, description="Full text content")
    author: str | None = Field(None, max_length=500, description="Author/creator name")
    thumbnail_url: str | None = Field(None, description="Thumbnail or preview image URL")
    media_path: str | None = Field(None, description="Local path to downloaded media")
    tags: list[str] = Field(default_factory=list, description="List of tags")
    source_metadata: dict[str, Any] | None = Field(
        None, description="Source-specific metadata as JSON"
    )
    created_at: datetime | None = Field(
        None, description="Original creation timestamp from source"
    )
    saved_at: datetime | None = Field(
        None, description="When the user saved it on the source platform"
    )
    priority: int = Field(default=5, ge=1, le=10, description="Priority level 1-10")
    modified_from_source: bool = Field(
        default=False, description="Whether title/content was auto-updated from URL"
    )


class ItemCreate(ItemBase):
    """Schema for creating a new Item."""

    id: str | None = Field(None, description="Optional custom ID (generated if not provided)")
    processed: bool = Field(default=False, description="Whether content has been processed")
    action: str | None = Field(None, description="User action: archive, delete, favorite")


class ItemUpdate(BaseModel):
    """Schema for updating an existing Item. All fields are optional."""

    model_config = ConfigDict(extra="forbid")

    url: str | None = None
    title: str | None = Field(None, min_length=1, max_length=1000)
    description: str | None = Field(None, max_length=5000)
    content_text: str | None = None
    author: str | None = Field(None, max_length=500)
    thumbnail_url: str | None = None
    media_path: str | None = None
    tags: list[str] | None = None
    source_metadata: dict[str, Any] | None = None
    processed: bool | None = None
    action: str | None = None
    priority: int | None = Field(None, ge=1, le=10)
    modified_from_source: bool | None = None
    # Spaced repetition fields
    next_review_at: datetime | None = None
    review_count: int | None = None
    last_reviewed_at: datetime | None = None
    # Cached Reddit details (JSON)
    reddit_details: dict[str, Any] | None = None


class ItemResponse(BaseModel):
    """Schema for Item response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    source: str
    source_id: str
    url: str | None
    title: str
    description: str | None
    content_text: str | None
    author: str | None
    thumbnail_url: str | None
    media_path: str | None
    tags: list[str]
    source_metadata: dict[str, Any] | None
    created_at: datetime | None
    saved_at: datetime | None
    synced_at: datetime
    processed: bool
    action: str | None
    priority: int
    modified_from_source: bool
    link_status: str | None = Field(None, description="Link health status: ok, broken, unchecked")
    last_link_check: datetime | None = Field(None, description="When the link was last checked")
    nsfw_status: str | None = Field(None, description="NSFW status: unknown, safe, nsfw, explicit")
    last_nsfw_check: datetime | None = Field(None, description="When NSFW status was last checked")
    # Spaced repetition fields
    next_review_at: datetime | None = Field(None, description="When this item is due for review")
    review_count: int = Field(default=0, description="Number of times this item has been reviewed")
    last_reviewed_at: datetime | None = Field(None, description="When this item was last reviewed")
    # Cached Reddit details
    reddit_details: dict[str, Any] | None = Field(None, description="Cached Reddit post details (title, selftext, comments)")


T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response schema."""

    items: list[T]
    total: int = Field(..., description="Total number of items matching the query")
    page: int = Field(..., ge=1, description="Current page number")
    page_size: int = Field(..., ge=1, description="Number of items per page")
    total_pages: int = Field(..., ge=0, description="Total number of pages")
    has_next: bool = Field(..., description="Whether there is a next page")
    has_previous: bool = Field(..., description="Whether there is a previous page")


class FilterParams(BaseModel):
    """Query parameters for filtering items."""

    model_config = ConfigDict(extra="forbid")

    # Pagination
    page: int = Field(default=1, ge=1, description="Page number")
    page_size: int = Field(default=50, ge=1, le=200, description="Items per page")

    # Filtering
    source: str | None = Field(None, description="Filter by source platform")
    sources: list[str] | None = Field(None, description="Filter by multiple sources")
    processed: bool | None = Field(None, description="Filter by processed status")
    action: str | None = Field(None, description="Filter by action")
    author: str | None = Field(None, description="Filter by author")
    priority_min: int | None = Field(None, ge=1, le=10, description="Minimum priority")
    priority_max: int | None = Field(None, ge=1, le=10, description="Maximum priority")
    domain: str | None = Field(None, description="Filter by URL domain (e.g., 'reddit.com')")
    link_status: Literal["ok", "broken", "unchecked"] | None = Field(
        None, description="Filter by link health status"
    )
    exclude_broken: bool | None = Field(
        None, description="Exclude broken links from results"
    )
    nsfw_status: Literal["unknown", "safe", "nsfw", "explicit"] | None = Field(
        None, description="Filter by NSFW status"
    )
    exclude_nsfw: bool | None = Field(
        None, description="Exclude NSFW/explicit content from results"
    )
    # Spaced repetition filters
    due_for_review: bool | None = Field(
        None, description="Filter items that are due for review (next_review_at <= now)"
    )
    subreddit: str | None = Field(
        None, description="Filter by subreddit (from source_metadata)"
    )
    subreddits: list[str] | None = Field(
        None, description="Filter by multiple subreddits"
    )

    # Date filtering
    saved_after: datetime | None = Field(None, description="Filter items saved after this date")
    saved_before: datetime | None = Field(None, description="Filter items saved before this date")
    synced_after: datetime | None = Field(None, description="Filter items synced after this date")
    synced_before: datetime | None = Field(None, description="Filter items synced before this date")

    # Search
    search: str | None = Field(None, description="Full-text search query")

    # Sorting
    sort_by: Literal[
        "synced_at", "saved_at", "created_at", "priority", "title"
    ] = Field(default="synced_at", description="Field to sort by")
    sort_order: Literal["asc", "desc"] = Field(default="desc", description="Sort order")


class BulkProcessedRequest(BaseModel):
    """Request schema for bulk marking items as processed."""

    item_ids: list[str] = Field(..., min_length=1, description="List of item IDs to mark")
    processed: bool = Field(default=True, description="Processed status to set")


class BulkProcessedResponse(BaseModel):
    """Response schema for bulk processed operation."""

    updated_count: int = Field(..., description="Number of items updated")
    item_ids: list[str] = Field(..., description="List of updated item IDs")


class TagCount(BaseModel):
    """Schema for a tag with its item count."""

    tag: str = Field(..., description="Tag name")
    count: int = Field(..., ge=0, description="Number of items with this tag")


class TagsResponse(BaseModel):
    """Response schema for tags with counts."""

    tags: list[TagCount] = Field(..., description="List of tags with counts")
    total: int = Field(..., ge=0, description="Total number of unique tags")


class DomainCount(BaseModel):
    """Schema for a domain with its item count."""

    domain: str = Field(..., description="Domain name (e.g., 'github.com')")
    count: int = Field(..., ge=0, description="Number of items from this domain")


class DomainsResponse(BaseModel):
    """Response schema for domains with counts."""

    domains: list[DomainCount] = Field(..., description="List of domains with counts")
    total: int = Field(..., ge=0, description="Total number of unique domains")


class SubredditCount(BaseModel):
    """Schema for a subreddit with its item count."""

    subreddit: str = Field(..., description="Subreddit name (without r/ prefix)")
    count: int = Field(..., ge=0, description="Number of items from this subreddit")


class SubredditsResponse(BaseModel):
    """Response schema for subreddits with counts."""

    subreddits: list[SubredditCount] = Field(..., description="List of subreddits with counts")
    total: int = Field(..., ge=0, description="Total number of unique subreddits")


class ReviewActionRequest(BaseModel):
    """Request schema for applying a review action to an item."""

    action: Literal["tomorrow", "week", "archive"] = Field(
        ..., description="Review action: tomorrow (1 day), week (7 days), archive (30 days)"
    )
    reddit_details: dict[str, Any] | None = Field(
        None, description="Reddit post details to cache (title, selftext, comments, etc.)"
    )


class FetchTitleResponse(BaseModel):
    """Response schema for fetch title operation."""

    item_id: str = Field(..., description="Item ID")
    old_title: str = Field(..., description="Previous title")
    new_title: str | None = Field(..., description="New fetched title, None if fetch failed")
    updated: bool = Field(..., description="Whether the title was actually updated")
    error: str | None = Field(None, description="Error message if fetch failed")


class BulkFetchTitlesRequest(BaseModel):
    """Request schema for bulk fetch titles operation."""

    model_config = ConfigDict(extra="forbid")

    item_ids: list[str] | None = Field(
        None, description="Specific item IDs to process. If not provided, uses filters."
    )
    source: str | None = Field(None, description="Filter by source platform")
    generic_only: bool = Field(
        default=True, description="Only fetch for items with generic titles"
    )
    limit: int | None = Field(None, ge=1, le=1000, description="Maximum number of items to process")


class BulkFetchTitlesResponse(BaseModel):
    """Response schema for bulk fetch titles operation."""

    total_processed: int = Field(..., description="Number of items processed")
    successful_updates: int = Field(..., description="Number of items successfully updated")
    failed_fetches: int = Field(..., description="Number of items that failed to fetch")
    skipped: int = Field(..., description="Number of items skipped (no URL, etc.)")
    items: list[FetchTitleResponse] = Field(..., description="Details for each item")
