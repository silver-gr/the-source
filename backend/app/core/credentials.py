"""Credential manager for secure storage of API keys and secrets."""

import logging
import subprocess
import sys
from dataclasses import dataclass

import keyring

logger = logging.getLogger(__name__)

# Service name prefix for keyring storage
KEYRING_SERVICE = "unified-saved"


@dataclass
class RedditCredentials:
    """Reddit API credentials."""

    client_id: str
    client_secret: str
    username: str
    password: str


class CredentialManager:
    """Manager for secure credential storage using system keyring."""

    def __init__(self, service: str = KEYRING_SERVICE) -> None:
        """Initialize credential manager.

        Args:
            service: Keyring service name prefix.
        """
        self._service = service

    def _get_key(self, source: str, key: str) -> str:
        """Build keyring key from source and key name.

        Args:
            source: Source platform name.
            key: Credential key name.

        Returns:
            Full keyring key.
        """
        return f"{self._service}:{source}:{key}"

    def _get(self, source: str, key: str) -> str | None:
        """Get a credential from keyring.

        Args:
            source: Source platform name.
            key: Credential key name.

        Returns:
            Credential value or None.
        """
        try:
            return keyring.get_password(self._service, self._get_key(source, key))
        except Exception as e:
            logger.warning(f"Failed to get credential {source}:{key}: {e}")
            return None

    def _set(self, source: str, key: str, value: str) -> bool:
        """Store a credential in keyring.

        Args:
            source: Source platform name.
            key: Credential key name.
            value: Credential value.

        Returns:
            True if successful.
        """
        try:
            keyring.set_password(self._service, self._get_key(source, key), value)
            return True
        except Exception as e:
            logger.error(f"Failed to set credential {source}:{key}: {e}")
            return False

    def _delete(self, source: str, key: str) -> bool:
        """Delete a credential from keyring.

        Args:
            source: Source platform name.
            key: Credential key name.

        Returns:
            True if successful.
        """
        try:
            keyring.delete_password(self._service, self._get_key(source, key))
            return True
        except keyring.errors.PasswordDeleteError:
            # Password doesn't exist
            return True
        except Exception as e:
            logger.error(f"Failed to delete credential {source}:{key}: {e}")
            return False

    # Reddit credentials

    def get_reddit_credentials(self) -> RedditCredentials | None:
        """Get Reddit API credentials from keyring.

        Returns:
            RedditCredentials if all required credentials exist, None otherwise.
        """
        client_id = self._get("reddit", "client_id")
        client_secret = self._get("reddit", "client_secret")
        username = self._get("reddit", "username")
        password = self._get("reddit", "password")

        if not all([client_id, client_secret, username, password]):
            return None

        return RedditCredentials(
            client_id=client_id,  # type: ignore
            client_secret=client_secret,  # type: ignore
            username=username,  # type: ignore
            password=password,  # type: ignore
        )

    def set_reddit_credentials(
        self,
        client_id: str,
        client_secret: str,
        username: str,
        password: str,
    ) -> bool:
        """Store Reddit API credentials in keyring.

        Args:
            client_id: Reddit OAuth client ID.
            client_secret: Reddit OAuth client secret.
            username: Reddit username.
            password: Reddit password.

        Returns:
            True if all credentials were stored successfully.
        """
        success = all([
            self._set("reddit", "client_id", client_id),
            self._set("reddit", "client_secret", client_secret),
            self._set("reddit", "username", username),
            self._set("reddit", "password", password),
        ])

        if success:
            logger.info("Reddit credentials stored successfully")
        else:
            logger.error("Failed to store some Reddit credentials")

        return success

    def delete_reddit_credentials(self) -> bool:
        """Delete all Reddit credentials from keyring.

        Returns:
            True if successful.
        """
        success = all([
            self._delete("reddit", "client_id"),
            self._delete("reddit", "client_secret"),
            self._delete("reddit", "username"),
            self._delete("reddit", "password"),
        ])

        if success:
            logger.info("Reddit credentials deleted")

        return success

    def has_reddit_credentials(self) -> bool:
        """Check if Reddit credentials are configured.

        Returns:
            True if all required credentials exist.
        """
        return self.get_reddit_credentials() is not None

    # YouTube credentials (cookie-based)

    def validate_youtube_cookies(self, browser: str = "chrome") -> tuple[bool, str]:
        """Validate that YouTube cookies are accessible via browser.

        YouTube sync uses yt-dlp with browser cookies, so we just need to verify
        that the browser cookies are accessible.

        Args:
            browser: Browser to check for cookies (chrome, firefox, safari, etc.)

        Returns:
            Tuple of (is_valid, message).
        """
        try:
            # Test if yt-dlp can access browser cookies by extracting a simple URL
            result = subprocess.run(
                [
                    sys.executable, "-m", "yt_dlp",
                    "--cookies-from-browser", browser,
                    "--skip-download",
                    "--quiet",
                    "--no-warnings",
                    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",  # Test video
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                return True, f"YouTube cookies accessible via {browser}"
            else:
                error = result.stderr.strip() if result.stderr else "Unknown error"
                return False, f"Cannot access {browser} cookies: {error}"

        except subprocess.TimeoutExpired:
            return False, "Cookie validation timed out"
        except FileNotFoundError:
            return False, "yt-dlp not found. Install with: uv add yt-dlp"
        except Exception as e:
            return False, f"Cookie validation failed: {e}"

    def get_youtube_browser(self) -> str:
        """Get the configured browser for YouTube cookies.

        Returns:
            Browser name (defaults to 'chrome').
        """
        browser = self._get("youtube", "browser")
        return browser or "chrome"

    def set_youtube_browser(self, browser: str) -> bool:
        """Set the browser to use for YouTube cookies.

        Args:
            browser: Browser name (chrome, firefox, safari, edge, etc.)

        Returns:
            True if successful.
        """
        valid_browsers = ["chrome", "firefox", "safari", "edge", "chromium", "brave", "opera", "vivaldi"]
        if browser.lower() not in valid_browsers:
            logger.warning(f"Unknown browser: {browser}. May not work with yt-dlp.")

        return self._set("youtube", "browser", browser.lower())

    # Raindrop.io credentials (token-based)

    def get_raindrop_token(self) -> str | None:
        """Get Raindrop.io API token from keyring.

        Returns:
            API token or None if not configured.
        """
        return self._get("raindrop", "access_token")

    def set_raindrop_token(self, token: str) -> bool:
        """Store Raindrop.io API token in keyring.

        Args:
            token: Raindrop.io test token or OAuth access token.

        Returns:
            True if successful.
        """
        success = self._set("raindrop", "access_token", token)
        if success:
            logger.info("Raindrop token stored successfully")
        return success

    def delete_raindrop_token(self) -> bool:
        """Delete Raindrop.io token from keyring.

        Returns:
            True if successful.
        """
        success = self._delete("raindrop", "access_token")
        if success:
            logger.info("Raindrop token deleted")
        return success

    def has_raindrop_credentials(self) -> bool:
        """Check if Raindrop.io token is configured.

        Returns:
            True if token exists.
        """
        return self.get_raindrop_token() is not None


# Global credential manager instance
_credential_manager: CredentialManager | None = None


def get_credential_manager() -> CredentialManager:
    """Get the global credential manager instance.

    Returns:
        CredentialManager instance.
    """
    global _credential_manager
    if _credential_manager is None:
        _credential_manager = CredentialManager()
    return _credential_manager
