"""Pydantic schemas for social presence checking."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SocialMention(BaseModel):
    """A single mention on a social platform."""

    id: int
    item_id: str
    platform: Literal["hackernews", "reddit"]
    external_id: str
    url: str
    title: str | None = None
    score: int = 0
    comment_count: int = 0
    posted_at: datetime | None = None
    top_comment: str | None = None
    subreddit: str | None = None  # Reddit only
    author: str | None = None
    checked_at: datetime


class SocialMentionCreate(BaseModel):
    """Schema for creating a social mention."""

    item_id: str
    platform: Literal["hackernews", "reddit"]
    external_id: str
    url: str
    title: str | None = None
    score: int = 0
    comment_count: int = 0
    posted_at: datetime | None = None
    top_comment: str | None = None
    subreddit: str | None = None
    author: str | None = None
    raw_data: str | None = None


class PlatformMentions(BaseModel):
    """Mentions grouped by platform."""

    hackernews: list[SocialMention] = Field(default_factory=list)
    reddit: list[SocialMention] = Field(default_factory=list)


class SocialCheckResponse(BaseModel):
    """Response from checking social presence."""

    item_id: str
    hackernews: list[SocialMention] = Field(default_factory=list)
    reddit: list[SocialMention] = Field(default_factory=list)
    checked_at: datetime
    hn_error: str | None = None
    reddit_error: str | None = None


class BatchCheckRequest(BaseModel):
    """Request for batch social check."""

    item_ids: list[str] = Field(..., min_length=1, max_length=50)


class BatchCheckResponse(BaseModel):
    """Response from batch social check."""

    results: dict[str, SocialCheckResponse]
    failed: list[str] = Field(default_factory=list)
    checked_at: datetime
