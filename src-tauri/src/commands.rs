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
