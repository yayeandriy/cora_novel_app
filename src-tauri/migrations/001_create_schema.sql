-- Initial schema for Cora novel app
BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  desc TEXT,
  path TEXT,
  timeline_start TEXT,
  timeline_end TEXT
);

CREATE TABLE IF NOT EXISTS timelines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  start_date TEXT,
  end_date TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  timeline_id INTEGER,
  name TEXT,
  desc TEXT,
  date TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY(timeline_id) REFERENCES timelines(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS characters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT,
  desc TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS docs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  path TEXT NOT NULL,
  name TEXT,
  timeline_id INTEGER,
  text TEXT,
  doc_group_id INTEGER REFERENCES doc_groups(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY(timeline_id) REFERENCES timelines(id)
);

CREATE TABLE IF NOT EXISTS doc_characters (
  doc_id INTEGER NOT NULL,
  character_id INTEGER NOT NULL,
  PRIMARY KEY (doc_id, character_id),
  FOREIGN KEY(doc_id) REFERENCES docs(id) ON DELETE CASCADE,
  FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS doc_events (
  doc_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  PRIMARY KEY (doc_id, event_id),
  FOREIGN KEY(doc_id) REFERENCES docs(id) ON DELETE CASCADE,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS doc_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  name TEXT,
  parent_id INTEGER REFERENCES doc_groups(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  timeline_id INTEGER,
  desc TEXT
);

CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id INTEGER NOT NULL,
  text TEXT,
  created_at TEXT,
  FOREIGN KEY(doc_id) REFERENCES docs(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_type TEXT,
  parent_id INTEGER,
  text TEXT
);

CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_docs_project ON docs(project_id);
CREATE INDEX IF NOT EXISTS idx_characters_project ON characters(project_id);
CREATE INDEX IF NOT EXISTS idx_doc_groups_project_order ON doc_groups(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_doc_groups_parent ON doc_groups(parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_docs_group_order ON docs(doc_group_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_docs_project_order ON docs(project_id, sort_order);

COMMIT;
