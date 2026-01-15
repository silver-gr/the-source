-- Migration 007: Add link_status field to items table
-- For quick filtering of dead/broken links without joining link_checks

-- Add link_status column: ok, broken, unchecked, checking
ALTER TABLE items ADD COLUMN link_status TEXT DEFAULT 'unchecked';

-- Add last_link_check timestamp
ALTER TABLE items ADD COLUMN last_link_check TIMESTAMP;

-- Index for filtering by link status
CREATE INDEX IF NOT EXISTS idx_items_link_status ON items(link_status);
