-- UnifiedSaved Initial Schema
-- Migration 001: Create items table with FTS5 full-text search

-- Main items table for storing saved content from various sources
CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,                    -- Source platform: reddit, youtube, twitter, pocket, etc.
    source_id TEXT NOT NULL,                 -- Original ID from the source platform
    url TEXT,                                -- URL to the original content
    title TEXT NOT NULL,                     -- Title or headline
    description TEXT,                        -- Short description or excerpt
    content_text TEXT,                       -- Full text content (if available)
    author TEXT,                             -- Author/creator name
    thumbnail_url TEXT,                      -- Thumbnail or preview image URL
    media_path TEXT,                         -- Local path to downloaded media
    tags TEXT DEFAULT '[]',                  -- JSON array of tags
    source_metadata TEXT,                    -- JSON object with source-specific metadata
    created_at TIMESTAMP,                    -- Original creation timestamp from source
    saved_at TIMESTAMP,                      -- When the user saved it on the source platform
    synced_at TIMESTAMP NOT NULL,            -- When it was synced to UnifiedSaved
    processed BOOLEAN DEFAULT FALSE,         -- Whether content has been fully processed
    action TEXT,                             -- User action: archive, delete, favorite, etc.
    priority INTEGER DEFAULT 5,              -- Priority level 1-10 (5 is default)
    UNIQUE(source, source_id)                -- Prevent duplicate imports
);

-- FTS5 virtual table for full-text search
-- Uses Porter stemmer for better search relevance
CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
    title,
    description,
    content_text,
    author,
    tags,
    content='items',
    content_rowid='rowid',
    tokenize='porter unicode61'
);

-- Triggers to keep FTS index synchronized with items table

-- Trigger for INSERT operations
CREATE TRIGGER IF NOT EXISTS items_fts_insert AFTER INSERT ON items BEGIN
    INSERT INTO items_fts(rowid, title, description, content_text, author, tags)
    VALUES (NEW.rowid, NEW.title, NEW.description, NEW.content_text, NEW.author, NEW.tags);
END;

-- Trigger for DELETE operations
CREATE TRIGGER IF NOT EXISTS items_fts_delete AFTER DELETE ON items BEGIN
    INSERT INTO items_fts(items_fts, rowid, title, description, content_text, author, tags)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.description, OLD.content_text, OLD.author, OLD.tags);
END;

-- Trigger for UPDATE operations
CREATE TRIGGER IF NOT EXISTS items_fts_update AFTER UPDATE ON items BEGIN
    INSERT INTO items_fts(items_fts, rowid, title, description, content_text, author, tags)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.description, OLD.content_text, OLD.author, OLD.tags);
    INSERT INTO items_fts(rowid, title, description, content_text, author, tags)
    VALUES (NEW.rowid, NEW.title, NEW.description, NEW.content_text, NEW.author, NEW.tags);
END;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_items_source ON items(source);
CREATE INDEX IF NOT EXISTS idx_items_synced_at ON items(synced_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_saved_at ON items(saved_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_processed ON items(processed);
CREATE INDEX IF NOT EXISTS idx_items_action ON items(action);
CREATE INDEX IF NOT EXISTS idx_items_priority ON items(priority DESC);
CREATE INDEX IF NOT EXISTS idx_items_source_source_id ON items(source, source_id);
