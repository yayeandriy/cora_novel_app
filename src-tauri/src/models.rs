use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub desc: Option<String>,
    pub path: Option<String>,
    pub notes: Option<String>,
    pub timeline_start: Option<String>,
    pub timeline_end: Option<String>,
    pub grid_order: Option<i64>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectCreate {
    pub name: String,
    pub desc: Option<String>,
    pub path: Option<String>,
    pub notes: Option<String>,
    pub grid_order: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DocGroup {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub parent_id: Option<i64>,
    pub sort_order: Option<i64>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Doc {
    pub id: i64,
    pub project_id: i64,
    pub path: String,
    pub name: Option<String>,
    pub timeline_id: Option<i64>,
    pub text: Option<String>,
    pub notes: Option<String>,
    pub doc_group_id: Option<i64>,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Character {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub desc: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Event {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub desc: Option<String>,
    // Legacy single date field (kept for backward compatibility)
    pub date: Option<String>,
    // New fields for range
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Place {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub desc: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Draft {
    pub id: i64,
    pub doc_id: i64,
    pub name: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftCreate {
    pub name: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DraftUpdate {
    pub name: Option<String>,
    pub content: Option<String>,
}

// Project-level drafts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDraft {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDraftCreate {
    pub name: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectDraftUpdate {
    pub name: Option<String>,
    pub content: Option<String>,
}

// Folder (doc group) drafts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderDraft {
    pub id: i64,
    pub doc_group_id: i64,
    pub name: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
    pub sort_order: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderDraftCreate {
    pub name: String,
    pub content: String,
    pub insert_at_index: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderDraftUpdate {
    pub name: Option<String>,
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Timeline {
    pub id: i64,
    pub entity_type: String, // 'project', 'doc', 'folder', 'event'
    pub entity_id: i64,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineCreate {
    pub entity_type: String,
    pub entity_id: i64,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineUpdate {
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Archive {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub desc: Option<String>,
    pub created_at: String,
    pub archived_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveCreate {
    pub name: String,
    pub desc: Option<String>,
    pub archived_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArchiveUpdate {
    pub name: Option<String>,
    pub desc: Option<String>,
    pub archived_at: Option<String>,
}

// Sync entity for project-file synchronization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sync {
    pub id: i64,
    pub project_id: i64,
    pub file_path: String,
    
    // Sync status tracking
    pub sync_status: String,  // pending, syncing, synced, conflict, error, paused
    pub sync_direction: String,  // bidirectional, db_to_file, file_to_db
    
    // Version control for optimistic locking
    pub sync_version: i64,
    pub db_version: i64,
    pub file_version: i64,
    
    // Content hashes for change detection
    pub db_hash: Option<String>,
    pub file_hash: Option<String>,
    
    // Timestamps for sync coordination
    pub last_sync_at: Option<String>,
    pub last_db_change_at: Option<String>,
    pub last_file_change_at: Option<String>,
    
    // Throttling and rate limiting
    pub throttle_ms: i64,
    pub last_sync_attempt_at: Option<String>,
    pub next_allowed_sync_at: Option<String>,
    
    // Retry logic with exponential backoff
    pub retry_count: i64,
    pub max_retries: i64,
    pub next_retry_at: Option<String>,
    pub base_retry_delay_ms: i64,
    
    // Error handling
    pub last_error: Option<String>,
    pub last_error_at: Option<String>,
    pub consecutive_errors: i64,
    
    // Conflict resolution
    pub conflict_data: Option<String>,
    pub conflict_resolved_at: Option<String>,
    pub conflict_resolution: Option<String>,
    
    // Feature flags
    pub auto_sync_enabled: bool,
    pub watch_file_enabled: bool,
    pub watch_db_enabled: bool,
    
    // Metadata
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncCreate {
    pub project_id: i64,
    pub file_path: String,
    pub sync_direction: Option<String>,
    pub throttle_ms: Option<i64>,
    pub auto_sync_enabled: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncUpdate {
    pub file_path: Option<String>,
    pub sync_status: Option<String>,
    pub sync_direction: Option<String>,
    pub sync_version: Option<i64>,
    pub db_version: Option<i64>,
    pub file_version: Option<i64>,
    pub db_hash: Option<String>,
    pub file_hash: Option<String>,
    pub last_sync_at: Option<String>,
    pub last_db_change_at: Option<String>,
    pub last_file_change_at: Option<String>,
    pub throttle_ms: Option<i64>,
    pub last_sync_attempt_at: Option<String>,
    pub next_allowed_sync_at: Option<String>,
    pub retry_count: Option<i64>,
    pub max_retries: Option<i64>,
    pub next_retry_at: Option<String>,
    pub base_retry_delay_ms: Option<i64>,
    pub last_error: Option<String>,
    pub last_error_at: Option<String>,
    pub consecutive_errors: Option<i64>,
    pub conflict_data: Option<String>,
    pub conflict_resolved_at: Option<String>,
    pub conflict_resolution: Option<String>,
    pub auto_sync_enabled: Option<bool>,
    pub watch_file_enabled: Option<bool>,
    pub watch_db_enabled: Option<bool>,
}

// Sync status response with computed fields
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncStatus {
    pub sync: Sync,
    pub can_sync_now: bool,
    pub next_sync_in_ms: Option<i64>,
    pub has_pending_changes: bool,
    pub is_file_newer: bool,
    pub is_db_newer: bool,
}

/// Snapshot of a single doc used for undo-of-deletion.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocSnapshot {
    pub name: String,
    pub sort_order: i64,
    pub text: String,
    pub notes: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPdfOptions {
    pub font_style: Option<String>,
    pub font_size: Option<String>,
    pub line_space: Option<String>,
    pub chapter_mode: Option<String>,
    pub range_part_id: Option<i64>,
    pub range_start: Option<i64>,
    pub range_end: Option<i64>,
}
