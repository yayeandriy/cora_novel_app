-- Migration 010: Add doc_group_characters junction table
-- Allows mapping characters to doc groups (folders)
CREATE TABLE IF NOT EXISTS doc_group_characters (
  doc_group_id INTEGER NOT NULL,
  character_id INTEGER NOT NULL,
  PRIMARY KEY (doc_group_id, character_id),
  FOREIGN KEY(doc_group_id) REFERENCES doc_groups(id) ON DELETE CASCADE,
  FOREIGN KEY(character_id) REFERENCES characters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_doc_group_characters_group ON doc_group_characters(doc_group_id);
CREATE INDEX IF NOT EXISTS idx_doc_group_characters_char ON doc_group_characters(character_id);
