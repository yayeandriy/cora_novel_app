# Copilot instructions (Cora Novel App)

## UI terminology (critical)
Use official names from docs/UI_NOMENCLATURE.md: **Part**, **Chapter**, **Planning Dock** (Storyline View/Notes View), **Chapter Drafts**, **Document Navigator**, **Metadata Sidebar**. Avoid “doc group/doc/document/folder”.

## Big picture (Tauri + Angular)
- Desktop app: Tauri v2 (Rust) + Angular 20 standalone components.
- Frontend entry: src/main.ts, src/app/app.config.ts, routes in src/app/app.routes.ts.
- Main workbench: src/app/views/project-view/project-view.component.ts.
- Backend: SQLite + migrations in src-tauri/migrations/, pool in src-tauri/src/db.rs.
- Commands: src-tauri/src/commands.rs, registered in src-tauri/src/lib.rs.
- TS ↔ Rust calls go through invoke() wrappers in src/app/services/project.service.ts and src/app/services/timeline.service.ts.

## Frontend ↔ backend conventions
- Match argument casing in TS wrappers (some payloads are { payload }, some are camelCase like projectId/docGroupId/afterSortOrder).
- Normalize optional values to null in invoke payloads (see createProject()).
- Keep models in sync: src/app/shared/models.ts ↔ src-tauri/src/models.rs.

## State + autosave patterns
- UI state in localStorage: cora-* global, project_{id}_* per project (selection, layout, draft selections).
- Autosave: 2s debounce for Chapter text/notes; 500ms for drafts; cache to localStorage immediately.
- After any backend mutation, call mark_project_changed(pool, project_id) so auto-sync can trigger.

## Sync architecture
- .cora is a ZIP with metadata.json; sync logic in src-tauri/src/services/sync.rs.
- Auto-sync checks are triggered in ProjectView via checkAutoSync().
- macOS permission re-grant flows exist; don’t break file access prompts.

## Dev workflows (macOS)
- Install: pnpm install
- Run desktop: pnpm tauri:dev (preferred)
- Run web-only: pnpm start
- Unit tests: pnpm test:unit; backend tests: run-tests.sh
- E2E: pnpm test:e2e (requires pnpm start)
- Builds: build-current.sh (pnpm build:current), build-release.sh (pnpm build:release)

## When adding backend features
- If API shape changes: update Rust command + service module + TS service wrapper + shared models; add migrations if schema changes.
- Prefer service modules in src-tauri/src/services/ for SQL; commands should stay thin.
