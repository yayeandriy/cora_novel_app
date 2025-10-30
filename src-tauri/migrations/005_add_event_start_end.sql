-- Add start_date and end_date columns to events
ALTER TABLE events ADD COLUMN start_date TEXT;
ALTER TABLE events ADD COLUMN end_date TEXT;
