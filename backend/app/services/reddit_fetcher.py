"""Service to fetch full Reddit post details including comments."""

import asyncio
import logging
from datetime import datetime
from typing import Any

import praw
from praw.models import Submission, Comment

from app.core.credentials import get_credential_manager
from app.schemas.item import RedditComment, RedditPostDetails

logger = logging.getLogger(__name__)


class RedditFetcher:
    """Fetches detailed Reddit post information including top comments."""

    DEFAULT_COMMENT_LIMIT = 30
    COMMENT_BODY_MAX_LENGTH = 10000

    def __init__(self) -> None:
        """Initialize Reddit fetcher."""
        self._credential_manager = get_credential_manager()
        self._reddit: praw.Reddit | None = None

    def _get_reddit_instance(self) -> praw.Reddit:
        """Get authenticated Reddit instance (read-only).

        Returns:
            PRAW Reddit instance.

        Raises:
            ValueError: If credentials are not configured.
        """
        creds = self._credential_manager.get_reddit_credentials()
        if not creds:
            raise ValueError("Reddit credentials not configured")

        return praw.Reddit(
            client_id=creds.client_id,
            client_secret=creds.client_secret,
            user_agent=f"UnifiedSaved/1.0 (by u/{creds.username})",
        )

    def _parse_comment(
        self, comment: Comment, depth: int = 0, max_depth: int = 3, max_replies: int = 5
    ) -> RedditComment:
        """Parse a PRAW Comment into RedditComment schema with nested replies.

        Args:
            comment: PRAW Comment object.
            depth: Current nesting depth (0 = top-level).
            max_depth: Maximum depth to fetch replies (default: 3 levels).
            max_replies: Maximum replies per comment to include.

        Returns:
            RedditComment schema instance with nested replies.
        """
        body = comment.body
        if len(body) > self.COMMENT_BODY_MAX_LENGTH:
            body = body[: self.COMMENT_BODY_MAX_LENGTH - 3] + "..."

        # Parse nested replies if not at max depth
        replies: list[RedditComment] = []
        if depth < max_depth and hasattr(comment, "replies") and comment.replies:
            # Get reply comments (filter out MoreComments objects)
            reply_comments = [
                r for r in comment.replies
                if hasattr(r, "body") and hasattr(r, "score")
            ]
            # Sort by score and take top N
            reply_comments = sorted(
                reply_comments,
                key=lambda c: c.score if hasattr(c, "score") else 0,
                reverse=True,
            )[:max_replies]

            for reply in reply_comments:
                replies.append(
                    self._parse_comment(reply, depth + 1, max_depth, max_replies)
                )

        return RedditComment(
            author=str(comment.author) if comment.author else None,
            body=body,
            score=comment.score,
            created_utc=datetime.fromtimestamp(comment.created_utc)
            if hasattr(comment, "created_utc")
            else None,
            depth=depth,
            replies=replies,
        )

    def _fetch_submission_sync(
        self, reddit: praw.Reddit, submission_id: str, comment_limit: int
    ) -> dict[str, Any]:
        """Synchronously fetch submission details (runs in executor).

        Args:
            reddit: Authenticated Reddit instance.
            submission_id: Reddit submission ID.
            comment_limit: Number of top comments to fetch.

        Returns:
            Dictionary with submission data.
        """
        submission = reddit.submission(id=submission_id)

        # Get thumbnail URL
        thumbnail_url = None
        if hasattr(submission, "preview") and submission.preview:
            images = submission.preview.get("images", [])
            if images:
                thumbnail_url = images[0].get("source", {}).get("url")

        if not thumbnail_url and hasattr(submission, "thumbnail"):
            thumb = submission.thumbnail
            if thumb and thumb not in ("self", "default", "nsfw", "spoiler", ""):
                thumbnail_url = thumb

        # Get top-level comments with nested replies (tree structure)
        comments = []
        try:
            # Replace "more comments" with limit=1 to get some nested replies
            submission.comments.replace_more(limit=1)

            # Get top-level comments only (not flattened)
            top_level_comments = [
                c for c in submission.comments
                if hasattr(c, "body") and hasattr(c, "score")
            ]
            # Sort by score and take top N
            top_level_comments = sorted(
                top_level_comments,
                key=lambda c: c.score if hasattr(c, "score") else 0,
                reverse=True,
            )[:comment_limit]

            for comment in top_level_comments:
                # Parse with hierarchy (depth=0, max 3 levels deep, 5 replies per level)
                comments.append(self._parse_comment(comment, depth=0, max_depth=3, max_replies=5))
        except Exception as e:
            logger.warning(f"Failed to fetch comments for {submission_id}: {e}")

        return {
            "id": submission.id,
            "title": submission.title,
            "selftext": submission.selftext if submission.selftext else None,
            "url": submission.url if not submission.is_self else None,
            "author": str(submission.author) if submission.author else None,
            "subreddit": str(submission.subreddit),
            "score": submission.score,
            "num_comments": submission.num_comments,
            "created_utc": datetime.fromtimestamp(submission.created_utc)
            if hasattr(submission, "created_utc")
            else None,
            "permalink": submission.permalink,
            "is_self": submission.is_self,
            "thumbnail_url": thumbnail_url,
            "comments": comments,
        }

    async def fetch_post_details(
        self, submission_id: str, comment_limit: int | None = None
    ) -> RedditPostDetails:
        """Fetch detailed Reddit post information including top comments.

        Args:
            submission_id: Reddit submission ID (e.g., "abc123").
            comment_limit: Number of top comments to fetch (default: 5).

        Returns:
            RedditPostDetails with post info and top comments.

        Raises:
            ValueError: If credentials not configured.
            RuntimeError: If Reddit API call fails.
        """
        if comment_limit is None:
            comment_limit = self.DEFAULT_COMMENT_LIMIT

        try:
            loop = asyncio.get_event_loop()
            reddit = await loop.run_in_executor(None, self._get_reddit_instance)

            data = await loop.run_in_executor(
                None, lambda: self._fetch_submission_sync(reddit, submission_id, comment_limit)
            )

            return RedditPostDetails(**data)

        except praw.exceptions.PRAWException as e:
            logger.error(f"PRAW error fetching submission {submission_id}: {e}")
            raise RuntimeError(f"Reddit API error: {e}") from e
        except Exception as e:
            logger.error(f"Failed to fetch Reddit submission {submission_id}: {e}")
            raise RuntimeError(f"Failed to fetch Reddit post: {e}") from e


# Singleton instance
_reddit_fetcher: RedditFetcher | None = None


def get_reddit_fetcher() -> RedditFetcher:
    """Get the global RedditFetcher instance.

    Returns:
        RedditFetcher instance.
    """
    global _reddit_fetcher
    if _reddit_fetcher is None:
        _reddit_fetcher = RedditFetcher()
    return _reddit_fetcher
