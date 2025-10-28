use crate::db::DbPool;
use crate::models::{ProjectCreate, Project, Character, Event};
use crate::services::projects as project_service;
use tauri::State;

#[derive(Clone)]
pub struct AppState {
    pub pool: DbPool,
}

#[tauri::command]
pub async fn project_create(state: State<'_, AppState>, payload: ProjectCreate) -> Result<Project, String> {
    let pool = &state.pool;
    project_service::create(pool, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn project_get(state: State<'_, AppState>, id: i64) -> Result<Option<Project>, String> {
    let pool = &state.pool;
    project_service::get(pool, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn project_list(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    let pool = &state.pool;
    project_service::list(pool).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn project_update(state: State<'_, AppState>, id: i64, changes: Option<serde_json::Value>) -> Result<Project, String> {
    let pool = &state.pool;
    // changes may contain name/desc/path
    let name = changes.as_ref().and_then(|c| c.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()));
    let desc = changes.as_ref().and_then(|c| c.get("desc").and_then(|v| v.as_str()).map(|s| s.to_string()));
    let path = changes.as_ref().and_then(|c| c.get("path").and_then(|v| v.as_str()).map(|s| s.to_string()));
    project_service::update(pool, id, name, desc, path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn project_delete(state: State<'_, AppState>, id: i64) -> Result<bool, String> {
    let pool = &state.pool;
    project_service::delete(pool, id).map_err(|e| e.to_string())
}

// Doc Groups Commands
#[tauri::command]
pub async fn doc_group_list(state: State<'_, AppState>, project_id: i64) -> Result<serde_json::Value, String> {
    let pool = &state.pool;
    let groups = crate::services::doc_groups::list_doc_groups(pool, project_id).map_err(|e| e.to_string())?;
    serde_json::to_value(groups).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_create(state: State<'_, AppState>, project_id: i64, name: String, parent_id: Option<i64>) -> Result<serde_json::Value, String> {
    let pool = &state.pool;
    let group = crate::services::doc_groups::create_doc_group(pool, project_id, &name, parent_id).map_err(|e| e.to_string())?;
    serde_json::to_value(group).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::doc_groups::delete_doc_group(pool, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_reorder(state: State<'_, AppState>, id: i64, direction: String) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::doc_groups::reorder_doc_group(pool, id, &direction).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_rename(state: State<'_, AppState>, id: i64, new_name: String) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::doc_groups::rename_doc_group(pool, id, &new_name).map_err(|e| e.to_string())
}

// Docs Commands
#[tauri::command]
pub async fn doc_list(state: State<'_, AppState>, project_id: i64) -> Result<serde_json::Value, String> {
    let pool = &state.pool;
    let docs = crate::services::docs::list_docs(pool, project_id).map_err(|e| e.to_string())?;
    serde_json::to_value(docs).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_get(state: State<'_, AppState>, id: i64) -> Result<serde_json::Value, String> {
    let pool = &state.pool;
    let doc = crate::services::docs::get_doc(pool, id).map_err(|e| e.to_string())?;
    serde_json::to_value(doc).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_create_new(state: State<'_, AppState>, project_id: i64, name: String, doc_group_id: Option<i64>) -> Result<serde_json::Value, String> {
    let pool = &state.pool;
    let doc = crate::services::docs::create_doc(pool, project_id, &name, doc_group_id).map_err(|e| e.to_string())?;
    serde_json::to_value(doc).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_update_text(state: State<'_, AppState>, id: i64, text: String) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::docs::update_doc(pool, id, &text).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::docs::delete_doc(pool, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_reorder(state: State<'_, AppState>, id: i64, direction: String) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::docs::reorder_doc(pool, id, &direction).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_move_to_group(state: State<'_, AppState>, doc_id: i64, new_group_id: Option<i64>) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::docs::move_doc_to_group(pool, doc_id, new_group_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_rename(state: State<'_, AppState>, id: i64, new_name: String) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::docs::rename_doc(pool, id, &new_name).map_err(|e| e.to_string())
}

// Legacy doc_create for backward compatibility
#[tauri::command]
pub async fn doc_create(state: State<'_, AppState>, project_id: i64, path: String, name: Option<String>, text: Option<String>) -> Result<serde_json::Value, String> {
    let pool = &state.pool;
    let doc = crate::services::docs::create(pool, project_id, &path, name, None, text).map_err(|e| e.to_string())?;
    serde_json::to_value(doc).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn character_create(state: State<'_, AppState>, project_id: i64, name: String, desc: Option<String>) -> Result<Character, String> {
    let pool = &state.pool;
    crate::services::characters::create(pool, project_id, &name, desc).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn event_create(state: State<'_, AppState>, project_id: i64, name: String, desc: Option<String>, date: Option<String>) -> Result<Event, String> {
    let pool = &state.pool;
    crate::services::events::create(pool, project_id, &name, desc, date).map_err(|e| e.to_string())
}
