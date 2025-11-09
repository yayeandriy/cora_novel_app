# Migration 008: Project Notes

Adds a nullable `notes` TEXT column to the `projects` table to store project-level notes.

## Summary
- New column: `projects.notes TEXT NULL`
- Rust model updates: `Project` and `ProjectCreate` now include `notes: Option<String>`.
- Frontend TypeScript interfaces updated to include `notes?: string | null`.
- `project_create` and `project_update` commands accept/return `notes`.
- Export/import metadata (`metadata.json`) now round-trips project notes.

## Deployment
The migration runs automatically at startup. It checks for the presence of the `notes` column using `PRAGMA table_info(projects)` and applies `ALTER TABLE` if missing.

No manual action required for existing users.

## Backward Compatibility
- Existing databases without the column will have it added automatically.
- Inserts that omit the `notes` column continue to work (SQLite supplies NULL).
- Older exported project metadata without `notes` will import with `notes = NULL`.

## Verification Steps
1. Launch the app (development build).
2. Create a new project with notes (temporarily adjust UI or use backend invocation).
3. Confirm `notes` populated via a direct query:
   ```sql
   SELECT id, name, notes FROM projects;
   ```
4. Export project; `metadata.json` includes the notes field inside `project` object.
5. Import exported folder; new project retains notes.

## Follow-up Tasks (Not in this migration)
- Add UI field for editing project notes in `project-view` component.
- Add E2E test covering project notes create/update.
- Consider full-text search indexing if notes become large.

