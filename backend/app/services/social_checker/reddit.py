"""Reddit social presence checker using Reddit API."""

import asyncio
import logging
from datetime import datetime
from typing import Any

import praw
from praw.models import Submission

from app.core.credentials import get_credential_manager
from app.services.social_checker.hackernews import normalize_url

logger = logging.getLogger(__name__)


def get_reddit_credentials() -> dict[str, str] | None:
    """Get Reddit credentials from the credential manager.

    Returns:
        Dict with client_id, client_secret, and user_agent, or None if not available.
    """
    cred_manager = get_credential_manager()
    creds = cred_manager.get_reddit_credentials()
    if not creds:
        return None
    return {
        "client_id": creds.client_id,
        "client_secret": creds.client_secret,
        "user_agent": "UnifiedSaved/1.0",
    }


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
