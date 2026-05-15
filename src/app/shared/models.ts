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
  created_at?: string | null;
  updated_at?: string | null;
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

// Sync entity for project-file synchronization
export interface Sync {
  id: number;
  project_id: number;
  file_path: string;
  
  // Sync status tracking
  sync_status: 'pending' | 'syncing' | 'synced' | 'conflict' | 'error' | 'paused';
  sync_direction: 'bidirectional' | 'db_to_file' | 'file_to_db';
  
  // Version control for optimistic locking
  sync_version: number;
  db_version: number;
  file_version: number;
  
  // Content hashes for change detection
  db_hash?: string | null;
  file_hash?: string | null;
  
  // Timestamps for sync coordination
  last_sync_at?: string | null;
  last_db_change_at?: string | null;
  last_file_change_at?: string | null;
  
  // Throttling and rate limiting
  throttle_ms: number;
  last_sync_attempt_at?: string | null;
  next_allowed_sync_at?: string | null;
  
  // Retry logic with exponential backoff
  retry_count: number;
  max_retries: number;
  next_retry_at?: string | null;
  base_retry_delay_ms: number;
  
  // Error handling
  last_error?: string | null;
  last_error_at?: string | null;
  consecutive_errors: number;
  
  // Conflict resolution
  conflict_data?: string | null;
  conflict_resolved_at?: string | null;
  conflict_resolution?: string | null;
  
  // Feature flags
  auto_sync_enabled: boolean;
  watch_file_enabled: boolean;
  watch_db_enabled: boolean;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

export interface SyncCreate {
  project_id: number;
  file_path: string;
  sync_direction?: 'bidirectional' | 'db_to_file' | 'file_to_db';
  throttle_ms?: number;
  auto_sync_enabled?: boolean;
}

export interface SyncUpdate {
  file_path?: string | null;
  sync_status?: string | null;
  sync_direction?: string | null;
  sync_version?: number | null;
  db_version?: number | null;
  file_version?: number | null;
  db_hash?: string | null;
  file_hash?: string | null;
  last_sync_at?: string | null;
  last_db_change_at?: string | null;
  last_file_change_at?: string | null;
  throttle_ms?: number | null;
  last_sync_attempt_at?: string | null;
  next_allowed_sync_at?: string | null;
  retry_count?: number | null;
  max_retries?: number | null;
  next_retry_at?: string | null;
  base_retry_delay_ms?: number | null;
  last_error?: string | null;
  last_error_at?: string | null;
  consecutive_errors?: number | null;
  conflict_data?: string | null;
  conflict_resolved_at?: string | null;
  conflict_resolution?: string | null;
  auto_sync_enabled?: boolean | null;
  watch_file_enabled?: boolean | null;
  watch_db_enabled?: boolean | null;
}

// Sync status response with computed fields
export interface SyncStatus {
  sync: Sync;
  can_sync_now: boolean;
  next_sync_in_ms?: number | null;
  has_pending_changes: boolean;
  is_file_newer: boolean;
  is_db_newer: boolean;
}

export interface ExportPdfOptions {
  fontStyle?: 'mono' | 'serif' | 'sans';
  fontSize?: 'small' | 'medium' | 'large';
  lineSpace?: 'small' | 'medium' | 'large';
  chapterMode?: 'all' | 'range';
  rangePartId?: number | null;
  rangeStart?: number | null;
  rangeEnd?: number | null;
}

// ─── iCloud Drive ──────────────────────────────────────────────────────────

export interface ICloudFileStatus {
  /** The path that was checked. */
  path: string;
  /** File is present on local disk. */
  isLocal: boolean;
  /** iCloud has evicted the file; only a `.icloud` placeholder exists. */
  isPlaceholder: boolean;
  /** Neither local file nor placeholder found. */
  notFound: boolean;
}

export interface ICloudDocInfo {
  /** Full filesystem path to the `.cora` file. */
  path: string;
  /** Display name — filename without the `.cora` extension. */
  name: string;
  /** File size in bytes (0 for placeholders). */
  sizeBytes: number;
  /** Last-modified timestamp in RFC 3339. Null for placeholders. */
  modifiedAt: string | null;
  /** File is present on local disk. */
  isLocal: boolean;
  /** Only an iCloud placeholder exists. */
  isPlaceholder: boolean;
}

export interface RecentFile {
  path: string;
  name: string;
  lastOpened: string;
}

export interface OpenProjectInfo {
  path: string;
  projectId: number;
  name: string;
}
