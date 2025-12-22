# Copilot instructions (Cora Novel App)

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

## Dev workflows (macOS)
- Install: `pnpm install`
- Run desktop app: `pnpm tauri:dev` (preferred)
- Run web-only: `pnpm start`
- Unit tests: `pnpm test:unit`; backend focused suite: [run-tests.sh](../run-tests.sh)
- E2E: `pnpm test:e2e` (requires `pnpm start`)
- Builds: [build-current.sh](../build-current.sh) (`pnpm build:current`), [build-release.sh](../build-release.sh) (`pnpm build:release`)

## When adding backend features
- If you change API shape: update Rust command + service + TS service wrapper + shared models; add a migration if the DB schema changes.
