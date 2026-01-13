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
