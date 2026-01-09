"""Reddit GDPR import worker - imports saved_posts.csv as stub items.

The Reddit API only returns the most recent 1000 saved items. Use the GDPR
export CSV to import all historical saved items as "stubs" that can be
enriched later.

CSV format: id,permalink
"""

import asyncio
import csv
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

import praw

from app.core.credentials import get_credential_manager
from app.services.sync.base import BaseSyncWorker

logger = logging.getLogger(__name__)


class RedditGdprImportWorker(BaseSyncWorker):
    """Import worker for Reddit GDPR saved_posts.csv export.

    Creates stub items that can be enriched later with full metadata.
    Skips deleted posts and avoids duplicates.
    """

    SOURCE_NAME = "reddit_gdpr"
    RATE_LIMIT_DELAY = 1.0  # Respectful rate limiting
    BATCH_SIZE = 100  # Process in batches for progress tracking

    def __init__(self, csv_path: str | Path) -> None:
        """Initialize Reddit GDPR import worker.

        Args:
            csv_path: Path to saved_posts.csv from GDPR export.
        """
        super().__init__()
        self._credential_manager = get_credential_manager()
        self._csv_path = Path(csv_path)
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
            loop = asyncio.get_event_loop()
            reddit = await loop.run_in_executor(None, self._get_reddit_instance)
            user = await loop.run_in_executor(None, lambda: reddit.user.me())
            if user:
                return True, f"Authenticated as u/{user.name}"
            else:
                return False, "Failed to authenticate - no user returned"

        except praw.exceptions.PRAWException as e:
            return False, f"PRAW error: {e}"
        except Exception as e:
            return False, f"Authentication failed: {e}"

    def _parse_csv(self) -> list[dict[str, str]]:
        """Parse the saved_posts.csv file.

        Returns:
            List of dicts with 'id' and 'permalink' keys.
        """
        if not self._csv_path.exists():
            raise FileNotFoundError(f"CSV file not found: {self._csv_path}")

        items = []
        skipped_deleted = 0

        with open(self._csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                if row.get("id") and row.get("permalink"):
                    permalink = row["permalink"].strip()
                    # Skip deleted/removed posts
                    if "deleted" in permalink.lower() or "removed" in permalink.lower():
                        skipped_deleted += 1
                        continue
                    items.append({
                        "id": row["id"].strip(),
                        "permalink": permalink
                    })

        logger.info(f"Parsed {len(items)} items from {self._csv_path} (skipped {skipped_deleted} deleted)")
        return items

    async def _fetch_item_details(self, reddit: praw.Reddit, item_id: str) -> dict[str, Any] | None:
        """Fetch details for a single item to check if it exists.

        Args:
            reddit: Authenticated Reddit instance.
            item_id: Reddit item ID (may have prefix like 't3_').

        Returns:
            Item dict with basic details, or None if deleted/not found.
        """
        loop = asyncio.get_event_loop()

        def fetch():
            try:
                # Remove prefix if present (t3_ for posts, t1_ for comments)
                clean_id = item_id.split("_")[-1]

                # Try as submission first (most common)
                try:
                    submission = reddit.submission(id=clean_id)
                    # Access a property to check if it exists
                    _ = submission.title
                    return {
                        "type": "submission",
                        "id": submission.id,
                        "title": submission.title,
                        "subreddit": str(submission.subreddit),
                        "author": str(submission.author) if submission.author else "[deleted]",
                        "permalink": submission.permalink,
                        "url": submission.url,
                        "created_utc": submission.created_utc,
                        "over_18": submission.over_18,
                    }
                except Exception:
                    # Try as comment
                    try:
                        comment = reddit.comment(id=clean_id)
                        _ = comment.body
                        return {
                            "type": "comment",
                            "id": comment.id,
                            "subreddit": str(comment.subreddit),
                            "author": str(comment.author) if comment.author else "[deleted]",
                            "permalink": comment.permalink,
                            "created_utc": comment.created_utc,
                        }
                    except Exception:
                        return None
            except Exception:
                return None

        return await loop.run_in_executor(None, fetch)

    def _create_stub_from_details(self, details: dict[str, Any]) -> dict[str, Any]:
        """Create a stub item from fetched details.

        Args:
            details: Item details from Reddit API.

        Returns:
            Item data dictionary.
        """
        is_comment = details["type"] == "comment"

        # Generate title
        if is_comment:
            title = f"Comment in r/{details['subreddit']}"
        else:
            title = details.get("title", "Untitled")

        # Build metadata
        metadata = {
            "subreddit": details["subreddit"],
            "post_type": details["type"],
            "import_method": "gdpr_csv",
            "stub": True,  # Mark as stub for potential enrichment
        }

        if not is_comment:
            metadata.update({
                "url": details.get("url"),
                "is_nsfw": details.get("over_18", False),
            })

        # Determine URL
        if is_comment:
            url = f"https://reddit.com{details['permalink']}"
        else:
            url = details.get("url") or f"https://reddit.com{details['permalink']}"

        # Source ID - prefix comments to avoid collision
        source_id = f"c_{details['id']}" if is_comment else details['id']

        return {
            "source": "reddit",  # Use "reddit" not "reddit_gdpr" for unified view
            "source_id": source_id,
            "url": url,
            "title": title[:1000],
            "description": None,
            "content_text": None,
            "author": details.get("author", "[deleted]"),
            "thumbnail_url": None,
            "created_at": datetime.fromtimestamp(details["created_utc"]),
            "saved_at": datetime.utcnow(),  # Unknown from CSV
            "tags": [details["subreddit"]],
            "source_metadata": metadata,
        }

    def _create_minimal_stub(self, item_id: str, permalink: str) -> dict[str, Any]:
        """Create a minimal stub when API fetch fails.

        Uses what we can extract from the permalink.

        Args:
            item_id: Reddit item ID.
            permalink: Reddit permalink.

        Returns:
            Item data dictionary.
        """
        # Try to extract subreddit from permalink
        subreddit = "unknown"
        if "/r/" in permalink:
            parts = permalink.split("/r/")
            if len(parts) > 1:
                subreddit = parts[1].split("/")[0]

        # Determine if comment from URL structure
        is_comment = "/comments/" in permalink and permalink.count("/") > 6
        source_id = f"c_{item_id}" if is_comment else item_id

        return {
            "source": "reddit",
            "source_id": source_id,
            "url": permalink if permalink.startswith("http") else f"https://reddit.com{permalink}",
            "title": f"Saved item from r/{subreddit}",
            "description": None,
            "content_text": None,
            "author": "[unknown]",
            "thumbnail_url": None,
            "created_at": datetime.utcnow(),  # Unknown
            "saved_at": datetime.utcnow(),
            "tags": [subreddit],
            "source_metadata": {
                "subreddit": subreddit,
                "post_type": "comment" if is_comment else "submission",
                "import_method": "gdpr_csv",
                "stub": True,
                "api_unavailable": True,
            },
        }

    async def _fetch_items(self, force: bool = False) -> list[dict[str, Any]]:
        """Fetch and parse items from GDPR CSV.

        Args:
            force: Unused (always import all from CSV).

        Returns:
            List of item data dictionaries.
        """
        try:
            # Parse CSV
            csv_items = self._parse_csv()
            total_items = len(csv_items)

            # Get existing source_ids to avoid duplicates
            from app.schemas.item import FilterParams
            existing_ids = set()
            page = 1
            while True:
                filters = FilterParams(source="reddit", page=page, page_size=200)
                existing_items, _ = await self._item_repo.list_items(filters)
                for item in existing_items:
                    existing_ids.add(item["source_id"])
                if len(existing_items) < 200:
                    break
                page += 1
            logger.info(f"Found {len(existing_ids)} existing Reddit items in database")

            # Get Reddit instance for detail fetching
            loop = asyncio.get_event_loop()
            self._reddit = await loop.run_in_executor(None, self._get_reddit_instance)

            # Process items
            stubs = []
            skipped_deleted = 0
            skipped_duplicate = 0
            skipped_error = 0

            for i, csv_item in enumerate(csv_items):
                item_id = csv_item["id"]
                permalink = csv_item["permalink"]

                # Check if already exists
                # Need to handle both formats (with and without c_ prefix)
                potential_ids = [item_id, f"c_{item_id}"]
                if any(existing_id in existing_ids for existing_id in potential_ids):
                    skipped_duplicate += 1
                    continue

                # Try to fetch details
                try:
                    details = await self._fetch_item_details(self._reddit, item_id)

                    if details is None:
                        # Post was deleted or removed
                        skipped_deleted += 1
                        continue

                    # Create stub from fetched details
                    stub = self._create_stub_from_details(details)
                    stubs.append(stub)

                    # Add to existing IDs to avoid duplicates within this batch
                    existing_ids.add(stub["source_id"])

                    # Rate limiting
                    if i > 0 and i % 50 == 0:
                        await asyncio.sleep(2)
                        logger.info(f"Progress: {i}/{total_items} processed, {len(stubs)} imported, "
                                   f"{skipped_deleted} deleted, {skipped_duplicate} duplicates")

                except Exception as e:
                    # On error, create minimal stub or skip
                    logger.warning(f"Error fetching {item_id}, creating minimal stub: {e}")
                    try:
                        stub = self._create_minimal_stub(item_id, permalink)
                        stubs.append(stub)
                        existing_ids.add(stub["source_id"])
                    except Exception:
                        skipped_error += 1

            logger.info(f"GDPR import complete: {len(stubs)} stubs created, "
                       f"{skipped_deleted} deleted skipped, {skipped_duplicate} duplicates skipped, "
                       f"{skipped_error} errors skipped")

            return stubs

        except Exception as e:
            raise RuntimeError(f"Failed to import Reddit GDPR data: {e}") from e


async def import_reddit_gdpr(csv_path: str) -> dict[str, Any]:
    """Convenience function to run Reddit GDPR import.

    Args:
        csv_path: Path to saved_posts.csv from GDPR export.

    Returns:
        Sync result dictionary.
    """
    worker = RedditGdprImportWorker(csv_path)
    return await worker.sync(force=True)


async def import_reddit_gdpr_stub_only(csv_path: str) -> dict[str, Any]:
    """Import GDPR CSV without fetching details (fast, minimal stubs).

    Creates stubs for ALL items in CSV without checking if deleted.
    Use this when you want to import everything quickly and clean up later.

    Args:
        csv_path: Path to saved_posts.csv from GDPR export.

    Returns:
        Sync result dictionary.
    """
    from app.database import get_database
    from app.repositories.item_repo import ItemRepository
    from app.schemas.item import FilterParams, ItemCreate

    worker = RedditGdprImportWorker(csv_path)

    # Parse CSV directly without API calls
    csv_path_obj = Path(csv_path)
    if not csv_path_obj.exists():
        raise FileNotFoundError(f"CSV file not found: {csv_path}")

    items = []
    with open(csv_path_obj, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get("id") and row.get("permalink"):
                permalink = row["permalink"].strip()
                # Skip deleted/removed posts
                if "deleted" in permalink.lower() or "removed" in permalink.lower():
                    continue
                items.append({
                    "id": row["id"].strip(),
                    "permalink": permalink
                })

    # Get existing IDs from database to avoid duplicates
    db = get_database()
    item_repo = ItemRepository(db)

    # Create filter to get all reddit items (page_size max is 200)
    existing_ids = set()
    page = 1
    while True:
        filters = FilterParams(source="reddit", page=page, page_size=200)
        existing_items, total = await item_repo.list_items(filters)
        for item in existing_items:
            existing_ids.add(item["source_id"])
        if len(existing_items) < 200:
            break
        page += 1

    stubs = []
    skipped = 0

    for item in items:
        item_id = item["id"]
        permalink = item["permalink"]

        # Check duplicate (try both with and without comment prefix)
        potential_ids = [item_id, f"c_{item_id}"]
        if any(existing_id in existing_ids for existing_id in potential_ids):
            skipped += 1
            continue

        # Create minimal stub
        stub = worker._create_minimal_stub(item_id, permalink)
        stubs.append(stub)
        # Add to existing IDs to avoid duplicates within this batch
        existing_ids.add(stub["source_id"])

    # Save to database
    created_count = 0

    for stub_data in stubs:
        try:
            item = ItemCreate(**stub_data)
            await item_repo.create(item)
            created_count += 1
        except Exception as e:
            worker._errors.append(f"Failed to create stub for {stub_data.get('source_id')}: {e}")

    return {
        "success": True,
        "items_synced": created_count,
        "errors": worker._errors if worker._errors else None,
        "stats": {
            "total_in_csv": len(items),
            "skipped_duplicates": skipped,
            "created": created_count,
        }
    }
