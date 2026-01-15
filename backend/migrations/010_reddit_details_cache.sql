-- Migration: Add reddit_details column for caching fetched Reddit post data
-- This stores the full Reddit API response (title, selftext, comments, etc.)
-- so we don't need to re-fetch for archived/processed items

ALTER TABLE items ADD COLUMN reddit_details TEXT;

-- Index for quickly finding items with cached details
CREATE INDEX IF NOT EXISTS idx_items_reddit_details ON items(source, reddit_details) WHERE reddit_details IS NOT NULL;
