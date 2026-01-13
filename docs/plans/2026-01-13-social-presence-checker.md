# Social Presence Checker Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Add the ability to check if a saved link has been shared on Hacker News and Reddit, displaying engagement metrics and discussion links.

**Architecture:** Separate `social_mentions` table with foreign key to items. Backend service module with HN Algolia and Reddit API integrations. Frontend shows badges on item rows/cards and expandable details in ItemDetailModal.

**Tech Stack:**
- Backend: FastAPI, httpx (async HTTP), praw (Reddit), aiosqlite
- Frontend: React, TanStack Query, shadcn/ui (Collapsible, Badge)

---

## Future Work (Not Implemented Now)

The following features are planned but **not part of this implementation**:

1. **Sync Integration** - Auto-check social presence when new items are synced
2. **Background Job** - Periodic batch checking of unchecked items
3. **Additional Platforms** - Twitter/X, Lobste.rs, etc.

---

## Task 1: Database Migration

**Files:**
- Create: `backend/migrations/005_social_mentions.sql`

**Step 1: Create migration file**

```sql
-- Migration: Add social_mentions table for HN/Reddit discussion tracking
-- This table stores cached results from social platform API lookups

CREATE TABLE IF NOT EXISTS social_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('hackernews', 'reddit')),
    external_id TEXT NOT NULL,

    -- Common fields
    url TEXT NOT NULL,
    title TEXT,
    score INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    posted_at TEXT,
    top_comment TEXT,

    -- Platform-specific (nullable)
    subreddit TEXT,
    author TEXT,

    -- Metadata
    checked_at TEXT NOT NULL DEFAULT (datetime('now')),
    raw_data TEXT,

    UNIQUE(item_id, platform, external_id)
);

-- Index for fast lookups by item
CREATE INDEX IF NOT EXISTS idx_social_mentions_item_id ON social_mentions(item_id);

-- Index for filtering by platform
CREATE INDEX IF NOT EXISTS idx_social_mentions_platform ON social_mentions(platform);

-- Index for checking freshness
CREATE INDEX IF NOT EXISTS idx_social_mentions_checked_at ON social_mentions(checked_at);
```

**Step 2: Verify migration runs on startup**

```bash
cd backend && uv run uvicorn app.main:app --reload --port 8001
```

Expected: Logs show "Running migration: 005_social_mentions.sql"

**Step 3: Verify table exists**

```bash
cd backend && sqlite3 ../data/unified.db ".schema social_mentions"
```

Expected: Schema output matches the migration

**Step 4: Commit**

```bash
git add backend/migrations/005_social_mentions.sql
git commit -m "feat(db): add social_mentions table for HN/Reddit tracking"
```

---

## Task 2: Backend Pydantic Schemas

**Files:**
- Create: `backend/app/schemas/social.py`

**Step 1: Create schema file**

```python
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
```

**Step 2: Commit**

```bash
git add backend/app/schemas/social.py
git commit -m "feat(schemas): add Pydantic models for social presence"
```

---

## Task 3: Social Mentions Repository

**Files:**
- Create: `backend/app/repositories/social_repo.py`

**Step 1: Create repository file**

```python
"""Repository for social mentions data access."""

import json
import logging
from datetime import datetime
from typing import Any

from app.database import Database
from app.schemas.social import SocialMentionCreate

logger = logging.getLogger(__name__)


class SocialMentionsRepository:
    """Repository for social_mentions CRUD operations."""

    def __init__(self, database: Database) -> None:
        """Initialize repository with database connection."""
        self._db = database

    def _row_to_dict(self, row) -> dict[str, Any]:
        """Convert database row to dictionary."""
        result = dict(row)
        # Parse datetime strings
        if result.get("posted_at"):
            result["posted_at"] = datetime.fromisoformat(result["posted_at"])
        if result.get("checked_at"):
            result["checked_at"] = datetime.fromisoformat(result["checked_at"])
        return result

    async def get_by_item_id(self, item_id: str) -> list[dict[str, Any]]:
        """Get all social mentions for an item.

        Args:
            item_id: The item ID to look up.

        Returns:
            List of social mention dictionaries.
        """
        rows = await self._db.fetchall(
            """
            SELECT * FROM social_mentions
            WHERE item_id = ?
            ORDER BY platform, score DESC
            """,
            (item_id,)
        )
        return [self._row_to_dict(row) for row in rows]

    async def get_by_item_and_platform(
        self, item_id: str, platform: str
    ) -> list[dict[str, Any]]:
        """Get social mentions for an item on a specific platform."""
        rows = await self._db.fetchall(
            """
            SELECT * FROM social_mentions
            WHERE item_id = ? AND platform = ?
            ORDER BY score DESC
            """,
            (item_id, platform)
        )
        return [self._row_to_dict(row) for row in rows]

    async def upsert(self, mention: SocialMentionCreate) -> dict[str, Any]:
        """Insert or update a social mention.

        Uses UPSERT to handle duplicates based on (item_id, platform, external_id).
        """
        sql = """
            INSERT INTO social_mentions (
                item_id, platform, external_id, url, title, score,
                comment_count, posted_at, top_comment, subreddit, author,
                checked_at, raw_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
            ON CONFLICT(item_id, platform, external_id) DO UPDATE SET
                url = excluded.url,
                title = excluded.title,
                score = excluded.score,
                comment_count = excluded.comment_count,
                posted_at = excluded.posted_at,
                top_comment = excluded.top_comment,
                subreddit = excluded.subreddit,
                author = excluded.author,
                checked_at = datetime('now'),
                raw_data = excluded.raw_data
        """
        await self._db.execute(
            sql,
            (
                mention.item_id,
                mention.platform,
                mention.external_id,
                mention.url,
                mention.title,
                mention.score,
                mention.comment_count,
                mention.posted_at.isoformat() if mention.posted_at else None,
                mention.top_comment,
                mention.subreddit,
                mention.author,
                mention.raw_data,
            ),
        )
        await self._db.commit()

        logger.info(
            f"Upserted social mention: {mention.platform}/{mention.external_id} "
            f"for item {mention.item_id}"
        )

        # Return the upserted row
        row = await self._db.fetchone(
            """
            SELECT * FROM social_mentions
            WHERE item_id = ? AND platform = ? AND external_id = ?
            """,
            (mention.item_id, mention.platform, mention.external_id)
        )
        return self._row_to_dict(row) if row else {}

    async def delete_by_item_id(self, item_id: str) -> int:
        """Delete all social mentions for an item.

        Returns:
            Number of rows deleted.
        """
        result = await self._db.execute(
            "DELETE FROM social_mentions WHERE item_id = ?",
            (item_id,)
        )
        await self._db.commit()
        return result.rowcount if result else 0

    async def get_last_check_time(self, item_id: str) -> datetime | None:
        """Get the most recent check time for an item."""
        row = await self._db.fetchone(
            """
            SELECT MAX(checked_at) as last_check
            FROM social_mentions
            WHERE item_id = ?
            """,
            (item_id,)
        )
        if row and row["last_check"]:
            return datetime.fromisoformat(row["last_check"])
        return None

    async def get_items_with_mentions(self) -> list[str]:
        """Get list of item IDs that have social mentions."""
        rows = await self._db.fetchall(
            "SELECT DISTINCT item_id FROM social_mentions"
        )
        return [row["item_id"] for row in rows]

    async def get_mention_counts_for_items(
        self, item_ids: list[str]
    ) -> dict[str, dict[str, int]]:
        """Get mention counts per platform for multiple items.

        Returns:
            Dict mapping item_id to {platform: count}.
        """
        if not item_ids:
            return {}

        placeholders = ", ".join("?" * len(item_ids))
        rows = await self._db.fetchall(
            f"""
            SELECT item_id, platform, COUNT(*) as count, MAX(score) as top_score
            FROM social_mentions
            WHERE item_id IN ({placeholders})
            GROUP BY item_id, platform
            """,
            tuple(item_ids)
        )

        result: dict[str, dict[str, Any]] = {}
        for row in rows:
            item_id = row["item_id"]
            if item_id not in result:
                result[item_id] = {}
            result[item_id][row["platform"]] = {
                "count": row["count"],
                "top_score": row["top_score"]
            }
        return result
```

**Step 2: Commit**

```bash
git add backend/app/repositories/social_repo.py
git commit -m "feat(repo): add SocialMentionsRepository for DB access"
```

---

## Task 4: Hacker News Checker Service

**Files:**
- Create: `backend/app/services/social_checker/__init__.py`
- Create: `backend/app/services/social_checker/hackernews.py`

**Step 1: Create __init__.py**

```python
"""Social presence checker services."""

from app.services.social_checker.hackernews import HackerNewsChecker
from app.services.social_checker.reddit import RedditChecker
from app.services.social_checker.service import SocialCheckerService

__all__ = ["HackerNewsChecker", "RedditChecker", "SocialCheckerService"]
```

**Step 2: Create hackernews.py**

```python
"""Hacker News social presence checker using Algolia API."""

import logging
from datetime import datetime
from typing import Any
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse

import httpx

logger = logging.getLogger(__name__)

# HN Algolia API - no auth required, generous rate limits
HN_ALGOLIA_BASE = "https://hn.algolia.com/api/v1"


def normalize_url(url: str) -> str:
    """Normalize URL for consistent matching.

    - Remove tracking params (utm_*, ref, etc.)
    - Remove www. prefix
    - Ensure https://
    """
    try:
        parsed = urlparse(url)

        # Remove tracking params
        tracking_params = {
            "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
            "ref", "source", "fbclid", "gclid", "mc_cid", "mc_eid"
        }

        query_params = parse_qs(parsed.query)
        filtered_params = {
            k: v for k, v in query_params.items()
            if k.lower() not in tracking_params
        }

        # Rebuild URL
        clean_url = urlunparse((
            "https",  # Force https
            parsed.netloc.replace("www.", ""),  # Remove www
            parsed.path.rstrip("/"),  # Remove trailing slash
            parsed.params,
            urlencode(filtered_params, doseq=True) if filtered_params else "",
            ""  # Remove fragment
        ))

        return clean_url
    except Exception:
        return url


class HackerNewsChecker:
    """Check if a URL has been submitted to Hacker News."""

    def __init__(self, timeout: float = 10.0):
        """Initialize checker with optional timeout."""
        self.timeout = timeout

    async def search_url(self, url: str) -> list[dict[str, Any]]:
        """Search HN for submissions of this URL.

        Args:
            url: The URL to search for.

        Returns:
            List of HN story dictionaries with normalized fields.
        """
        normalized = normalize_url(url)

        # Also try with original URL for better coverage
        urls_to_try = [normalized]
        if normalized != url:
            urls_to_try.append(url)

        all_results: dict[str, dict] = {}  # Dedupe by objectID

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for search_url in urls_to_try:
                try:
                    response = await client.get(
                        f"{HN_ALGOLIA_BASE}/search",
                        params={
                            "query": search_url,
                            "tags": "story",
                            "hitsPerPage": 10,
                        }
                    )
                    response.raise_for_status()
                    data = response.json()

                    for hit in data.get("hits", []):
                        obj_id = hit.get("objectID")
                        if obj_id and obj_id not in all_results:
                            all_results[obj_id] = self._parse_hit(hit)

                except httpx.HTTPError as e:
                    logger.warning(f"HN API error for {search_url}: {e}")
                    continue

        # Sort by score descending
        results = sorted(
            all_results.values(),
            key=lambda x: x.get("score", 0),
            reverse=True
        )

        logger.info(f"Found {len(results)} HN submissions for {url}")
        return results

    def _parse_hit(self, hit: dict) -> dict[str, Any]:
        """Parse Algolia hit into normalized format."""
        obj_id = hit.get("objectID", "")
        created_at = hit.get("created_at")

        return {
            "external_id": obj_id,
            "url": f"https://news.ycombinator.com/item?id={obj_id}",
            "title": hit.get("title"),
            "score": hit.get("points", 0),
            "comment_count": hit.get("num_comments", 0),
            "posted_at": datetime.fromisoformat(created_at.replace("Z", "+00:00")) if created_at else None,
            "author": hit.get("author"),
            "raw_data": hit,
        }

    async def get_top_comment(self, story_id: str) -> str | None:
        """Fetch top comment for a story.

        Args:
            story_id: The HN story ID.

        Returns:
            Text of top comment or None.
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{HN_ALGOLIA_BASE}/items/{story_id}"
                )
                response.raise_for_status()
                data = response.json()

                children = data.get("children", [])
                if children:
                    # First child is usually top comment
                    top = children[0]
                    text = top.get("text", "")
                    # Truncate if too long
                    if len(text) > 500:
                        text = text[:497] + "..."
                    return text
        except Exception as e:
            logger.warning(f"Failed to fetch top comment for {story_id}: {e}")

        return None
```

**Step 3: Commit**

```bash
git add backend/app/services/social_checker/__init__.py
git add backend/app/services/social_checker/hackernews.py
git commit -m "feat(service): add HackerNews checker with Algolia API"
```

---

## Task 5: Reddit Checker Service

**Files:**
- Create: `backend/app/services/social_checker/reddit.py`

**Step 1: Create reddit.py**

```python
"""Reddit social presence checker using Reddit API."""

import asyncio
import logging
from datetime import datetime
from typing import Any

import praw
from praw.models import Submission

from app.core.credentials import get_reddit_credentials
from app.services.social_checker.hackernews import normalize_url

logger = logging.getLogger(__name__)


class RedditChecker:
    """Check if a URL has been submitted to Reddit."""

    def __init__(self):
        """Initialize Reddit checker."""
        self._reddit: praw.Reddit | None = None

    def _get_reddit(self) -> praw.Reddit | None:
        """Get authenticated Reddit instance."""
        if self._reddit is not None:
            return self._reddit

        try:
            creds = get_reddit_credentials()
            if not creds:
                logger.warning("Reddit credentials not available")
                return None

            self._reddit = praw.Reddit(
                client_id=creds["client_id"],
                client_secret=creds["client_secret"],
                user_agent=creds.get("user_agent", "UnifiedSaved/1.0"),
            )
            return self._reddit
        except Exception as e:
            logger.error(f"Failed to initialize Reddit client: {e}")
            return None

    async def search_url(self, url: str) -> list[dict[str, Any]]:
        """Search Reddit for submissions of this URL.

        Args:
            url: The URL to search for.

        Returns:
            List of Reddit submission dictionaries with normalized fields.
        """
        reddit = self._get_reddit()
        if not reddit:
            return []

        normalized = normalize_url(url)

        # Run blocking PRAW call in thread pool
        loop = asyncio.get_event_loop()

        try:
            results = await loop.run_in_executor(
                None,
                lambda: self._search_sync(reddit, normalized, url)
            )
            logger.info(f"Found {len(results)} Reddit submissions for {url}")
            return results
        except Exception as e:
            logger.error(f"Reddit search error: {e}")
            return []

    def _search_sync(
        self, reddit: praw.Reddit, normalized_url: str, original_url: str
    ) -> list[dict[str, Any]]:
        """Synchronous Reddit search (run in executor)."""
        all_results: dict[str, dict] = {}  # Dedupe by ID

        # Try both normalized and original URLs
        urls_to_try = [normalized_url]
        if normalized_url != original_url:
            urls_to_try.append(original_url)

        for search_url in urls_to_try:
            try:
                # Search all subreddits
                submissions = reddit.subreddit("all").search(
                    f"url:{search_url}",
                    sort="top",
                    limit=10
                )

                for submission in submissions:
                    if submission.id not in all_results:
                        all_results[submission.id] = self._parse_submission(submission)

            except Exception as e:
                logger.warning(f"Reddit search error for {search_url}: {e}")
                continue

        # Sort by score descending
        return sorted(
            all_results.values(),
            key=lambda x: x.get("score", 0),
            reverse=True
        )

    def _parse_submission(self, submission: Submission) -> dict[str, Any]:
        """Parse Reddit submission into normalized format."""
        # Get top comment if available
        top_comment = None
        try:
            submission.comments.replace_more(limit=0)
            if submission.comments:
                top = submission.comments[0]
                text = top.body
                if len(text) > 500:
                    text = text[:497] + "..."
                top_comment = text
        except Exception:
            pass

        return {
            "external_id": submission.id,
            "url": f"https://reddit.com{submission.permalink}",
            "title": submission.title,
            "score": submission.score,
            "comment_count": submission.num_comments,
            "posted_at": datetime.fromtimestamp(submission.created_utc),
            "subreddit": submission.subreddit.display_name,
            "author": str(submission.author) if submission.author else "[deleted]",
            "top_comment": top_comment,
            "raw_data": {
                "id": submission.id,
                "subreddit": submission.subreddit.display_name,
                "score": submission.score,
                "num_comments": submission.num_comments,
            },
        }
```

**Step 2: Commit**

```bash
git add backend/app/services/social_checker/reddit.py
git commit -m "feat(service): add Reddit checker using PRAW"
```

---

## Task 6: Social Checker Orchestrator Service

**Files:**
- Create: `backend/app/services/social_checker/service.py`

**Step 1: Create service.py**

```python
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
```

**Step 2: Update __init__.py exports**

The `__init__.py` was created in Task 4, Step 1 with the correct exports.

**Step 3: Commit**

```bash
git add backend/app/services/social_checker/service.py
git commit -m "feat(service): add SocialCheckerService orchestrator"
```

---

## Task 7: API Endpoints

**Files:**
- Create: `backend/app/api/v1/social.py`
- Modify: `backend/app/api/v1/__init__.py`

**Step 1: Create social.py endpoints**

```python
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
```

**Step 2: Register router in main app**

Read `backend/app/main.py` first, then add the router registration.

Add this import at the top:
```python
from app.api.v1.social import router as social_router
```

Add this line after the existing router includes:
```python
app.include_router(social_router, prefix="/api/v1")
```

**Step 3: Commit**

```bash
git add backend/app/api/v1/social.py
git add backend/app/main.py
git commit -m "feat(api): add social presence check endpoints"
```

---

## Task 8: Frontend TypeScript Types

**Files:**
- Modify: `frontend/src/types/index.ts`

**Step 1: Add social types to types/index.ts**

Add these types at the end of the file:

```typescript
/**
 * Social presence types for HN/Reddit discussion tracking
 */
export type SocialPlatform = 'hackernews' | 'reddit'

export interface SocialMention {
  id: number
  item_id: string
  platform: SocialPlatform
  external_id: string
  url: string
  title: string | null
  score: number
  comment_count: number
  posted_at: string | null
  top_comment: string | null
  subreddit: string | null  // Reddit only
  author: string | null
  checked_at: string
}

export interface SocialCheckResponse {
  item_id: string
  hackernews: SocialMention[]
  reddit: SocialMention[]
  checked_at: string
  hn_error: string | null
  reddit_error: string | null
}

export interface SocialMentionSummary {
  count: number
  top_score: number
}

export interface ItemSocialSummary {
  hackernews?: SocialMentionSummary
  reddit?: SocialMentionSummary
}
```

**Step 2: Commit**

```bash
git add frontend/src/types/index.ts
git commit -m "feat(types): add TypeScript types for social presence"
```

---

## Task 9: Frontend API Client Extensions

**Files:**
- Modify: `frontend/src/lib/api-client.ts`

**Step 1: Add socialApi to api-client.ts**

Add this after the `tagsApi` definition:

```typescript
/**
 * Social Presence API
 */
export const socialApi = {
  /**
   * Check social presence for an item (HN + Reddit)
   */
  async checkSocial(itemId: string, refresh = false): Promise<SocialCheckResponse> {
    const params = new URLSearchParams()
    if (refresh) params.set('refresh', 'true')
    const query = params.toString()
    return apiFetch<SocialCheckResponse>(
      `/items/${itemId}/check-social${query ? `?${query}` : ''}`,
      { method: 'POST' }
    )
  },

  /**
   * Get cached social mentions (no API calls)
   */
  async getSocialMentions(itemId: string): Promise<SocialCheckResponse> {
    return apiFetch<SocialCheckResponse>(`/items/${itemId}/social-mentions`)
  },

  /**
   * Batch check social presence for multiple items
   */
  async batchCheckSocial(itemIds: string[]): Promise<{
    results: Record<string, SocialCheckResponse>
    failed: string[]
    checked_at: string
  }> {
    return apiFetch(`/items/batch/check-social`, {
      method: 'POST',
      body: JSON.stringify({ item_ids: itemIds }),
    })
  },
}
```

Add import at top:
```typescript
import type { SocialCheckResponse } from '@/types'
```

Update the api export at bottom:
```typescript
export const api = {
  items: itemsApi,
  sync: syncApi,
  tags: tagsApi,
  social: socialApi,
}
```

**Step 2: Commit**

```bash
git add frontend/src/lib/api-client.ts
git commit -m "feat(api): add socialApi for social presence checking"
```

---

## Task 10: Frontend React Hooks

**Files:**
- Create: `frontend/src/features/social/hooks/useSocialMentions.ts`
- Create: `frontend/src/features/social/hooks/index.ts`
- Create: `frontend/src/features/social/index.ts`

**Step 1: Create hook file**

```typescript
// frontend/src/features/social/hooks/useSocialMentions.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { socialApi } from '@/lib/api-client'
import type { SocialCheckResponse } from '@/types'

/**
 * Query key factory for social mentions
 */
export const socialKeys = {
  all: ['social'] as const,
  mentions: (itemId: string) => [...socialKeys.all, 'mentions', itemId] as const,
}

/**
 * Hook to get cached social mentions for an item
 */
export function useSocialMentions(itemId: string | null) {
  return useQuery({
    queryKey: socialKeys.mentions(itemId ?? ''),
    queryFn: () => socialApi.getSocialMentions(itemId!),
    enabled: !!itemId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

/**
 * Hook to check social presence (makes API calls)
 */
export function useCheckSocial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ itemId, refresh = false }: { itemId: string; refresh?: boolean }) =>
      socialApi.checkSocial(itemId, refresh),
    onSuccess: (data, { itemId }) => {
      // Update cache with new data
      queryClient.setQueryData(socialKeys.mentions(itemId), data)
    },
  })
}

/**
 * Hook to batch check social presence
 */
export function useBatchCheckSocial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (itemIds: string[]) => socialApi.batchCheckSocial(itemIds),
    onSuccess: (data) => {
      // Update cache for each item
      Object.entries(data.results).forEach(([itemId, result]) => {
        queryClient.setQueryData(socialKeys.mentions(itemId), result)
      })
    },
  })
}

/**
 * Helper to check if an item has any social mentions
 */
export function hasSocialMentions(data: SocialCheckResponse | undefined): boolean {
  if (!data) return false
  return data.hackernews.length > 0 || data.reddit.length > 0
}

/**
 * Helper to get total engagement score
 */
export function getTotalEngagement(data: SocialCheckResponse | undefined): number {
  if (!data) return 0
  const hnScore = data.hackernews.reduce((sum, m) => sum + m.score, 0)
  const redditScore = data.reddit.reduce((sum, m) => sum + m.score, 0)
  return hnScore + redditScore
}
```

**Step 2: Create index exports**

```typescript
// frontend/src/features/social/hooks/index.ts
export * from './useSocialMentions'
```

```typescript
// frontend/src/features/social/index.ts
export * from './hooks'
```

**Step 3: Commit**

```bash
git add frontend/src/features/social/
git commit -m "feat(hooks): add useSocialMentions hooks for social presence"
```

---

## Task 11: SocialBadges Component

**Files:**
- Create: `frontend/src/components/shared/SocialBadges.tsx`

**Step 1: Create component**

```tsx
// frontend/src/components/shared/SocialBadges.tsx
import { MessageSquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SocialCheckResponse } from '@/types'

// HN and Reddit icons as simple SVG components
function HNIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("w-3 h-3", className)}
      fill="currentColor"
    >
      <path d="M0 0v24h24V0H0zm12.3 12.5v5.2h-1.3v-5.2L8 7.3h1.4l2.2 3.8 2.2-3.8h1.4l-2.9 5.2z"/>
    </svg>
  )
}

function RedditIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn("w-3 h-3", className)}
      fill="currentColor"
    >
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
    </svg>
  )
}

interface SocialBadgesProps {
  data: SocialCheckResponse | undefined
  isLoading?: boolean
  compact?: boolean
  className?: string
}

/**
 * SocialBadges - Display HN/Reddit engagement badges
 * Shows score and comment count for each platform
 */
export function SocialBadges({
  data,
  isLoading = false,
  compact = false,
  className
}: SocialBadgesProps) {
  if (isLoading) {
    return (
      <div className={cn("flex gap-1.5", className)}>
        <Badge variant="outline" className="animate-pulse bg-muted">
          <span className="w-12 h-3" />
        </Badge>
      </div>
    )
  }

  if (!data) return null

  const hasHN = data.hackernews.length > 0
  const hasReddit = data.reddit.length > 0

  if (!hasHN && !hasReddit) return null

  // Aggregate scores for display
  const hnTotal = data.hackernews.reduce((sum, m) => sum + m.score, 0)
  const hnComments = data.hackernews.reduce((sum, m) => sum + m.comment_count, 0)
  const redditTotal = data.reddit.reduce((sum, m) => sum + m.score, 0)
  const redditComments = data.reddit.reduce((sum, m) => sum + m.comment_count, 0)

  return (
    <div className={cn("flex gap-1.5 flex-wrap", className)}>
      {hasHN && (
        <Badge
          variant="outline"
          className="bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/30 hover:bg-orange-500/20 transition-colors"
        >
          <HNIcon className="mr-1" />
          {compact ? (
            <span>{hnTotal}</span>
          ) : (
            <>
              <span>{hnTotal}</span>
              <span className="mx-1 text-orange-400/60">·</span>
              <MessageSquare className="w-2.5 h-2.5 mr-0.5" />
              <span>{hnComments}</span>
            </>
          )}
        </Badge>
      )}

      {hasReddit && (
        <Badge
          variant="outline"
          className="bg-orange-600/10 text-orange-500 dark:text-orange-300 border-orange-600/30 hover:bg-orange-600/20 transition-colors"
        >
          <RedditIcon className="mr-1" />
          {compact ? (
            <span>{redditTotal}</span>
          ) : (
            <>
              <span>{redditTotal}</span>
              <span className="mx-1 text-orange-500/60">·</span>
              <MessageSquare className="w-2.5 h-2.5 mr-0.5" />
              <span>{redditComments}</span>
            </>
          )}
        </Badge>
      )}
    </div>
  )
}

export default SocialBadges
```

**Step 2: Commit**

```bash
git add frontend/src/components/shared/SocialBadges.tsx
git commit -m "feat(ui): add SocialBadges component for HN/Reddit display"
```

---

## Task 12: SocialMentionCard Component

**Files:**
- Create: `frontend/src/components/shared/SocialMentionCard.tsx`

**Step 1: Create component**

```tsx
// frontend/src/components/shared/SocialMentionCard.tsx
import { ExternalLink, ArrowUp, MessageSquare, User, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatRelativeTime } from '@/lib/utils'
import type { SocialMention } from '@/types'

interface SocialMentionCardProps {
  mention: SocialMention
  className?: string
}

/**
 * SocialMentionCard - Display a single social mention with details
 */
export function SocialMentionCard({ mention, className }: SocialMentionCardProps) {
  const isHN = mention.platform === 'hackernews'

  return (
    <div
      className={cn(
        "p-3 rounded-lg border transition-colors",
        isHN
          ? "bg-orange-500/5 border-orange-500/20 hover:border-orange-500/40"
          : "bg-orange-600/5 border-orange-600/20 hover:border-orange-600/40",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          {/* Title */}
          <a
            href={mention.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "font-medium hover:underline line-clamp-2",
              isHN ? "text-orange-600 dark:text-orange-400" : "text-orange-500 dark:text-orange-300"
            )}
          >
            {mention.title || 'Untitled'}
            <ExternalLink className="inline-block w-3 h-3 ml-1 opacity-60" />
          </a>

          {/* Subreddit badge (Reddit only) */}
          {mention.subreddit && (
            <Badge variant="outline" className="mt-1 text-xs">
              r/{mention.subreddit}
            </Badge>
          )}
        </div>

        {/* Score */}
        <div className={cn(
          "flex items-center gap-1 px-2 py-1 rounded text-sm font-medium",
          isHN ? "bg-orange-500/20 text-orange-600" : "bg-orange-600/20 text-orange-500"
        )}>
          <ArrowUp className="w-3.5 h-3.5" />
          {mention.score}
        </div>
      </div>

      {/* Meta info */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
        <span className="flex items-center gap-1">
          <MessageSquare className="w-3 h-3" />
          {mention.comment_count} comments
        </span>
        {mention.author && (
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {mention.author}
          </span>
        )}
        {mention.posted_at && (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(mention.posted_at)}
          </span>
        )}
      </div>

      {/* Top comment preview */}
      {mention.top_comment && (
        <div className="mt-2 p-2 bg-muted/50 rounded text-sm text-muted-foreground">
          <span className="font-medium text-xs uppercase tracking-wide opacity-60 block mb-1">
            Top Comment
          </span>
          <p className="line-clamp-3 whitespace-pre-wrap">
            {mention.top_comment}
          </p>
        </div>
      )}
    </div>
  )
}

export default SocialMentionCard
```

**Step 2: Commit**

```bash
git add frontend/src/components/shared/SocialMentionCard.tsx
git commit -m "feat(ui): add SocialMentionCard for detailed mention display"
```

---

## Task 13: SocialPresenceSection Component

**Files:**
- Create: `frontend/src/components/shared/SocialPresenceSection.tsx`

**Step 1: Create collapsible section component**

```tsx
// frontend/src/components/shared/SocialPresenceSection.tsx
import { useState } from 'react'
import { ChevronDown, Globe, RefreshCw, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SocialMentionCard } from './SocialMentionCard'
import { useSocialMentions, useCheckSocial, hasSocialMentions } from '@/features/social'
import type { SocialCheckResponse } from '@/types'

interface SocialPresenceSectionProps {
  itemId: string
  className?: string
}

/**
 * SocialPresenceSection - Expandable section showing HN/Reddit discussions
 * Used in ItemDetailModal
 */
export function SocialPresenceSection({ itemId, className }: SocialPresenceSectionProps) {
  const [isOpen, setIsOpen] = useState(false)

  const { data, isLoading: isFetching, error } = useSocialMentions(itemId)
  const checkMutation = useCheckSocial()

  const hasData = hasSocialMentions(data)
  const isChecking = checkMutation.isPending
  const totalMentions = (data?.hackernews.length ?? 0) + (data?.reddit.length ?? 0)

  const handleCheck = () => {
    checkMutation.mutate({ itemId, refresh: true })
  }

  const handleToggle = () => {
    setIsOpen(!isOpen)
    // Auto-check if no data when opening
    if (!isOpen && !hasData && !isFetching && !isChecking) {
      checkMutation.mutate({ itemId, refresh: false })
    }
  }

  return (
    <div className={cn("border rounded-lg", className)}>
      {/* Header / Trigger */}
      <button
        onClick={handleToggle}
        className={cn(
          "w-full flex items-center justify-between p-3 text-left",
          "hover:bg-muted/50 transition-colors rounded-lg",
          isOpen && "border-b"
        )}
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">Social Presence</span>
          {hasData && (
            <span className="text-sm text-muted-foreground">
              ({totalMentions} discussion{totalMentions !== 1 ? 's' : ''})
            </span>
          )}
          {isChecking && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <ChevronDown
          className={cn(
            "w-4 h-4 text-muted-foreground transition-transform",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Content */}
      {isOpen && (
        <div className="p-3 space-y-3">
          {/* Check button if no data */}
          {!hasData && !isFetching && !isChecking && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">
                Check if this link has been discussed on Hacker News or Reddit
              </p>
              <Button onClick={handleCheck} disabled={isChecking}>
                <Search className="w-4 h-4 mr-2" />
                Check HN & Reddit
              </Button>
            </div>
          )}

          {/* Loading state */}
          {(isFetching || isChecking) && !hasData && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Checking...</span>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="text-sm text-destructive p-3 bg-destructive/10 rounded">
              Failed to load social mentions
            </div>
          )}

          {/* HN mentions */}
          {data && data.hackernews.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-orange-600 dark:text-orange-400 flex items-center gap-2">
                <span>Hacker News</span>
                <span className="text-xs text-muted-foreground">
                  ({data.hackernews.length})
                </span>
              </h4>
              {data.hackernews.map((mention) => (
                <SocialMentionCard key={mention.id} mention={mention} />
              ))}
            </div>
          )}

          {/* Reddit mentions */}
          {data && data.reddit.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-orange-500 dark:text-orange-300 flex items-center gap-2">
                <span>Reddit</span>
                <span className="text-xs text-muted-foreground">
                  ({data.reddit.length})
                </span>
              </h4>
              {data.reddit.map((mention) => (
                <SocialMentionCard key={mention.id} mention={mention} />
              ))}
            </div>
          )}

          {/* No results found */}
          {hasData === false && data && !isFetching && !isChecking && (
            <div className="text-center py-4 text-muted-foreground">
              <p>No discussions found on HN or Reddit</p>
            </div>
          )}

          {/* Refresh button when we have data */}
          {hasData && (
            <div className="flex justify-end pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCheck}
                disabled={isChecking}
              >
                <RefreshCw className={cn("w-4 h-4 mr-2", isChecking && "animate-spin")} />
                Refresh
              </Button>
            </div>
          )}

          {/* Errors from check */}
          {data?.hn_error && (
            <p className="text-xs text-amber-600">HN: {data.hn_error}</p>
          )}
          {data?.reddit_error && (
            <p className="text-xs text-amber-600">Reddit: {data.reddit_error}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default SocialPresenceSection
```

**Step 2: Commit**

```bash
git add frontend/src/components/shared/SocialPresenceSection.tsx
git commit -m "feat(ui): add SocialPresenceSection collapsible component"
```

---

## Task 14: Integrate into ItemDetailModal

**Files:**
- Modify: `frontend/src/components/shared/ItemDetailModal.tsx`

**Step 1: Add SocialPresenceSection to modal**

Add import at top:
```typescript
import { SocialPresenceSection } from '@/components/shared/SocialPresenceSection'
```

Add section after the Tags section and before the Metadata grid (around line 159):

```tsx
        {/* Social Presence */}
        {item.url && (
          <div className="mb-4">
            <SocialPresenceSection itemId={item.id} />
          </div>
        )}
```

**Step 2: Commit**

```bash
git add frontend/src/components/shared/ItemDetailModal.tsx
git commit -m "feat(modal): integrate SocialPresenceSection in ItemDetailModal"
```

---

## Task 15: Add Badges to ListItemRow

**Files:**
- Modify: `frontend/src/components/shared/ListItemRow.tsx`

**Step 1: Read current file structure first**

Then add SocialBadges. Add import:

```typescript
import { SocialBadges } from '@/components/shared/SocialBadges'
import { useSocialMentions } from '@/features/social'
```

Inside the component, add hook:
```typescript
const { data: socialData } = useSocialMentions(item.id)
```

Add badges after the existing badges (source badge, unprocessed badge):
```tsx
{/* Social badges */}
<SocialBadges data={socialData} compact className="ml-1" />
```

**Step 2: Commit**

```bash
git add frontend/src/components/shared/ListItemRow.tsx
git commit -m "feat(ui): add SocialBadges to ListItemRow"
```

---

## Task 16: Testing & Verification

**Step 1: Start backend**

```bash
cd backend && uv run uvicorn app.main:app --reload --port 8001
```

Expected: Server starts, migration 005 runs successfully.

**Step 2: Start frontend**

```bash
cd frontend && bun run dev
```

Expected: Compiles without errors.

**Step 3: Test API endpoints manually**

```bash
# Get an item ID first
curl http://localhost:8001/api/v1/items?page_size=1 | jq '.items[0].id'

# Check social presence
curl -X POST http://localhost:8001/api/v1/items/{ID}/check-social | jq

# Get cached results
curl http://localhost:8001/api/v1/items/{ID}/social-mentions | jq
```

**Step 4: Test UI**

1. Open http://localhost:3000
2. Click info icon on any item with a URL
3. Expand "Social Presence" section
4. Click "Check HN & Reddit"
5. Verify badges appear and data loads

**Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete social presence checker implementation

- Add social_mentions table with HN/Reddit tracking
- Implement HN Algolia and Reddit API checkers
- Add API endpoints for check/get social presence
- Create frontend components: SocialBadges, SocialMentionCard, SocialPresenceSection
- Integrate into ItemDetailModal and ListItemRow
"
```

---

## Implementation Checklist

- [ ] Task 1: Database migration
- [ ] Task 2: Pydantic schemas
- [ ] Task 3: Social mentions repository
- [ ] Task 4: HN checker service
- [ ] Task 5: Reddit checker service
- [ ] Task 6: Orchestrator service
- [ ] Task 7: API endpoints
- [ ] Task 8: TypeScript types
- [ ] Task 9: API client extensions
- [ ] Task 10: React hooks
- [ ] Task 11: SocialBadges component
- [ ] Task 12: SocialMentionCard component
- [ ] Task 13: SocialPresenceSection component
- [ ] Task 14: ItemDetailModal integration
- [ ] Task 15: ListItemRow integration
- [ ] Task 16: Testing & verification
