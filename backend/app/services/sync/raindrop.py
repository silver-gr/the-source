"""Raindrop.io sync worker for fetching bookmarks via REST API."""

import asyncio
import logging
from datetime import datetime
from typing import Any

import httpx

from app.core.credentials import get_credential_manager
from app.services.sync.base import BaseSyncWorker

logger = logging.getLogger(__name__)


class RaindropSyncWorker(BaseSyncWorker):
    """Sync worker for Raindrop.io bookmarks."""

    SOURCE_NAME = "raindrop"
    RATE_LIMIT_DELAY = 1.0  # Slower to avoid 502 errors
    MAX_PER_PAGE = 50  # API limit
    MAX_RETRIES = 3  # Retry transient errors

    API_BASE = "https://api.raindrop.io/rest/v1"

    def __init__(self) -> None:
        """Initialize Raindrop sync worker."""
        super().__init__()
        self._credential_manager = get_credential_manager()
        self._token: str | None = None
        self._collections: dict[int, str] = {}  # id -> name mapping

    def _get_headers(self) -> dict[str, str]:
        """Get authorization headers for API requests.

        Returns:
            Headers dict with Bearer token.
        """
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json",
        }

    async def validate_credentials(self) -> tuple[bool, str]:
        """Validate Raindrop.io credentials.

        Returns:
            Tuple of (is_valid, message).
        """
        self._token = self._credential_manager.get_raindrop_token()
        if not self._token:
            return False, "Raindrop token not configured"

        try:
            async with httpx.AsyncClient() as client:
                # Test API by fetching user info
                response = await client.get(
                    f"{self.API_BASE}/user",
                    headers=self._get_headers(),
                    timeout=10.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    user = data.get("user", {})
                    name = user.get("name", "Unknown")
                    return True, f"Authenticated as {name}"
                elif response.status_code == 401:
                    return False, "Invalid or expired token"
                else:
                    return False, f"API error: {response.status_code}"

        except httpx.TimeoutException:
            return False, "Connection timeout"
        except Exception as e:
            return False, f"Connection failed: {e}"

    async def _fetch_collections(self) -> dict[int, str]:
        """Fetch all collections and build id->name mapping.

        Returns:
            Dictionary mapping collection ID to collection name.
        """
        collections: dict[int, str] = {}

        try:
            async with httpx.AsyncClient() as client:
                # Fetch root collections
                response = await client.get(
                    f"{self.API_BASE}/collections",
                    headers=self._get_headers(),
                    timeout=30.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    for coll in data.get("items", []):
                        collections[coll["_id"]] = coll.get("title", "Untitled")

                # Fetch child collections
                response = await client.get(
                    f"{self.API_BASE}/collections/childrens",
                    headers=self._get_headers(),
                    timeout=30.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    for coll in data.get("items", []):
                        collections[coll["_id"]] = coll.get("title", "Untitled")

                # Add special collections
                collections[-1] = "Unsorted"
                collections[-99] = "Trash"

                logger.info(f"Fetched {len(collections)} collections from Raindrop")

        except Exception as e:
            logger.warning(f"Failed to fetch collections: {e}")

        return collections

    def _parse_raindrop(self, item: dict[str, Any]) -> dict[str, Any]:
        """Parse a Raindrop item into item data.

        Args:
            item: Raindrop API response item.

        Returns:
            Item data dictionary matching ItemCreate schema.
        """
        # Get collection name for tags
        collection_id = item.get("collection", {}).get("$id")
        collection_name = self._collections.get(collection_id) if collection_id else None

        # Build tags: Raindrop tags + collection name
        tags = list(item.get("tags", []))
        if collection_name and collection_name not in tags:
            tags.append(collection_name)

        # Parse timestamps
        created_at = None
        if item.get("created"):
            try:
                created_at = datetime.fromisoformat(
                    item["created"].replace("Z", "+00:00")
                )
            except (ValueError, TypeError):
                pass

        saved_at = None
        if item.get("lastUpdate"):
            try:
                saved_at = datetime.fromisoformat(
                    item["lastUpdate"].replace("Z", "+00:00")
                )
            except (ValueError, TypeError):
                pass

        # Build metadata
        metadata = {
            "type": item.get("type"),  # link, article, image, video, document, audio
            "domain": item.get("domain"),
            "collection_id": collection_id,
            "collection_name": collection_name,
            "is_favorite": item.get("important", False),
            "broken": item.get("broken", False),
        }

        return {
            "source": self.SOURCE_NAME,
            "source_id": str(item["_id"]),
            "url": item.get("link"),
            "title": (item.get("title") or "Untitled")[:1000],
            "description": (item.get("excerpt") or "")[:5000] or None,
            "content_text": item.get("note"),
            "author": None,  # Raindrop doesn't track author
            "thumbnail_url": item.get("cover"),
            "created_at": created_at or datetime.utcnow(),
            "saved_at": saved_at or datetime.utcnow(),
            "tags": tags,
            "source_metadata": metadata,
        }

    async def _fetch_items(self, force: bool = False) -> list[dict[str, Any]]:
        """Fetch all bookmarks from Raindrop.io.

        Args:
            force: If True, fetch all items. Currently unused as we always
                   fetch all (no incremental sync for Raindrop yet).

        Returns:
            List of item data dictionaries.
        """
        # Fetch collections first for tag mapping
        self._collections = await self._fetch_collections()

        items: list[dict[str, Any]] = []
        page = 0

        try:
            async with httpx.AsyncClient() as client:
                while True:
                    # Rate limiting
                    await self._rate_limit()

                    # Fetch page with retry logic for transient errors
                    response = None
                    for attempt in range(self.MAX_RETRIES):
                        try:
                            response = await client.get(
                                f"{self.API_BASE}/raindrops/0",
                                headers=self._get_headers(),
                                params={
                                    "page": page,
                                    "perpage": self.MAX_PER_PAGE,
                                    "sort": "-created",  # Newest first
                                },
                                timeout=30.0,
                            )

                            # Retry on transient errors (502, 503, 504)
                            if response.status_code in (502, 503, 504):
                                wait_time = (attempt + 1) * 5  # 5s, 10s, 15s
                                logger.warning(
                                    f"API returned {response.status_code}, "
                                    f"retrying in {wait_time}s (attempt {attempt + 1}/{self.MAX_RETRIES})"
                                )
                                await asyncio.sleep(wait_time)
                                continue

                            break  # Success or non-retryable error

                        except httpx.TimeoutException:
                            if attempt < self.MAX_RETRIES - 1:
                                logger.warning(f"Timeout, retrying (attempt {attempt + 1})")
                                await asyncio.sleep(5)
                                continue
                            raise

                    if response is None or response.status_code != 200:
                        status = response.status_code if response else "no response"
                        raise RuntimeError(
                            f"API error {status} after {self.MAX_RETRIES} retries"
                        )

                    data = response.json()
                    page_items = data.get("items", [])

                    if not page_items:
                        break

                    # Parse each raindrop
                    for raindrop in page_items:
                        try:
                            item_data = self._parse_raindrop(raindrop)
                            items.append(item_data)
                        except Exception as e:
                            raindrop_id = raindrop.get("_id", "unknown")
                            await self._add_error(
                                f"Failed to parse raindrop {raindrop_id}: {e}"
                            )

                    logger.info(
                        f"Fetched page {page + 1}: {len(page_items)} raindrops "
                        f"(total: {len(items)})"
                    )

                    # Check if we've reached the end
                    if len(page_items) < self.MAX_PER_PAGE:
                        break

                    page += 1

            logger.info(f"Retrieved {len(items)} total raindrops from Raindrop.io")
            return items

        except httpx.TimeoutException:
            raise RuntimeError("Raindrop API timeout")
        except Exception as e:
            raise RuntimeError(f"Failed to fetch Raindrop items: {e}")


async def sync_raindrop(force: bool = False) -> dict[str, Any]:
    """Convenience function to run Raindrop sync.

    Args:
        force: Force full sync.

    Returns:
        Sync result dictionary.
    """
    worker = RaindropSyncWorker()
    return await worker.sync(force)
