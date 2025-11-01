-- Create timelines table
CREATE TABLE IF NOT EXISTS timelines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('project', 'doc', 'folder', 'event')),
    entity_id INTEGER NOT NULL,
    start_date TEXT,
    end_date TEXT,
    UNIQUE(entity_type, entity_id)
);

CREATE INDEX idx_timelines_entity ON timelines(entity_type, entity_id);
