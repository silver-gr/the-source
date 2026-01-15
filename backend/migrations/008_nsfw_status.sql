-- Migration: Add NSFW/explicit content status to items table
-- Similar pattern to link_status for content filtering

-- Add nsfw_status column to track content classification
-- Values: 'unknown', 'safe', 'nsfw', 'explicit'
ALTER TABLE items ADD COLUMN nsfw_status TEXT DEFAULT 'unknown';

-- Add last check timestamp
ALTER TABLE items ADD COLUMN last_nsfw_check TIMESTAMP;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_items_nsfw_status ON items(nsfw_status);

-- Create table to store NSFW detection details
CREATE TABLE IF NOT EXISTS nsfw_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    url TEXT NOT NULL,
    status TEXT NOT NULL,  -- safe, nsfw, explicit
    detection_method TEXT NOT NULL,  -- domain, subreddit, keyword, manual
    matched_pattern TEXT,  -- The pattern that triggered detection
    confidence REAL DEFAULT 1.0,  -- 0.0 to 1.0 confidence score
    checked_at TIMESTAMP NOT NULL,
    notes TEXT,
    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Index for item lookups
CREATE INDEX IF NOT EXISTS idx_nsfw_checks_item_id ON nsfw_checks(item_id);
CREATE INDEX IF NOT EXISTS idx_nsfw_checks_status ON nsfw_checks(status);
