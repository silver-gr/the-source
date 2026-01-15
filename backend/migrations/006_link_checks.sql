-- Migration 006: Link health checks table
-- Stores results of broken link detection for items

CREATE TABLE IF NOT EXISTS link_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,                      -- Reference to items.id
    url TEXT NOT NULL,                          -- The URL that was checked

    -- Check results
    status TEXT NOT NULL,                       -- ok, broken, redirect, timeout, dns_error, ssl_error, connection_error, unknown
    http_status INTEGER,                        -- HTTP status code (200, 404, 500, etc.)
    final_url TEXT,                             -- Final URL after redirects (if different)
    redirect_count INTEGER DEFAULT 0,           -- Number of redirects followed

    -- Error details
    error_type TEXT,                            -- Specific error category
    error_message TEXT,                         -- Human-readable error description

    -- Timing
    response_time_ms INTEGER,                   -- Time to first byte in milliseconds
    checked_at TIMESTAMP NOT NULL,              -- When this check was performed

    -- Soft 404 detection
    is_soft_404 BOOLEAN DEFAULT FALSE,          -- Page returns 200 but appears to be error page
    content_length INTEGER,                     -- Response content length

    FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE
);

-- Index for finding broken links
CREATE INDEX IF NOT EXISTS idx_link_checks_status ON link_checks(status);

-- Index for finding latest check per item
CREATE INDEX IF NOT EXISTS idx_link_checks_item_checked ON link_checks(item_id, checked_at DESC);

-- Index for finding old checks that need refresh
CREATE INDEX IF NOT EXISTS idx_link_checks_checked_at ON link_checks(checked_at);

-- View for latest check per item (convenience)
CREATE VIEW IF NOT EXISTS latest_link_checks AS
SELECT lc.*
FROM link_checks lc
INNER JOIN (
    SELECT item_id, MAX(checked_at) as max_checked
    FROM link_checks
    GROUP BY item_id
) latest ON lc.item_id = latest.item_id AND lc.checked_at = latest.max_checked;
