-- Migration 017: Add sync table for project-file synchronization
-- This table manages bidirectional sync between database projects and .cora files

CREATE TABLE IF NOT EXISTS sync (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL UNIQUE,
    file_path TEXT NOT NULL,
    
    -- Sync status tracking
    sync_status TEXT NOT NULL DEFAULT 'pending',  -- pending, syncing, synced, conflict, error, paused
    sync_direction TEXT NOT NULL DEFAULT 'bidirectional',  -- bidirectional, db_to_file, file_to_db
    
    -- Version control for optimistic locking
    sync_version INTEGER NOT NULL DEFAULT 0,
    db_version INTEGER NOT NULL DEFAULT 0,
    file_version INTEGER NOT NULL DEFAULT 0,
    
    -- Content hashes for change detection
    db_hash TEXT,
    file_hash TEXT,
    
    -- Timestamps for sync coordination
    last_sync_at TEXT,
    last_db_change_at TEXT,
    last_file_change_at TEXT,
    
    -- Throttling and rate limiting
    throttle_ms INTEGER NOT NULL DEFAULT 2000,  -- Minimum ms between syncs
    last_sync_attempt_at TEXT,
    next_allowed_sync_at TEXT,
    
    -- Retry logic with exponential backoff
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 5,
    next_retry_at TEXT,
    base_retry_delay_ms INTEGER NOT NULL DEFAULT 1000,
    
    -- Error handling
    last_error TEXT,
    last_error_at TEXT,
    consecutive_errors INTEGER NOT NULL DEFAULT 0,
    
    -- Conflict resolution
    conflict_data TEXT,  -- JSON blob storing conflict details
    conflict_resolved_at TEXT,
    conflict_resolution TEXT,  -- local_wins, remote_wins, manual, merged
    
    -- Feature flags
    auto_sync_enabled INTEGER NOT NULL DEFAULT 1,
    watch_file_enabled INTEGER NOT NULL DEFAULT 1,
    watch_db_enabled INTEGER NOT NULL DEFAULT 1,
    
    -- Metadata
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_sync_project_id ON sync(project_id);
CREATE INDEX IF NOT EXISTS idx_sync_status ON sync(sync_status);
CREATE INDEX IF NOT EXISTS idx_sync_file_path ON sync(file_path);
CREATE INDEX IF NOT EXISTS idx_sync_next_retry ON sync(next_retry_at);
