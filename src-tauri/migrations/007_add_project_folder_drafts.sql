-- Project-level drafts and Folder (DocGroup) drafts

-- Project drafts
CREATE TABLE IF NOT EXISTS project_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
  UNIQUE(project_id, name)
);
CREATE INDEX IF NOT EXISTS idx_project_drafts_project_id ON project_drafts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_drafts_updated_at ON project_drafts(updated_at DESC);

-- Folder (doc group) drafts
CREATE TABLE IF NOT EXISTS folder_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_group_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(doc_group_id) REFERENCES doc_groups(id) ON DELETE CASCADE,
  UNIQUE(doc_group_id, name)
);
CREATE INDEX IF NOT EXISTS idx_folder_drafts_group_id ON folder_drafts(doc_group_id);
CREATE INDEX IF NOT EXISTS idx_folder_drafts_updated_at ON folder_drafts(updated_at DESC);
