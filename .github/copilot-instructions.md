# Copilot instructions (Cora Novel App)

## UI Terminology (Critical - Read First!)
**Always use official terminology from [docs/UI_NOMENCLATURE.md](../docs/UI_NOMENCLATURE.md):**
- **"Part"** (NOT "Doc Group" or "Folder") - Top-level novel sections (database: `doc_groups`)
- **"Chapter"** (NOT "Doc" or "Document") - Individual writing units (database: `docs`)
- **"Planning Dock"** - Top panel with two modes: Storyline View and Notes View
- **"Storyline View"** (in Planning Dock) - Overview of chapters with metadata
- **"Notes View"** (in Planning Dock) - Folder-level planning notes
- **"Chapter Drafts"** - Alternative versions in split-pane (database: `drafts`)
- **"Document Navigator"** - Left sidebar tree (NOT just "Tree")
- **"Metadata Sidebar"** - Right panel with Characters/Events/Places tabs
- **See full nomenclature document for complete definitions and UI element names.**

## Big picture
- Desktop app: **Tauri v2 (Rust) + Angular 20 (standalone components)**.
- Frontend: [src/](../src/) • Backend: [src-tauri/](../src-tauri/).
- Data: local **SQLite** in OS app-data dir; pool + migrations in [src-tauri/src/db.rs](../src-tauri/src/db.rs).
- Backend API: many `#[tauri::command]` fns in [src-tauri/src/commands.rs](../src-tauri/src/commands.rs), registered in [src-tauri/src/lib.rs](../src-tauri/src/lib.rs).
- Frontend↔backend calls: `invoke()` wrappers in [src/app/services/project.service.ts](../src/app/services/project.service.ts) and [src/app/services/timeline.service.ts](../src/app/services/timeline.service.ts).

## Entry points
- Angular bootstrap + DI: [src/main.ts](../src/main.ts), [src/app/app.config.ts](../src/app/app.config.ts)
- Routes: [src/app/app.routes.ts](../src/app/app.routes.ts) (dashboard + `project/:id`)
- Main workbench view: [src/app/views/project-view/project-view.component.ts](../src/app/views/project-view/project-view.component.ts)

## Frontend ↔ backend conventions
- Command mapping: TS `invoke("name", { ... })` ↔ Rust `#[tauri::command] fn name(...)`.
- **Mixed argument casing** is real; match the TS wrappers:
  - Some commands expect `{ payload: ... }` (e.g. `project_create`, `timeline_create`).
  - Some commands use camelCase args on the JS side even if Rust params are snake_case (e.g. `projectId`, `docGroupId`, `afterSortOrder`).
- Normalize optionals to `null` in invoke payloads (example: `createProject()` in [src/app/services/project.service.ts](../src/app/services/project.service.ts)).
- Keep shared models in sync: TS [src/app/shared/models.ts](../src/app/shared/models.ts) ↔ Rust [src-tauri/src/models.rs](../src-tauri/src/models.rs).

## Backend structure (Rust)
- Commands delegate to modules in [src-tauri/src/services/](../src-tauri/src/services/) (SQL via `rusqlite` + pooled connections).
- Schema changes live in [src-tauri/migrations/](../src-tauri/migrations/) and are applied (sometimes conditionally) in [src-tauri/src/db.rs](../src-tauri/src/db.rs).

## State management patterns
- **LocalStorage for UI state**: Selection, tree expansion, draft selection, panel visibility, layout widths.
  - Keys pattern: `cora-*` (global), `project_{id}_*` (per-project).
  - Example: `project_${projectId}_selection`, `cora-layout`, `cora-draft-${draftId}`.
- **Auto-save pattern**: 2-second debounce for doc text/notes; 500ms for drafts.
  - Cache writes to localStorage immediately; backend saves after debounce.
- **Change detection for sync**: Every backend mutation calls `mark_project_changed()` to track DB changes for auto-sync.

## Sync architecture (file ↔ DB)
- `.cora` files are ZIP archives containing `metadata.json` + exported project structure.
- [src-tauri/src/services/sync.rs](../src-tauri/src/services/sync.rs): handles bidirectional sync with:
  - **Throttling** (5s default) to prevent excessive syncs.
  - **Conflict resolution** via timestamp comparison (auto-resolves to newer version).
  - **Retry logic** with exponential backoff for transient errors.
  - **Permission handling** (macOS sandbox): prompts user to re-grant file access after app restart.
- [src/app/services/sync.service.ts](../src/app/services/sync.service.ts): frontend wrapper with `performSync()` high-level API.
- Auto-sync triggers: enabled by default, checks after every backend mutation via `checkAutoSync()`.

## Dev workflows (macOS)
- Install: `pnpm install`
- Run desktop app: `pnpm tauri:dev` (preferred)
- Run web-only: `pnpm start`
- Unit tests: `pnpm test:unit`; backend focused suite: [run-tests.sh](../run-tests.sh)
- E2E: `pnpm test:e2e` (requires `pnpm start`)
- Builds: [build-current.sh](../build-current.sh) (`pnpm build:current`), [build-release.sh](../build-release.sh) (`pnpm build:release`)

## When adding backend features
- If you change API shape: update Rust command + service + TS service wrapper + shared models; add a migration if the DB schema changes.
- Add `mark_project_changed(pool, project_id)` call after mutations to enable auto-sync tracking.
