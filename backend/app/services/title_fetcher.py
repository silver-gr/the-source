"""Service for fetching page titles from URLs.

This service fetches the actual HTML content from a URL and extracts
the <title> tag to update items with generic titles.
"""

import logging
import re
from typing import Optional

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

# Common generic title patterns for Reddit saved items
GENERIC_TITLE_PATTERNS = [
    r"^Saved item from r/",
    r"^Reddit - ",
    r"^Saved$",
    r"^Untitled$",
]


async def fetch_title_from_url(url: str, timeout: int = 10) -> Optional[str]:
    """Fetch the title from a URL by parsing the HTML <title> tag.

    Args:
        url: The URL to fetch the title from
        timeout: Request timeout in seconds (default: 10)

    Returns:
        The extracted title string, or None if fetching/parsing failed
    """
    if not url:
        logger.debug("No URL provided, cannot fetch title")
        return None

    try:
        async with httpx.AsyncClient(
            follow_redirects=True,
            headers={
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            },
        ) as client:
            logger.info(f"Fetching title from URL: {url}")
            response = await client.get(url, timeout=timeout)
            response.raise_for_status()

            # Parse HTML content
            soup = BeautifulSoup(response.text, "html.parser")
            title_tag = soup.find("title")

            if title_tag and title_tag.string:
                title = title_tag.string.strip()
                logger.info(f"Successfully extracted title: {title[:100]}...")
                return title

            logger.warning(f"No <title> tag found in HTML for URL: {url}")
            return None

    except httpx.HTTPStatusError as e:
        logger.error(f"HTTP error fetching URL {url}: {e.response.status_code}")
        return None
    except httpx.TimeoutException:
        logger.error(f"Timeout fetching URL: {url}")
        return None
    except httpx.RequestError as e:
        logger.error(f"Request error fetching URL {url}: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error fetching title from {url}: {e}")
        return None


def is_generic_title(title: str) -> bool:
    """Check if a title matches generic patterns that should be replaced.

    Args:
        title: The title to check

    Returns:
        True if the title is generic and should be replaced
    """
    if not title or not title.strip():
        return True

    for pattern in GENERIC_TITLE_PATTERNS:
        if re.match(pattern, title, re.IGNORECASE):
            return True

    return False


def clean_title(title: str) -> str:
    """Clean and normalize a fetched title.

    Removes common suffixes like " - Reddit" or " | Some Site"
    and trims whitespace.

    Args:
        title: The raw title to clean

    Returns:
        The cleaned title
    """
    if not title:
        return title

    # Remove common suffixes
    title = re.sub(r"\s*[-|]\s*Reddit\s*$", "", title, flags=re.IGNORECASE)
    title = re.sub(r"\s*[-|]\s*[^-|]+\s*$", "", title)  # Remove last " - SiteName"

    return title.strip()
