"""Reddit sync worker using PRAW to fetch saved submissions and comments."""

import asyncio
import logging
from datetime import datetime
from typing import Any

import praw
from praw.models import Comment, Submission

from app.core.credentials import get_credential_manager
from app.services.sync.base import BaseSyncWorker

logger = logging.getLogger(__name__)


class RedditSyncWorker(BaseSyncWorker):
    """Sync worker for Reddit saved items."""

    SOURCE_NAME = "reddit"
    RATE_LIMIT_DELAY = 1.0  # 1 second between API calls
    MAX_ITEMS = 1000  # Reddit API limit

    def __init__(self) -> None:
        """Initialize Reddit sync worker."""
        super().__init__()
        self._credential_manager = get_credential_manager()
        self._reddit: praw.Reddit | None = None

    def _get_reddit_instance(self) -> praw.Reddit:
        """Get authenticated Reddit instance.

        Returns:
            Authenticated PRAW Reddit instance.

        Raises:
            ValueError: If credentials are not configured.
        """
        creds = self._credential_manager.get_reddit_credentials()
        if not creds:
            raise ValueError("Reddit credentials not configured")

        return praw.Reddit(
            client_id=creds.client_id,
            client_secret=creds.client_secret,
            username=creds.username,
            password=creds.password,
            user_agent=f"UnifiedSaved/1.0 (by u/{creds.username})",
        )

    async def validate_credentials(self) -> tuple[bool, str]:
        """Validate Reddit credentials.

        Returns:
            Tuple of (is_valid, message).
        """
        creds = self._credential_manager.get_reddit_credentials()
        if not creds:
            return False, "Reddit credentials not configured"

        try:
            # Run in thread pool to avoid blocking
            loop = asyncio.get_event_loop()
            reddit = await loop.run_in_executor(None, self._get_reddit_instance)

            # Try to get user info to validate credentials
            user = await loop.run_in_executor(None, lambda: reddit.user.me())
            if user:
                return True, f"Authenticated as u/{user.name}"
            else:
                return False, "Failed to authenticate - no user returned"

        except praw.exceptions.PRAWException as e:
            return False, f"PRAW error: {e}"
        except Exception as e:
            return False, f"Authentication failed: {e}"

    def _parse_submission(self, submission: Submission) -> dict[str, Any]:
        """Parse a Reddit submission into item data.

        Args:
            submission: PRAW Submission object.

        Returns:
            Item data dictionary.
        """
        # Get the best thumbnail
        thumbnail = None
        if hasattr(submission, "preview") and submission.preview:
            images = submission.preview.get("images", [])
            if images:
                # Get the source (highest quality) image
                thumbnail = images[0].get("source", {}).get("url")

        if not thumbnail and hasattr(submission, "thumbnail"):
            thumb = submission.thumbnail
            if thumb and thumb not in ("self", "default", "nsfw", "spoiler", ""):
                thumbnail = thumb

        # Get content text (for self posts)
        content_text = None
        if hasattr(submission, "selftext") and submission.selftext:
            content_text = submission.selftext

        # Build metadata
        metadata = {
            "subreddit": str(submission.subreddit),
            "subreddit_id": submission.subreddit_id,
            "is_self": submission.is_self,
            "is_video": getattr(submission, "is_video", False),
            "is_nsfw": submission.over_18,
            "score": submission.score,
            "upvote_ratio": getattr(submission, "upvote_ratio", None),
            "num_comments": submission.num_comments,
            "link_flair_text": getattr(submission, "link_flair_text", None),
            "permalink": submission.permalink,
            "domain": getattr(submission, "domain", None),
            "post_type": "submission",
        }

        # Determine URL
        url = submission.url
        if submission.is_self:
            url = f"https://reddit.com{submission.permalink}"

        return {
            "source": self.SOURCE_NAME,
            "source_id": submission.id,
            "url": url,
            "title": submission.title[:1000] if submission.title else "Untitled",
            "description": content_text[:5000] if content_text else None,
            "content_text": content_text,
            "author": str(submission.author) if submission.author else "[deleted]",
            "thumbnail_url": thumbnail,
            "created_at": datetime.fromtimestamp(submission.created_utc),
            "saved_at": datetime.utcnow(),  # Reddit doesn't expose when item was saved
            "tags": [str(submission.subreddit)],
            "source_metadata": metadata,
        }

    def _parse_comment(self, comment: Comment) -> dict[str, Any]:
        """Parse a Reddit comment into item data.

        Args:
            comment: PRAW Comment object.

        Returns:
            Item data dictionary.

        Note:
            We intentionally skip fetching the submission title to avoid
            an API call per comment. The submission_id is extracted from
            link_id (format: t3_xxxxx) which is available without API calls.
        """
        # Extract submission_id from link_id (t3_xxxxx -> xxxxx)
        # This avoids an expensive API call per comment
        submission_id = None
        link_id = getattr(comment, "link_id", None)
        if link_id and link_id.startswith("t3_"):
            submission_id = link_id[3:]

        # Build title from comment body (no API call needed)
        body_preview = comment.body[:100] if comment.body else ""
        if len(comment.body) > 100:
            body_preview += "..."

        title = f"Comment in r/{comment.subreddit}: {body_preview}"

        # Build metadata
        metadata = {
            "subreddit": str(comment.subreddit),
            "subreddit_id": comment.subreddit_id,
            "parent_id": comment.parent_id,
            "submission_id": submission_id,
            "submission_title": None,  # Skipped to avoid API call; can be fetched on-demand
            "is_submitter": getattr(comment, "is_submitter", False),
            "score": comment.score,
            "permalink": comment.permalink,
            "post_type": "comment",
        }

        return {
            "source": self.SOURCE_NAME,
            "source_id": f"c_{comment.id}",  # Prefix to avoid collision with submissions
            "url": f"https://reddit.com{comment.permalink}",
            "title": title[:1000],
            "description": None,
            "content_text": comment.body,
            "author": str(comment.author) if comment.author else "[deleted]",
            "thumbnail_url": None,
            "created_at": datetime.fromtimestamp(comment.created_utc),
            "saved_at": datetime.utcnow(),
            "tags": [str(comment.subreddit)],
            "source_metadata": metadata,
        }

    async def _fetch_saved_items(self, reddit: praw.Reddit, limit: int | None = None) -> list[Any]:
        """Fetch saved items from Reddit.

        Args:
            reddit: Authenticated Reddit instance.
            limit: Maximum items to fetch (None for max possible).

        Returns:
            List of saved items (submissions and comments).
        """
        loop = asyncio.get_event_loop()

        # Get saved items generator
        def get_saved():
            user = reddit.user.me()
            return list(user.saved(limit=limit))

        items = await loop.run_in_executor(None, get_saved)
        return items

    async def _fetch_items(self, force: bool = False) -> list[dict[str, Any]]:
        """Fetch saved items from Reddit.

        Args:
            force: If True, fetch all items. Otherwise, stop at known items.

        Returns:
            List of item data dictionaries.
        """
        try:
            # Get Reddit instance
            loop = asyncio.get_event_loop()
            self._reddit = await loop.run_in_executor(None, self._get_reddit_instance)

            # Determine limit based on force flag
            # Reddit API limits saved items to 1000
            limit = self.MAX_ITEMS if force else None

            # Fetch saved items
            logger.info(f"Fetching saved items from Reddit (force={force})")
            saved_items = await self._fetch_saved_items(self._reddit, limit)
            logger.info(f"Retrieved {len(saved_items)} saved items from Reddit")

            # Parse items
            items = []
            for item in saved_items:
                try:
                    if isinstance(item, Submission):
                        item_data = self._parse_submission(item)
                    elif isinstance(item, Comment):
                        item_data = self._parse_comment(item)
                    else:
                        logger.warning(f"Unknown item type: {type(item)}")
                        continue

                    items.append(item_data)

                except Exception as e:
                    item_id = getattr(item, "id", "unknown")
                    await self._add_error(f"Failed to parse item {item_id}: {e}")

            return items

        except praw.exceptions.PRAWException as e:
            raise RuntimeError(f"Reddit API error: {e}") from e
        except Exception as e:
            raise RuntimeError(f"Failed to fetch Reddit items: {e}") from e


async def sync_reddit(force: bool = False) -> dict[str, Any]:
    """Convenience function to run Reddit sync.

    Args:
        force: Force full sync.

    Returns:
        Sync result dictionary.
    """
    worker = RedditSyncWorker()
    return await worker.sync(force)
