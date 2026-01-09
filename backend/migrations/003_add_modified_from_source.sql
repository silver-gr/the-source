-- Migration: Add modified_from_source field to items table
-- This field tracks whether an item's title/content was automatically
-- updated from fetching the actual page content (vs the original source data)

ALTER TABLE items ADD COLUMN modified_from_source BOOLEAN DEFAULT FALSE;

-- Create index for querying items that were auto-modified
CREATE INDEX idx_items_modified_from_source ON items(modified_from_source) WHERE modified_from_source = TRUE;
