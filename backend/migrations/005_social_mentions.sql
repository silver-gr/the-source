-- Migration: Add social_mentions table for HN/Reddit discussion tracking
-- This table stores cached results from social platform API lookups

CREATE TABLE IF NOT EXISTS social_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    platform TEXT NOT NULL CHECK (platform IN ('hackernews', 'reddit')),
    external_id TEXT NOT NULL,

    -- Common fields
    url TEXT NOT NULL,
    title TEXT,
    score INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    posted_at TEXT,
    top_comment TEXT,

    -- Platform-specific (nullable)
    subreddit TEXT,
    author TEXT,

    -- Metadata
    checked_at TEXT NOT NULL DEFAULT (datetime('now')),
    raw_data TEXT,

    UNIQUE(item_id, platform, external_id)
);

-- Index for fast lookups by item
CREATE INDEX IF NOT EXISTS idx_social_mentions_item_id ON social_mentions(item_id);

-- Index for filtering by platform
CREATE INDEX IF NOT EXISTS idx_social_mentions_platform ON social_mentions(platform);

-- Index for checking freshness
CREATE INDEX IF NOT EXISTS idx_social_mentions_checked_at ON social_mentions(checked_at);
