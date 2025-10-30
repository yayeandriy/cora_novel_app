-- Create drafts table for supporting multiple named drafts per document
CREATE TABLE IF NOT EXISTS drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  doc_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(doc_id) REFERENCES docs(id) ON DELETE CASCADE,
  UNIQUE(doc_id, name)
);

-- Index for faster lookups by document
CREATE INDEX IF NOT EXISTS idx_drafts_doc_id ON drafts(doc_id);
CREATE INDEX IF NOT EXISTS idx_drafts_updated_at ON drafts(updated_at DESC);
