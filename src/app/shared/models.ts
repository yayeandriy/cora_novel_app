export interface ProjectCreate {
  name: string;
  desc?: string | null;
  path?: string | null;
}

export interface Project {
  id: number;
  name: string;
  desc?: string | null;
  path?: string | null;
  timeline_start?: string | null;
  timeline_end?: string | null;
}

export interface Character {
  id: number;
  project_id: number;
  name: string;
  desc?: string | null;
}

export interface Event {
  id: number;
  project_id: number;
  name: string;
  desc?: string | null;
  date?: string | null;
}

export interface Doc {
  id: number;
  project_id: number;
  path: string;
  name?: string | null;
  timeline_id?: number | null;
  text?: string | null;
}

// Form DTOs used by UI forms. These are intentionally slightly different
// from persisted models (some optional fields become nullable strings,
// and project_id can be undefined while the user chooses a project).
export interface DocForm {
  projectId?: number;
  path: string;
  name?: string | null;
  text?: string | null;
}

export interface CharacterForm {
  projectId?: number;
  name: string;
  desc?: string | null;
}

export interface EventForm {
  projectId?: number;
  name: string;
  desc?: string | null;
  date?: string | null;
}

export interface Draft {
  id: number;
  doc_id: number;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface DraftCreate {
  name: string;
  content: string;
}

export interface DraftUpdate {
  name?: string | null;
  content?: string | null;
}
