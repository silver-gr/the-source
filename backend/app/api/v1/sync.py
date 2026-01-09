"""API endpoints for sync operations."""

import logging
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.core.credentials import get_credential_manager
from app.database import get_database
from app.repositories.sync_repo import SyncRepository
from app.schemas.sync import (
    CredentialStatusResponse,
    RedditCredentials,
    SyncHistoryResponse,
    SyncLogEntry,
    SyncRequest,
    SyncStatusResponse,
)
from app.services.sync.raindrop import RaindropSyncWorker
from app.services.sync.reddit import RedditSyncWorker
from app.services.sync.reddit_gdpr import import_reddit_gdpr_stub_only
from app.services.sync.youtube import YouTubeSyncWorker

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sync", tags=["sync"])


# Background task functions
async def _run_youtube_sync(force: bool = False) -> None:
    """Run YouTube sync as background task."""
    worker = YouTubeSyncWorker()
    result = await worker.sync(force)
    logger.info(f"YouTube sync completed: {result}")


async def _run_reddit_sync(force: bool = False) -> None:
    """Run Reddit sync as background task."""
    worker = RedditSyncWorker()
    result = await worker.sync(force)
    logger.info(f"Reddit sync completed: {result}")


async def _run_raindrop_sync(force: bool = False) -> None:
    """Run Raindrop sync as background task."""
    worker = RaindropSyncWorker()
    result = await worker.sync(force)
    logger.info(f"Raindrop sync completed: {result}")


# Sync trigger endpoints

class SyncTriggerResponse(BaseModel):
    """Response for sync trigger endpoints."""

    message: str = Field(..., description="Status message")
    sync_started: bool = Field(..., description="Whether sync was started")


@router.post("/youtube", response_model=SyncTriggerResponse)
async def trigger_youtube_sync(
    request: SyncRequest,
    background_tasks: BackgroundTasks,
) -> SyncTriggerResponse:
    """Trigger YouTube Watch Later sync.

    Starts a background task to sync videos from YouTube Watch Later playlist.
    Uses yt-dlp with browser cookies for authentication.
    """
    worker = YouTubeSyncWorker()

    # Check if already running
    if await worker.is_running():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="YouTube sync is already running",
        )

    # Validate credentials
    is_valid, message = await worker.validate_credentials()
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"YouTube authentication failed: {message}",
        )

    # Start background sync
    background_tasks.add_task(_run_youtube_sync, request.force)

    return SyncTriggerResponse(
        message="YouTube sync started",
        sync_started=True,
    )


@router.post("/reddit", response_model=SyncTriggerResponse)
async def trigger_reddit_sync(
    request: SyncRequest,
    background_tasks: BackgroundTasks,
) -> SyncTriggerResponse:
    """Trigger Reddit saved items sync.

    Starts a background task to sync saved submissions and comments from Reddit.
    Requires Reddit API credentials to be configured.
    """
    worker = RedditSyncWorker()

    # Check if already running
    if await worker.is_running():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Reddit sync is already running",
        )

    # Validate credentials
    is_valid, message = await worker.validate_credentials()
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Reddit authentication failed: {message}",
        )

    # Start background sync
    background_tasks.add_task(_run_reddit_sync, request.force)

    return SyncTriggerResponse(
        message="Reddit sync started",
        sync_started=True,
    )


@router.post("/raindrop", response_model=SyncTriggerResponse)
async def trigger_raindrop_sync(
    request: SyncRequest,
    background_tasks: BackgroundTasks,
) -> SyncTriggerResponse:
    """Trigger Raindrop.io bookmarks sync.

    Starts a background task to sync bookmarks from Raindrop.io.
    Requires a Raindrop API token to be configured.
    """
    worker = RaindropSyncWorker()

    # Check if already running
    if await worker.is_running():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Raindrop sync is already running",
        )

    # Validate credentials
    is_valid, message = await worker.validate_credentials()
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Raindrop authentication failed: {message}",
        )

    # Start background sync
    background_tasks.add_task(_run_raindrop_sync, request.force)

    return SyncTriggerResponse(
        message="Raindrop sync started",
        sync_started=True,
    )


# Status endpoints

@router.get("/status", response_model=list[SyncStatusResponse])
async def get_all_sync_statuses() -> list[SyncStatusResponse]:
    """Get sync status for all sources.

    Returns the current status of each sync source including whether
    it's running, last sync time, and any errors.
    """
    db = get_database()
    sync_repo = SyncRepository(db)

    statuses = await sync_repo.get_all_statuses()

    # Map to response schema
    result = []
    for entry in statuses:
        result.append(
            SyncStatusResponse(
                source=entry["source"],
                status=entry["status"],
                last_sync=entry.get("completed_at"),
                items_synced=entry.get("items_synced", 0),
                error=entry.get("errors"),
            )
        )

    # Add sources that haven't been synced yet
    known_sources = {"youtube", "reddit", "raindrop"}
    synced_sources = {s.source for s in result}
    for source in known_sources - synced_sources:
        result.append(
            SyncStatusResponse(
                source=source,
                status="idle",
                last_sync=None,
                items_synced=0,
                error=None,
            )
        )

    return result


@router.get("/status/{source}", response_model=SyncStatusResponse)
async def get_sync_status(source: str) -> SyncStatusResponse:
    """Get sync status for a specific source.

    Args:
        source: Source platform name (youtube, reddit).
    """
    valid_sources = {"youtube", "reddit", "raindrop"}
    if source not in valid_sources:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Unknown source: {source}. Valid sources: {', '.join(valid_sources)}",
        )

    db = get_database()
    sync_repo = SyncRepository(db)

    entry = await sync_repo.get_latest_by_source(source)

    if not entry:
        return SyncStatusResponse(
            source=source,
            status="idle",
            last_sync=None,
            items_synced=0,
            error=None,
        )

    return SyncStatusResponse(
        source=entry["source"],
        status=entry["status"],
        last_sync=entry.get("completed_at"),
        items_synced=entry.get("items_synced", 0),
        error=entry.get("errors"),
    )


# History endpoints

@router.get("/history", response_model=SyncHistoryResponse)
async def get_sync_history(
    source: str | None = Query(None, description="Filter by source"),
    limit: int = Query(50, ge=1, le=200, description="Maximum entries to return"),
    offset: int = Query(0, ge=0, description="Number of entries to skip"),
) -> SyncHistoryResponse:
    """Get sync operation history.

    Returns a list of past sync operations with their results.
    """
    db = get_database()
    sync_repo = SyncRepository(db)

    entries, total = await sync_repo.get_history(source, limit, offset)

    return SyncHistoryResponse(
        entries=[
            SyncLogEntry(
                id=e["id"],
                source=e["source"],
                started_at=e["started_at"],
                completed_at=e.get("completed_at"),
                status=e["status"],
                items_synced=e.get("items_synced", 0),
                errors=e.get("errors"),
            )
            for e in entries
        ],
        total=total,
    )


# Credential management endpoints

@router.get("/credentials/status", response_model=list[CredentialStatusResponse])
async def get_credential_statuses() -> list[CredentialStatusResponse]:
    """Get credential status for all sources.

    Returns whether credentials are configured and optionally validates them.
    """
    cred_manager = get_credential_manager()
    results = []

    # Reddit
    reddit_creds = cred_manager.get_reddit_credentials()
    results.append(
        CredentialStatusResponse(
            source="reddit",
            configured=reddit_creds is not None,
            valid=None,  # Don't validate on status check
            message="Credentials configured" if reddit_creds else "Credentials not configured",
        )
    )

    # YouTube (cookie-based)
    browser = cred_manager.get_youtube_browser()
    results.append(
        CredentialStatusResponse(
            source="youtube",
            configured=True,  # Cookie-based, always "configured"
            valid=None,
            message=f"Using {browser} browser cookies",
        )
    )

    # Raindrop
    raindrop_token = cred_manager.get_raindrop_token()
    results.append(
        CredentialStatusResponse(
            source="raindrop",
            configured=raindrop_token is not None,
            valid=None,
            message="Token configured" if raindrop_token else "Token not configured",
        )
    )

    return results


@router.post("/credentials/reddit", response_model=CredentialStatusResponse)
async def set_reddit_credentials(credentials: RedditCredentials) -> CredentialStatusResponse:
    """Configure Reddit API credentials.

    Store Reddit OAuth credentials in the system keyring.
    """
    cred_manager = get_credential_manager()

    success = cred_manager.set_reddit_credentials(
        client_id=credentials.client_id,
        client_secret=credentials.client_secret,
        username=credentials.username,
        password=credentials.password,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store credentials in keyring",
        )

    return CredentialStatusResponse(
        source="reddit",
        configured=True,
        valid=None,
        message="Credentials stored successfully",
    )


@router.delete("/credentials/reddit", response_model=CredentialStatusResponse)
async def delete_reddit_credentials() -> CredentialStatusResponse:
    """Delete Reddit API credentials from keyring."""
    cred_manager = get_credential_manager()
    cred_manager.delete_reddit_credentials()

    return CredentialStatusResponse(
        source="reddit",
        configured=False,
        valid=None,
        message="Credentials deleted",
    )


@router.post("/credentials/reddit/validate", response_model=CredentialStatusResponse)
async def validate_reddit_credentials() -> CredentialStatusResponse:
    """Validate Reddit API credentials.

    Attempts to authenticate with Reddit using stored credentials.
    """
    worker = RedditSyncWorker()
    is_valid, message = await worker.validate_credentials()

    return CredentialStatusResponse(
        source="reddit",
        configured=True,
        valid=is_valid,
        message=message,
    )


class YouTubeBrowserRequest(BaseModel):
    """Request to set YouTube browser for cookies."""

    browser: str = Field(..., description="Browser name (chrome, firefox, safari, etc.)")


@router.post("/credentials/youtube/browser", response_model=CredentialStatusResponse)
async def set_youtube_browser(request: YouTubeBrowserRequest) -> CredentialStatusResponse:
    """Set the browser to use for YouTube cookie extraction."""
    cred_manager = get_credential_manager()
    cred_manager.set_youtube_browser(request.browser)

    return CredentialStatusResponse(
        source="youtube",
        configured=True,
        valid=None,
        message=f"Browser set to {request.browser}",
    )


@router.post("/credentials/youtube/validate", response_model=CredentialStatusResponse)
async def validate_youtube_credentials() -> CredentialStatusResponse:
    """Validate YouTube cookie access.

    Attempts to access YouTube using browser cookies.
    """
    worker = YouTubeSyncWorker()
    is_valid, message = await worker.validate_credentials()

    return CredentialStatusResponse(
        source="youtube",
        configured=True,
        valid=is_valid,
        message=message,
    )


# Raindrop credentials


class RaindropTokenRequest(BaseModel):
    """Request to set Raindrop.io API token."""

    token: str = Field(..., description="Raindrop.io test token or OAuth access token")


@router.post("/credentials/raindrop", response_model=CredentialStatusResponse)
async def set_raindrop_token(request: RaindropTokenRequest) -> CredentialStatusResponse:
    """Configure Raindrop.io API token.

    Store Raindrop API token in the system keyring.
    Get a test token from: https://app.raindrop.io/settings/integrations
    """
    cred_manager = get_credential_manager()

    success = cred_manager.set_raindrop_token(request.token)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store token in keyring",
        )

    return CredentialStatusResponse(
        source="raindrop",
        configured=True,
        valid=None,
        message="Token stored successfully",
    )


@router.delete("/credentials/raindrop", response_model=CredentialStatusResponse)
async def delete_raindrop_token() -> CredentialStatusResponse:
    """Delete Raindrop.io API token from keyring."""
    cred_manager = get_credential_manager()
    cred_manager.delete_raindrop_token()

    return CredentialStatusResponse(
        source="raindrop",
        configured=False,
        valid=None,
        message="Token deleted",
    )


@router.post("/credentials/raindrop/validate", response_model=CredentialStatusResponse)
async def validate_raindrop_token() -> CredentialStatusResponse:
    """Validate Raindrop.io API token.

    Attempts to authenticate with Raindrop.io using stored token.
    """
    worker = RaindropSyncWorker()
    is_valid, message = await worker.validate_credentials()

    return CredentialStatusResponse(
        source="raindrop",
        configured=True,
        valid=is_valid,
        message=message,
    )


# GDPR Import endpoints

class GdprImportRequest(BaseModel):
    """Request to import Reddit GDPR data."""

    csv_path: str = Field(
        ...,
        description="Path to saved_posts.csv from GDPR export",
        examples=["/Users/silver/Projects/UnifiedSaved/export_silver_gr_20251225/saved_posts.csv"]
    )


class GdprImportResponse(BaseModel):
    """Response for GDPR import endpoint."""

    message: str
    import_started: bool = False
    stats: dict | None = None


@router.post("/reddit/gdpr-import", response_model=GdprImportResponse)
async def import_reddit_gdpr_data(
    request: GdprImportRequest,
    background_tasks: BackgroundTasks,
) -> GdprImportResponse:
    """Import Reddit saved posts from GDPR export CSV.

    Creates stub items for all saved posts in the CSV file. This bypasses
    the Reddit API's 1000 item limit for saved posts retrieval.

    The import:
    - Skips deleted/removed posts
    - Skips items already in the database
    - Creates minimal stubs that can be enriched later

    This is a fast import that doesn't fetch full metadata for each item.
    """
    csv_path = Path(request.csv_path)

    if not csv_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"CSV file not found: {request.csv_path}",
        )

    if not csv_path.name.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV file",
        )

    # Check if Reddit sync is already running
    worker = RedditSyncWorker()
    if await worker.is_running():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Reddit sync is already running. Please wait for it to complete.",
        )

    # Run import in background
    async def run_import():
        result = await import_reddit_gdpr_stub_only(str(csv_path))
        logger.info(f"Reddit GDPR import completed: {result}")

    background_tasks.add_task(run_import)

    return GdprImportResponse(
        message="Reddit GDPR import started in background",
        import_started=True,
        stats=None,
    )
