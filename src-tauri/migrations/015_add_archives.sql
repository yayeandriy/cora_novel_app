-- Migration 015: Add archives table
-- Archives are project-specific entities that can store archived content
-- with creation and archival dates

CREATE TABLE IF NOT EXISTS archives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  desc TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_at TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_archives_project ON archives(project_id);
CREATE INDEX IF NOT EXISTS idx_archives_created ON archives(created_at);
CREATE INDEX IF NOT EXISTS idx_archives_archived ON archives(archived_at);
