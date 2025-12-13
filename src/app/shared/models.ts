export interface ProjectCreate {
  name: string;
  desc?: string | null;
  path?: string | null;
  notes?: string | null;
  grid_order?: number | null;
}

export interface Project {
  id: number;
  name: string;
  desc?: string | null;
  path?: string | null;
  notes?: string | null;
  timeline_start?: string | null;
  timeline_end?: string | null;
  grid_order?: number | null;
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
  date?: string | null; // legacy
  start_date?: string | null;
  end_date?: string | null;
}

export interface Place {
  id: number;
  project_id: number;
  name: string;
  desc?: string | null;
}

export interface Doc {
  id: number;
  project_id: number;
  path: string;
  name?: string | null;
  timeline_id?: number | null;
  text?: string | null;
  notes?: string | null;
  doc_group_id?: number | null;
  sort_order?: number | null;
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
  start_date?: string | null;
  end_date?: string | null;
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

// Project-level drafts
export interface ProjectDraft {
  id: number;
  project_id: number;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectDraftCreate {
  name: string;
  content: string;
}

export interface ProjectDraftUpdate {
  name?: string | null;
  content?: string | null;
}

// Folder (doc group) drafts
export interface FolderDraft {
  id: number;
  doc_group_id: number;
  name: string;
  content: string;
  created_at: string;
  updated_at: string;
  sort_order?: number;
}

export interface FolderDraftCreate {
  name: string;
  content: string;
}

export interface FolderDraftUpdate {
  name?: string | null;
  content?: string | null;
}

export interface Timeline {
  id: number;
  entity_type: 'project' | 'doc' | 'folder' | 'event';
  entity_id: number;
  start_date?: string | null;
  end_date?: string | null;
}

export interface TimelineCreate {
  entity_type: 'project' | 'doc' | 'folder' | 'event';
  entity_id: number;
  start_date?: string | null;
  end_date?: string | null;
}

export interface TimelineUpdate {
  start_date?: string | null;
  end_date?: string | null;
}

export interface Archive {
  id: number;
  project_id: number;
  name: string;
  desc?: string | null;
  created_at: string;
  archived_at?: string | null;
}

export interface ArchiveCreate {
  name: string;
  desc?: string | null;
  archived_at?: string | null;
}

export interface ArchiveUpdate {
  name?: string | null;
  desc?: string | null;
  archived_at?: string | null;
}
