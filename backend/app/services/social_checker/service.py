"""Social checker orchestrator service."""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from app.database import Database
from app.repositories.item_repo import ItemRepository
from app.repositories.social_repo import SocialMentionsRepository
from app.schemas.social import (
    SocialCheckResponse,
    SocialMention,
    SocialMentionCreate,
    BatchCheckResponse,
)
from app.services.social_checker.hackernews import HackerNewsChecker
from app.services.social_checker.reddit import RedditChecker

logger = logging.getLogger(__name__)


class SocialCheckerService:
    """Orchestrates social presence checking across platforms."""

    def __init__(self, database: Database):
        """Initialize service with database connection."""
        self._db = database
        self._item_repo = ItemRepository(database)
        self._social_repo = SocialMentionsRepository(database)
        self._hn_checker = HackerNewsChecker()
        self._reddit_checker = RedditChecker()

    async def check_item(
        self, item_id: str, refresh: bool = False
    ) -> SocialCheckResponse:
        """Check social presence for a single item.

        Args:
            item_id: The item ID to check.
            refresh: If True, force re-check even if cached.

        Returns:
            SocialCheckResponse with results from both platforms.
        """
        # Get item URL
        item = await self._item_repo.get_by_id(item_id)
        if not item:
            raise ValueError(f"Item not found: {item_id}")

        url = item.get("url")
        if not url:
            return SocialCheckResponse(
                item_id=item_id,
                checked_at=datetime.utcnow(),
                hn_error="Item has no URL",
                reddit_error="Item has no URL",
            )

        # Check if we have recent results (skip if refresh=True)
        if not refresh:
            existing = await self._social_repo.get_by_item_id(item_id)
            if existing:
                # Return cached results
                hn_mentions = [
                    SocialMention(**m) for m in existing
                    if m["platform"] == "hackernews"
                ]
                reddit_mentions = [
                    SocialMention(**m) for m in existing
                    if m["platform"] == "reddit"
                ]
                last_check = await self._social_repo.get_last_check_time(item_id)
                return SocialCheckResponse(
                    item_id=item_id,
                    hackernews=hn_mentions,
                    reddit=reddit_mentions,
                    checked_at=last_check or datetime.utcnow(),
                )

        # Run both checks in parallel
        hn_error: str | None = None
        reddit_error: str | None = None

        hn_task = asyncio.create_task(self._check_hn(url, item_id))
        reddit_task = asyncio.create_task(self._check_reddit(url, item_id))

        try:
            hn_results = await hn_task
        except Exception as e:
            logger.error(f"HN check failed for {item_id}: {e}")
            hn_results = []
            hn_error = str(e)

        try:
            reddit_results = await reddit_task
        except Exception as e:
            logger.error(f"Reddit check failed for {item_id}: {e}")
            reddit_results = []
            reddit_error = str(e)

        return SocialCheckResponse(
            item_id=item_id,
            hackernews=hn_results,
            reddit=reddit_results,
            checked_at=datetime.utcnow(),
            hn_error=hn_error,
            reddit_error=reddit_error,
        )

    async def _check_hn(self, url: str, item_id: str) -> list[SocialMention]:
        """Check HN and store results."""
        results = await self._hn_checker.search_url(url)
        mentions = []

        for result in results:
            # Fetch top comment if not already present
            if not result.get("top_comment") and result.get("external_id"):
                result["top_comment"] = await self._hn_checker.get_top_comment(
                    result["external_id"]
                )

            # Store in DB
            mention_data = SocialMentionCreate(
                item_id=item_id,
                platform="hackernews",
                external_id=result["external_id"],
                url=result["url"],
                title=result.get("title"),
                score=result.get("score", 0),
                comment_count=result.get("comment_count", 0),
                posted_at=result.get("posted_at"),
                top_comment=result.get("top_comment"),
                author=result.get("author"),
                raw_data=json.dumps(result.get("raw_data")) if result.get("raw_data") else None,
            )

            stored = await self._social_repo.upsert(mention_data)
            mentions.append(SocialMention(**stored))

        return mentions

    async def _check_reddit(self, url: str, item_id: str) -> list[SocialMention]:
        """Check Reddit and store results."""
        results = await self._reddit_checker.search_url(url)
        mentions = []

        for result in results:
            mention_data = SocialMentionCreate(
                item_id=item_id,
                platform="reddit",
                external_id=result["external_id"],
                url=result["url"],
                title=result.get("title"),
                score=result.get("score", 0),
                comment_count=result.get("comment_count", 0),
                posted_at=result.get("posted_at"),
                top_comment=result.get("top_comment"),
                subreddit=result.get("subreddit"),
                author=result.get("author"),
                raw_data=json.dumps(result.get("raw_data")) if result.get("raw_data") else None,
            )

            stored = await self._social_repo.upsert(mention_data)
            mentions.append(SocialMention(**stored))

        return mentions

    async def check_batch(self, item_ids: list[str]) -> BatchCheckResponse:
        """Check social presence for multiple items.

        Args:
            item_ids: List of item IDs to check (max 50).

        Returns:
            BatchCheckResponse with results and failures.
        """
        results: dict[str, SocialCheckResponse] = {}
        failed: list[str] = []

        # Process items with rate limiting (1 req/sec for Reddit)
        for item_id in item_ids:
            try:
                result = await self.check_item(item_id, refresh=True)
                results[item_id] = result
            except Exception as e:
                logger.error(f"Batch check failed for {item_id}: {e}")
                failed.append(item_id)

            # Rate limit: wait 1 second between items for Reddit
            await asyncio.sleep(1.0)

        return BatchCheckResponse(
            results=results,
            failed=failed,
            checked_at=datetime.utcnow(),
        )

    async def get_cached_mentions(self, item_id: str) -> SocialCheckResponse:
        """Get cached social mentions without making API calls.

        Args:
            item_id: The item ID to look up.

        Returns:
            Cached results or empty response.
        """
        existing = await self._social_repo.get_by_item_id(item_id)

        hn_mentions = [
            SocialMention(**m) for m in existing
            if m["platform"] == "hackernews"
        ]
        reddit_mentions = [
            SocialMention(**m) for m in existing
            if m["platform"] == "reddit"
        ]

        last_check = await self._social_repo.get_last_check_time(item_id)

        return SocialCheckResponse(
            item_id=item_id,
            hackernews=hn_mentions,
            reddit=reddit_mentions,
            checked_at=last_check or datetime.utcnow(),
        )

    async def get_mention_summary_for_items(
        self, item_ids: list[str]
    ) -> dict[str, dict[str, Any]]:
        """Get summary counts for badge display.

        Returns dict of item_id -> {hn: {count, top_score}, reddit: {...}}
        """
        return await self._social_repo.get_mention_counts_for_items(item_ids)
