"""Social presence checking API endpoints."""

import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query

from app.database import Database, get_database
from app.schemas.social import (
    BatchCheckRequest,
    BatchCheckResponse,
    SocialCheckResponse,
)
from app.services.social_checker.service import SocialCheckerService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/items", tags=["social"])


def get_social_service(
    db: Annotated[Database, Depends(get_database)]
) -> SocialCheckerService:
    """Dependency to get social checker service."""
    return SocialCheckerService(db)


@router.post("/{item_id}/check-social", response_model=SocialCheckResponse)
async def check_social_presence(
    item_id: str,
    refresh: bool = Query(False, description="Force refresh, ignore cache"),
    service: SocialCheckerService = Depends(get_social_service),
) -> SocialCheckResponse:
    """Check if an item's URL has been shared on HN/Reddit.

    - Returns cached results if available (unless refresh=True)
    - Checks both Hacker News and Reddit in parallel
    - Stores results in database for future lookups
    """
    try:
        return await service.check_item(item_id, refresh=refresh)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Social check failed for {item_id}: {e}")
        raise HTTPException(status_code=500, detail="Social check failed")


@router.get("/{item_id}/social-mentions", response_model=SocialCheckResponse)
async def get_social_mentions(
    item_id: str,
    service: SocialCheckerService = Depends(get_social_service),
) -> SocialCheckResponse:
    """Get cached social mentions for an item (no API calls).

    Returns whatever is stored in the database without making
    external API calls. Use check-social to refresh.
    """
    return await service.get_cached_mentions(item_id)


@router.post("/batch/check-social", response_model=BatchCheckResponse)
async def batch_check_social(
    request: BatchCheckRequest,
    service: SocialCheckerService = Depends(get_social_service),
) -> BatchCheckResponse:
    """Check social presence for multiple items.

    - Maximum 50 items per request
    - Includes 1 second delay between items for rate limiting
    - Returns partial results if some items fail
    """
    return await service.check_batch(request.item_ids)
