# UnifiedSaved Backend

Self-hosted "Save For Later" system backend built with FastAPI, SQLite, and async Python.

## Features

- RESTful API for managing saved content from multiple sources
- SQLite database with FTS5 full-text search
- Async/await throughout for optimal performance
- Pydantic v2 for data validation and serialization
- Repository pattern for clean data access
- Comprehensive filtering, pagination, and sorting

## Requirements

- Python 3.12+
- uv (Python package manager)

## Quick Start

1. **Install dependencies:**
   ```bash
   cd backend
   uv sync
   ```

2. **Copy environment configuration:**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

3. **Run the development server:**
   ```bash
   uv run uvicorn app.main:app --reload
   ```

4. **Access the API:**
   - API: http://localhost:8000
   - Docs: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

## Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── items.py      # API endpoints
│   ├── repositories/
│   │   └── item_repo.py      # Data access layer
│   ├── services/
│   │   └── item_service.py   # Business logic
│   ├── schemas/
│   │   └── item.py           # Pydantic models
│   ├── config.py             # Settings management
│   ├── database.py           # Async SQLite connection
│   └── main.py               # FastAPI application
├── migrations/
│   └── 001_initial.sql       # Database schema
├── tests/                    # Test suite
├── pyproject.toml            # Project configuration
└── .env.example              # Example environment config
```

## API Endpoints

### Items

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/items` | List items with filters |
| GET | `/api/v1/items/{id}` | Get single item |
| POST | `/api/v1/items` | Create new item |
| PATCH | `/api/v1/items/{id}` | Update item |
| DELETE | `/api/v1/items/{id}` | Delete item |
| POST | `/api/v1/items/bulk/processed` | Bulk mark processed |
| GET | `/api/v1/items/sources` | List unique sources |
| GET | `/api/v1/items/stats` | Get statistics |

### Query Parameters

- `page`, `page_size` - Pagination
- `source`, `sources` - Filter by source platform
- `processed` - Filter by processed status
- `action` - Filter by action
- `search` - Full-text search
- `sort_by`, `sort_order` - Sorting

## Development

**Run tests:**
```bash
uv run pytest
```

**Run with auto-reload:**
```bash
uv run uvicorn app.main:app --reload --port 8000
```

**Format code:**
```bash
uv run ruff format .
```

**Lint code:**
```bash
uv run ruff check .
```

## Database

SQLite database is stored at `../data/unified.db` (relative to backend directory).

Migrations are run automatically on application startup.

## Configuration

All configuration is done via environment variables with the `UNIFIED_` prefix:

| Variable | Default | Description |
|----------|---------|-------------|
| `UNIFIED_DEBUG` | `false` | Enable debug mode |
| `UNIFIED_ENVIRONMENT` | `development` | Environment name |
| `UNIFIED_HOST` | `0.0.0.0` | Server host |
| `UNIFIED_PORT` | `8000` | Server port |
| `UNIFIED_DATABASE_PATH` | `../data/unified.db` | Database file path |

See `.env.example` for all available options.
