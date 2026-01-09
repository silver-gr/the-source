"""FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import items, sync
from app.config import Settings, get_settings
from app.database import close_database, init_database
from app.services.item_service import reset_item_service

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown events."""
    settings = get_settings()
    logger.info(f"Starting {settings.app_name} v{settings.app_version}")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Debug mode: {settings.debug}")

    # Initialize database on startup
    await init_database(settings)
    logger.info("Database initialized")

    yield

    # Cleanup on shutdown
    reset_item_service()
    await close_database()
    logger.info("Application shutdown complete")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure the FastAPI application.

    Args:
        settings: Optional settings override for testing.

    Returns:
        Configured FastAPI application.
    """
    settings = settings or get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Self-hosted 'Save For Later' system - unified saved content management",
        lifespan=lifespan,
        docs_url="/docs" if settings.debug or settings.environment == "development" else None,
        redoc_url="/redoc" if settings.debug or settings.environment == "development" else None,
        openapi_url="/openapi.json"
        if settings.debug or settings.environment == "development"
        else None,
    )

    # Configure CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=settings.cors_allow_methods,
        allow_headers=settings.cors_allow_headers,
    )

    # Include API routers
    app.include_router(items.router, prefix="/api/v1")
    app.include_router(sync.router, prefix="/api/v1")

    # Health check endpoint
    @app.get("/health", tags=["health"])
    async def health_check() -> dict[str, Any]:
        """Health check endpoint."""
        return {
            "status": "healthy",
            "app": settings.app_name,
            "version": settings.app_version,
            "environment": settings.environment,
        }

    # Root endpoint
    @app.get("/", tags=["root"])
    async def root() -> dict[str, str]:
        """Root endpoint with basic info."""
        return {
            "name": settings.app_name,
            "version": settings.app_version,
            "docs": "/docs",
        }

    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request, exc: Exception) -> JSONResponse:
        """Handle uncaught exceptions."""
        logger.exception(f"Unhandled exception: {exc}")
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Internal server error",
                "type": type(exc).__name__,
            },
        )

    return app


# Create application instance
app = create_app()


if __name__ == "__main__":
    import uvicorn

    settings = get_settings()
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="debug" if settings.debug else "info",
    )
