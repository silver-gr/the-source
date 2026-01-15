-- Migration: Add spaced repetition fields for story review feature
-- Enables scheduling items for future review with Anki-style intervals

-- Add next review date - NULL means never reviewed, eligible for first review
ALTER TABLE items ADD COLUMN next_review_at TEXT;

-- Track how many times an item has been reviewed
ALTER TABLE items ADD COLUMN review_count INTEGER DEFAULT 0;

-- Track when the item was last reviewed
ALTER TABLE items ADD COLUMN last_reviewed_at TEXT;

-- Index for efficient review queue queries (items due for review)
CREATE INDEX IF NOT EXISTS idx_items_next_review ON items(next_review_at);

-- Composite index for Reddit-specific review queries
CREATE INDEX IF NOT EXISTS idx_items_reddit_review ON items(source, next_review_at);
