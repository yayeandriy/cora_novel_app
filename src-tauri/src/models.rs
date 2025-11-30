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
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectCreate {
    pub name: String,
    pub desc: Option<String>,
    pub path: Option<String>,
    pub notes: Option<String>,
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
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FolderDraftCreate {
    pub name: String,
    pub content: String,
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
