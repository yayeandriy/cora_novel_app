Shared frontend models

This folder exports TypeScript interfaces used across components and services.

Files:
- `models.ts` — ProjectCreate, Project, Doc, Character, Event, and also form DTOs DocForm, CharacterForm, EventForm.

Usage:
import type { Project, ProjectCreate } from './shared/models';

Keep these types in sync with the backend `src-tauri/src/models.rs` serde structs where appropriate.
