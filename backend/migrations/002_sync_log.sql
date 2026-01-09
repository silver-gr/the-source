-- UnifiedSaved Sync Log Schema
-- Migration 002: Create sync_log table for tracking sync operations

-- Sync log table for tracking sync operations
CREATE TABLE IF NOT EXISTS sync_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source TEXT NOT NULL,                    -- Source platform: youtube, reddit, etc.
    started_at TIMESTAMP NOT NULL,           -- When the sync started
    completed_at TIMESTAMP,                  -- When the sync completed (NULL if still running)
    status TEXT DEFAULT 'running',           -- Status: running, completed, failed
    items_synced INTEGER DEFAULT 0,          -- Number of items synced
    errors TEXT                              -- Error messages (JSON array or text)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sync_log_source ON sync_log(source);
CREATE INDEX IF NOT EXISTS idx_sync_log_status ON sync_log(status);
CREATE INDEX IF NOT EXISTS idx_sync_log_started_at ON sync_log(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_log_source_started ON sync_log(source, started_at DESC);
