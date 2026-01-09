"""Application configuration using Pydantic Settings."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="UNIFIED_",
        case_sensitive=False,
        extra="ignore",
    )

    # Application settings
    app_name: str = "UnifiedSaved"
    app_version: str = "0.1.0"
    debug: bool = False
    environment: Literal["development", "staging", "production"] = "development"

    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000

    # Database settings
    database_path: Path = Field(
        default=Path(__file__).parent.parent.parent / "data" / "unified.db",
        description="Path to SQLite database file",
    )

    # CORS settings
    cors_origins: list[str] = Field(
        default=["http://localhost:3000", "http://localhost:5173", "http://127.0.0.1:3000"],
        description="Allowed CORS origins",
    )
    cors_allow_credentials: bool = True
    cors_allow_methods: list[str] = ["*"]
    cors_allow_headers: list[str] = ["*"]

    # Pagination defaults
    default_page_size: int = 50
    max_page_size: int = 200

    # Reddit API settings (optional, for syncing)
    reddit_client_id: str | None = None
    reddit_client_secret: str | None = None
    reddit_user_agent: str = "UnifiedSaved/0.1.0"

    @property
    def database_url(self) -> str:
        """Get SQLite database URL."""
        return f"sqlite+aiosqlite:///{self.database_path}"

    def ensure_data_directory(self) -> None:
        """Ensure the data directory exists."""
        self.database_path.parent.mkdir(parents=True, exist_ok=True)


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
