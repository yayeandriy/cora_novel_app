-- Add created_at and updated_at timestamps to projects table
BEGIN TRANSACTION;

-- Add created_at column (nullable, no default)
ALTER TABLE projects ADD COLUMN created_at TEXT;

-- Add updated_at column (nullable, no default)
ALTER TABLE projects ADD COLUMN updated_at TEXT;

-- Set timestamps for existing projects
UPDATE projects 
SET created_at = datetime('now'),
    updated_at = datetime('now')
WHERE created_at IS NULL;

COMMIT;
