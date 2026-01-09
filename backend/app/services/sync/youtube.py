"""YouTube sync worker using yt-dlp to fetch Watch Later playlist."""

import asyncio
import json
import logging
import sys
from datetime import datetime
from typing import Any

from app.core.credentials import get_credential_manager
from app.services.sync.base import BaseSyncWorker

logger = logging.getLogger(__name__)


class YouTubeSyncWorker(BaseSyncWorker):
    """Sync worker for YouTube Watch Later playlist."""

    SOURCE_NAME = "youtube"
    RATE_LIMIT_DELAY = 2.0  # 2 seconds between videos (if needed)
    WATCH_LATER_URL = "https://www.youtube.com/playlist?list=WL"

    def __init__(self) -> None:
        """Initialize YouTube sync worker."""
        super().__init__()
        self._credential_manager = get_credential_manager()

    async def validate_credentials(self) -> tuple[bool, str]:
        """Validate YouTube cookie access.

        Returns:
            Tuple of (is_valid, message).
        """
        browser = self._credential_manager.get_youtube_browser()
        return self._credential_manager.validate_youtube_cookies(browser)

    def _parse_duration(self, duration: int | None) -> str | None:
        """Parse duration in seconds to human-readable format.

        Args:
            duration: Duration in seconds.

        Returns:
            Formatted duration string (e.g., "10:30" or "1:05:30").
        """
        if duration is None:
            return None

        hours = duration // 3600
        minutes = (duration % 3600) // 60
        seconds = duration % 60

        if hours > 0:
            return f"{hours}:{minutes:02d}:{seconds:02d}"
        else:
            return f"{minutes}:{seconds:02d}"

    def _parse_video_data(self, video_json: dict[str, Any]) -> dict[str, Any]:
        """Parse yt-dlp JSON output into item data.

        Args:
            video_json: Raw video data from yt-dlp.

        Returns:
            Item data dictionary.
        """
        video_id = video_json.get("id", "")
        title = video_json.get("title", "Unknown Title")
        channel = video_json.get("channel") or video_json.get("uploader", "")
        description = video_json.get("description", "")
        duration = video_json.get("duration")
        upload_date = video_json.get("upload_date")  # Format: YYYYMMDD
        view_count = video_json.get("view_count")
        like_count = video_json.get("like_count")
        thumbnail = video_json.get("thumbnail")

        # Get best thumbnail
        thumbnails = video_json.get("thumbnails", [])
        if thumbnails and not thumbnail:
            # Get highest resolution thumbnail
            sorted_thumbs = sorted(
                thumbnails,
                key=lambda t: (t.get("height", 0) or 0) * (t.get("width", 0) or 0),
                reverse=True,
            )
            if sorted_thumbs:
                thumbnail = sorted_thumbs[0].get("url")

        # Parse upload date - try multiple formats
        created_at = None
        if upload_date:
            # Try YYYYMMDD format first (most common)
            if len(upload_date) == 8:
                try:
                    created_at = datetime.strptime(upload_date, "%Y%m%d")
                except ValueError:
                    pass
            # Also try timestamp if present
            elif upload_date.isdigit():
                try:
                    created_at = datetime.fromtimestamp(int(upload_date))
                except (ValueError, OSError):
                    pass

        # Also check for release_timestamp which some videos have
        if created_at is None:
            release_ts = video_json.get("release_timestamp")
            if release_ts:
                try:
                    created_at = datetime.fromtimestamp(release_ts)
                except (ValueError, OSError, TypeError):
                    pass

        # Fallback to current time if we still don't have a date
        if created_at is None:
            created_at = datetime.utcnow()

        # Build metadata
        metadata = {
            "video_id": video_id,
            "channel_id": video_json.get("channel_id"),
            "channel_url": video_json.get("channel_url"),
            "duration_seconds": duration,
            "duration_formatted": self._parse_duration(duration),
            "view_count": view_count,
            "like_count": like_count,
            "categories": video_json.get("categories", []),
            "tags": video_json.get("tags", [])[:20],  # Limit tags
            "is_live": video_json.get("is_live", False),
            "was_live": video_json.get("was_live", False),
        }

        return {
            "source": self.SOURCE_NAME,
            "source_id": video_id,
            "url": f"https://www.youtube.com/watch?v={video_id}",
            "title": title[:1000] if title else "Unknown Title",  # Respect field limit
            "description": description[:5000] if description else None,
            "author": channel[:500] if channel else None,
            "thumbnail_url": thumbnail,
            "created_at": created_at,
            "saved_at": datetime.utcnow(),  # We don't know when it was added to WL
            "tags": video_json.get("tags", [])[:10],  # Take first 10 tags
            "source_metadata": metadata,
        }

    async def _run_ytdlp(self) -> list[dict[str, Any]]:
        """Run yt-dlp to fetch Watch Later playlist.

        Returns:
            List of video data dictionaries.
        """
        browser = self._credential_manager.get_youtube_browser()

        # Note: We don't use --flat-playlist because it only returns minimal info
        # (no upload_date, thumbnails, etc). Full extraction is slower but gives us
        # complete metadata including upload dates.
        cmd = [
            sys.executable, "-m", "yt_dlp",
            "--cookies-from-browser", browser,
            "--dump-json",
            "--no-download",  # Don't download videos, just metadata
            "--no-warnings",
            "--ignore-errors",  # Continue on individual video errors
            self.WATCH_LATER_URL,
        ]

        logger.info(f"Running yt-dlp to fetch Watch Later playlist (browser: {browser})")

        # Run yt-dlp in subprocess
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        stdout, stderr = await process.communicate()

        if process.returncode != 0 and not stdout:
            error = stderr.decode() if stderr else "Unknown error"
            raise RuntimeError(f"yt-dlp failed: {error}")

        # Parse JSON lines output
        videos = []
        for line in stdout.decode().strip().split("\n"):
            if not line.strip():
                continue
            try:
                video_data = json.loads(line)
                videos.append(video_data)
            except json.JSONDecodeError as e:
                await self._add_error(f"Failed to parse video JSON: {e}")

        logger.info(f"yt-dlp returned {len(videos)} videos from Watch Later")
        return videos

    async def _fetch_items(self, force: bool = False) -> list[dict[str, Any]]:
        """Fetch videos from YouTube Watch Later playlist.

        Args:
            force: If True, force full sync (unused for YouTube as WL is always full).

        Returns:
            List of item data dictionaries.
        """
        # Fetch playlist
        raw_videos = await self._run_ytdlp()

        # Parse video data
        items = []
        for video in raw_videos:
            try:
                item_data = self._parse_video_data(video)
                items.append(item_data)
            except Exception as e:
                video_id = video.get("id", "unknown")
                await self._add_error(f"Failed to parse video {video_id}: {e}")

        return items


async def sync_youtube(force: bool = False) -> dict[str, Any]:
    """Convenience function to run YouTube sync.

    Args:
        force: Force full sync.

    Returns:
        Sync result dictionary.
    """
    worker = YouTubeSyncWorker()
    return await worker.sync(force)
