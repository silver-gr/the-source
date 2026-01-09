-- Migration: Add URL to FTS5 search index
-- This allows searching items by their URL

-- Drop existing FTS triggers
DROP TRIGGER IF EXISTS items_fts_insert;
DROP TRIGGER IF EXISTS items_fts_delete;
DROP TRIGGER IF EXISTS items_fts_update;

-- Drop and recreate FTS table with url column
DROP TABLE IF EXISTS items_fts;

CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
    title,
    description,
    content_text,
    author,
    tags,
    url,
    content='items',
    content_rowid='rowid',
    tokenize='porter unicode61'
);

-- Rebuild FTS index from existing items
INSERT INTO items_fts(rowid, title, description, content_text, author, tags, url)
SELECT rowid, title, description, content_text, author, tags, url FROM items;

-- Recreate triggers to keep FTS in sync

-- Insert trigger
CREATE TRIGGER IF NOT EXISTS items_fts_insert AFTER INSERT ON items BEGIN
    INSERT INTO items_fts(rowid, title, description, content_text, author, tags, url)
    VALUES (NEW.rowid, NEW.title, NEW.description, NEW.content_text, NEW.author, NEW.tags, NEW.url);
END;

-- Delete trigger
CREATE TRIGGER IF NOT EXISTS items_fts_delete AFTER DELETE ON items BEGIN
    INSERT INTO items_fts(items_fts, rowid, title, description, content_text, author, tags, url)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.description, OLD.content_text, OLD.author, OLD.tags, OLD.url);
END;

-- Update trigger
CREATE TRIGGER IF NOT EXISTS items_fts_update AFTER UPDATE ON items BEGIN
    INSERT INTO items_fts(items_fts, rowid, title, description, content_text, author, tags, url)
    VALUES ('delete', OLD.rowid, OLD.title, OLD.description, OLD.content_text, OLD.author, OLD.tags, OLD.url);
    INSERT INTO items_fts(rowid, title, description, content_text, author, tags, url)
    VALUES (NEW.rowid, NEW.title, NEW.description, NEW.content_text, NEW.author, NEW.tags, NEW.url);
END;
