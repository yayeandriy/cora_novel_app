ALTER TABLE folder_drafts ADD COLUMN sort_order INTEGER DEFAULT 0;
-- Initialize sort_order based on id (creation order)
UPDATE folder_drafts SET sort_order = id;
