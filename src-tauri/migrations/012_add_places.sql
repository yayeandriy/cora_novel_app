-- Migration 012: Add places table and junction tables
-- Places are similar to characters and events, owned by projects
-- and can be associated with docs and doc_groups

CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  desc TEXT,
  FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_places_project ON places(project_id);

-- Junction table for doc-place associations
CREATE TABLE IF NOT EXISTS doc_places (
  doc_id INTEGER NOT NULL,
  place_id INTEGER NOT NULL,
  PRIMARY KEY (doc_id, place_id),
  FOREIGN KEY(doc_id) REFERENCES docs(id) ON DELETE CASCADE,
  FOREIGN KEY(place_id) REFERENCES places(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_doc_places_doc ON doc_places(doc_id);
CREATE INDEX IF NOT EXISTS idx_doc_places_place ON doc_places(place_id);

-- Junction table for doc_group-place associations
CREATE TABLE IF NOT EXISTS doc_group_places (
  doc_group_id INTEGER NOT NULL,
  place_id INTEGER NOT NULL,
  PRIMARY KEY (doc_group_id, place_id),
  FOREIGN KEY(doc_group_id) REFERENCES doc_groups(id) ON DELETE CASCADE,
  FOREIGN KEY(place_id) REFERENCES places(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_doc_group_places_group ON doc_group_places(doc_group_id);
CREATE INDEX IF NOT EXISTS idx_doc_group_places_place ON doc_group_places(place_id);
