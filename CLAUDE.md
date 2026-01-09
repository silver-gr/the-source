# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**UnifiedSaved** is a self-hosted "Save For Later" system - a full-stack monorepo designed to aggregate saved content from multiple platforms (YouTube Watch Later, Reddit Saved, Instagram Saved) into a unified, searchable interface.

**Design Philosophy:** ADHD-optimized "Inbox Zero" system with forced processing gates, auto-categorization, and minimal capture friction. Focus is on **using** saved content, not just accumulating it.

## Repository Structure

```
/
├── frontend/       # React + TypeScript + Vite (port 3000)
├── backend/        # FastAPI + Python (port 8000/8001)
└── data/           # SQLite database (unified.db)
```

## Development Commands

### Backend (FastAPI + Python 3.12+)

**Package manager:** `uv` (not pip)

```bash
cd backend

# Install dependencies
uv sync

# Development server (default port 8000)
uv run uvicorn app.main:app --reload

# Development server on port 8001 (for frontend compatibility)
uv run uvicorn app.main:app --reload --port 8001

# Run tests
uv run pytest

# Format code
uv run ruff format .

# Lint code
uv run ruff check .
```

### Frontend (React + TypeScript + Vite)

**Package manager:** `bun` (not npm/yarn/pnpm)

```bash
cd frontend

# Install dependencies
bun install

# Development server (port 3000)
bun run dev

# Production build
bun run build

# Preview production build
bun run preview

# Lint
bun run lint
```

### Running Both Services

Start backend first, then frontend:
```bash
# Terminal 1: Backend
cd backend && uv run uvicorn app.main:app --reload --port 8001

# Terminal 2: Frontend
cd frontend && bun run dev
```

**Note:** Frontend API client (`src/lib/api-client.ts`) is configured for port 8001. If backend runs on 8000, update the `baseURL` or run backend on 8001.

## Architecture Overview

### Backend Layered Architecture

```
API Endpoints (app/api/v1/)
    ↓
Services (app/services/)
    ↓
Repositories (app/repositories/)
    ↓
Database (SQLite + aiosqlite)
```

**Key Patterns:**
- **Repository Pattern:** All database access goes through repository classes (`ItemRepository`, `SyncRepository`). Never query directly from endpoints.
- **Service Layer:** Business logic lives in services. API routes are thin - they validate, delegate to services, and return responses.
- **Dependency Injection:** Functions accept dependencies as parameters for testability.
- **Async Throughout:** Async SQLite with `aiosqlite`, WAL mode for concurrency.

**Critical Files:**
- `app/main.py` - FastAPI app factory, CORS, lifespan, global exception handler
- `app/config.py` - Pydantic Settings with `UNIFIED_` env prefix
- `app/database.py` - Async SQLite manager, migrations run on startup
- `app/services/sync/base.py` - Abstract `BaseSyncWorker` class for sync workers

### Sync Workers

Located in `app/services/sync/`:
- `base.py` - Abstract base class with sync lifecycle, rate limiting, error handling
- `youtube.py` - Uses `yt-dlp` with browser cookies (Chrome/Firefox)
- `reddit.py` - Uses `praw` with OAuth credentials from system keyring

Sync workers run as FastAPI `BackgroundTasks`. Status tracked in `sync_log` table.

### Frontend Architecture

**Tech Stack:** React 19.2, TanStack Router (file-based), TanStack Query, Tailwind CSS v4

```
src/
├── routes/          # File-based routing (auto-generates routeTree.gen.ts)
├── features/        # Feature-based modules (items/, sync/)
├── components/      # Reusable UI (layout/, shared/, ui/)
├── hooks/           # Custom React hooks
├── lib/
│   ├── api-client.ts      # API client wrapper (items, sync, tags)
│   └── query-client.ts    # TanStack Query config + query keys factory
└── types/           # TypeScript definitions
```

**Key Patterns:**
- **Query Keys Factory:** Type-safe query keys in `query-client.ts` for cache invalidation
- **API Proxy:** Vite dev server proxies `/api` to `http://localhost:8000`
- **Source-Specific Styling:** Each platform (YouTube, Reddit, Instagram) has dedicated color scheme in `index.css`

## Database

**Location:** `data/unified.db` (relative to backend: `../data/unified.db`)

**Key Tables:**
- `items` - Main content storage with FTS5 full-text search (`items_fts` virtual table)
- `sync_log` - Sync operation history

**Migrations:** SQL files in `backend/migrations/*.sql` run automatically on startup via `Database.run_migrations()`

**Full-Text Search:** FTS5 with Porter stemmer, synchronized via triggers.

## Configuration

### Backend Environment Variables

Copy `backend/.env.example` to `backend/.env`:

```bash
# Application
UNIFIED_APP_NAME=UnifiedSaved
UNIFIED_DEBUG=true
UNIFIED_ENVIRONMENT=development
UNIFIED_HOST=0.0.0.0
UNIFIED_PORT=8000  # Frontend expects 8001

# Database
UNIFIED_DATABASE_PATH=../data/unified.db

# Pagination
UNIFIED_DEFAULT_PAGE_SIZE=50
UNIFIED_MAX_PAGE_SIZE=200

# Reddit (optional - stored in keyring for production)
UNIFIED_REDDIT_CLIENT_ID=...
UNIFIED_REDDIT_CLIENT_SECRET=...
UNIFIED_REDDIT_USER_AGENT=UnifiedSaved/0.1.0
```

All settings use `UNIFIED_` prefix, loaded via Pydantic Settings in `app/config.py`.

### Frontend Configuration

**Vite Config (`frontend/vite.config.ts`):**
- Dev server port: 3000
- API proxy: `/api` → `http://localhost:8000`
- Path alias: `@` → `./src`

**API Client (`frontend/src/lib/api-client.ts`):**
- Base URL: `http://localhost:8001/api/v1`
- Custom `ApiError` class for error handling
- Organized by domain: `itemsApi`, `syncApi`, `tagsApi`

## API Endpoints

### Items
- `GET /api/v1/items` - List with filters (page, source, processed, action, search, sort)
- `GET /api/v1/items/{id}` - Get single item
- `POST /api/v1/items` - Create item
- `PATCH /api/v1/items/{id}` - Update item
- `DELETE /api/v1/items/{id}` - Delete item
- `POST /api/v1/items/bulk/processed` - Bulk mark processed
- `GET /api/v1/items/sources` - List unique sources
- `GET /api/v1/items/stats` - Get statistics

### Sync
- `POST /api/v1/sync/{source}` - Trigger sync (youtube, reddit)
- `GET /api/v1/sync/status` - Get sync status for all sources
- `DELETE /api/v1/sync/{source}/credentials` - Clear stored credentials

## Important Notes

1. **Port Configuration:** Frontend API client points to port 8001, backend default is 8000. Either run backend on 8001 or update `src/lib/api-client.ts`.

2. **Credential Storage:** Sensitive credentials (Reddit) stored in system keyring, not environment variables. See `app/core/credentials.py`.

3. **Testing:** Backend uses pytest with `pytest-asyncio` (async mode: auto). Frontend has no test framework currently.

4. **Source Colors:** UI uses distinct colors per source - defined in `frontend/src/index.css` with Tailwind v4 `@theme` directive.

5. **Sync Status Polling:** Frontend polls sync status every 3s when syncing, 5s for items refresh.
