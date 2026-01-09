"""Pydantic schemas for sync operations."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class SyncRequest(BaseModel):
    """Request schema for triggering a sync operation."""

    force: bool = Field(
        default=False,
        description="Force full resync, ignoring last sync timestamp",
    )


class SyncStatusResponse(BaseModel):
    """Response schema for sync status."""

    source: str = Field(..., description="Source platform name")
    status: Literal["idle", "running", "completed", "failed"] = Field(
        ..., description="Current sync status"
    )
    last_sync: datetime | None = Field(None, description="Last successful sync timestamp")
    items_synced: int = Field(default=0, description="Number of items synced in last run")
    error: str | None = Field(None, description="Error message if sync failed")


class SyncLogEntry(BaseModel):
    """Schema for a sync log entry."""

    id: int = Field(..., description="Log entry ID")
    source: str = Field(..., description="Source platform")
    started_at: datetime = Field(..., description="When sync started")
    completed_at: datetime | None = Field(None, description="When sync completed")
    status: Literal["running", "completed", "failed"] = Field(
        ..., description="Sync status"
    )
    items_synced: int = Field(default=0, description="Number of items synced")
    errors: str | None = Field(None, description="Error details if any")


class SyncHistoryResponse(BaseModel):
    """Response schema for sync history."""

    entries: list[SyncLogEntry] = Field(default_factory=list, description="Sync log entries")
    total: int = Field(default=0, description="Total number of entries")


class RedditCredentials(BaseModel):
    """Schema for Reddit API credentials."""

    client_id: str = Field(..., description="Reddit OAuth client ID")
    client_secret: str = Field(..., description="Reddit OAuth client secret")
    username: str = Field(..., description="Reddit username")
    password: str = Field(..., description="Reddit password")


class CredentialStatusResponse(BaseModel):
    """Response schema for credential status check."""

    source: str = Field(..., description="Source platform name")
    configured: bool = Field(..., description="Whether credentials are configured")
    valid: bool | None = Field(
        None, description="Whether credentials are valid (None if not checked)"
    )
    message: str | None = Field(None, description="Additional status message")
