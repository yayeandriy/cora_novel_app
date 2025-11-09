-- Migration 011: Add doc_group_events junction table
-- Allows mapping events to doc groups (folders)
CREATE TABLE IF NOT EXISTS doc_group_events (
  doc_group_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  PRIMARY KEY (doc_group_id, event_id),
  FOREIGN KEY(doc_group_id) REFERENCES doc_groups(id) ON DELETE CASCADE,
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_doc_group_events_group ON doc_group_events(doc_group_id);
CREATE INDEX IF NOT EXISTS idx_doc_group_events_event ON doc_group_events(event_id);
