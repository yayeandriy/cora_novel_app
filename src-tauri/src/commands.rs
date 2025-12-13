use crate::db::DbPool;
use crate::models::{
    ProjectCreate, Project,
    Character, Event, Place,
    DraftCreate, DraftUpdate, Draft,
    ProjectDraft, ProjectDraftCreate, ProjectDraftUpdate,
    FolderDraft, FolderDraftCreate, FolderDraftUpdate,
    Timeline, TimelineCreate, TimelineUpdate,
    Archive, ArchiveCreate, ArchiveUpdate
};
use std::io::Cursor;
use crate::services::projects as project_service;
use tauri::State;
use std::path::Path;
use std::fs;
use printpdf::*;

#[derive(Clone)]
pub struct AppState {
    pub pool: DbPool,
}

#[tauri::command]
pub async fn project_create(state: State<'_, AppState>, payload: ProjectCreate) -> Result<Project, String> {
    let pool = &state.pool;
    let project = project_service::create(pool, payload).map_err(|e| e.to_string())?;
    
    // Automatically create first folder "Part I" and first doc "Chapter One"
    let folder = crate::services::doc_groups::create_doc_group(pool, project.id, "Part I", None)
        .map_err(|e| e.to_string())?;
    let _doc = crate::services::docs::create_doc(pool, project.id, "Chapter One", Some(folder.id))
        .map_err(|e| e.to_string())?;
    
    Ok(project)
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
    let notes = changes.as_ref().and_then(|c| c.get("notes").and_then(|v| v.as_str()).map(|s| s.to_string()));
    project_service::update(pool, id, name, desc, path, notes).map_err(|e| e.to_string())
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
pub async fn doc_group_create_after(state: State<'_, AppState>, project_id: i64, name: String, parent_id: Option<i64>, after_sort_order: i64) -> Result<serde_json::Value, String> {
    let pool = &state.pool;
    let group = crate::services::doc_groups::create_doc_group_after(pool, project_id, &name, parent_id, after_sort_order).map_err(|e| e.to_string())?;
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

#[tauri::command]
pub async fn doc_group_update_notes(state: State<'_, AppState>, id: i64, notes: String) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::doc_groups::update_doc_group_notes(pool, id, &notes).map_err(|e| e.to_string())
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
pub async fn doc_create_after(state: State<'_, AppState>, project_id: i64, name: String, doc_group_id: Option<i64>, after_sort_order: i64) -> Result<serde_json::Value, String> {
    let pool = &state.pool;
    let doc = crate::services::docs::create_doc_after(pool, project_id, &name, doc_group_id, after_sort_order).map_err(|e| e.to_string())?;
    serde_json::to_value(doc).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_update_text(state: State<'_, AppState>, id: i64, text: String) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::docs::update_doc(pool, id, &text).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_update_notes(state: State<'_, AppState>, id: i64, notes: String) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::docs::update_doc_notes(pool, id, &notes).map_err(|e| e.to_string())
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
pub async fn character_list(state: State<'_, AppState>, project_id: i64) -> Result<Vec<Character>, String> {
    let pool = &state.pool;
    crate::services::characters::list(pool, project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn character_update(state: State<'_, AppState>, id: i64, changes: Option<serde_json::Value>) -> Result<Character, String> {
    let pool = &state.pool;
    let name = changes.as_ref().and_then(|c| c.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()));
    let desc = changes.as_ref().and_then(|c| c.get("desc").and_then(|v| v.as_str()).map(|s| s.to_string()));
    crate::services::characters::update(pool, id, name, desc).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn character_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::characters::delete_(pool, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_character_list(state: State<'_, AppState>, doc_id: i64) -> Result<Vec<i64>, String> {
    let pool = &state.pool;
    crate::services::characters::list_for_doc(pool, doc_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_character_attach(state: State<'_, AppState>, doc_id: i64, character_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::characters::attach_to_doc(pool, doc_id, character_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_character_detach(state: State<'_, AppState>, doc_id: i64, character_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::characters::detach_from_doc(pool, doc_id, character_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_character_list(state: State<'_, AppState>, doc_group_id: i64) -> Result<Vec<i64>, String> {
    let pool = &state.pool;
    crate::services::characters::list_for_doc_group(pool, doc_group_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_characters_from_docs(state: State<'_, AppState>, doc_group_id: i64) -> Result<Vec<i64>, String> {
    let pool = &state.pool;
    crate::services::characters::list_from_docs_in_group(pool, doc_group_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_character_attach(state: State<'_, AppState>, doc_group_id: i64, character_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::characters::attach_to_doc_group(pool, doc_group_id, character_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_character_detach(state: State<'_, AppState>, doc_group_id: i64, character_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::characters::detach_from_doc_group(pool, doc_group_id, character_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn event_create(state: State<'_, AppState>, project_id: i64, name: String, desc: Option<String>, start_date: Option<String>, end_date: Option<String>, date: Option<String>) -> Result<Event, String> {
    let pool = &state.pool;
    crate::services::events::create(pool, project_id, &name, desc, start_date, end_date, date).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn event_list(state: State<'_, AppState>, project_id: i64) -> Result<Vec<Event>, String> {
    let pool = &state.pool;
    crate::services::events::list(pool, project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn event_update(state: State<'_, AppState>, id: i64, changes: Option<serde_json::Value>) -> Result<Event, String> {
    let pool = &state.pool;
    let name = changes.as_ref().and_then(|c| c.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()));
    let desc = changes.as_ref().and_then(|c| c.get("desc").and_then(|v| v.as_str()).map(|s| s.to_string()));
    let start_date = changes.as_ref().and_then(|c| c.get("start_date").and_then(|v| v.as_str()).map(|s| s.to_string()));
    let end_date = changes.as_ref().and_then(|c| c.get("end_date").and_then(|v| v.as_str()).map(|s| s.to_string()));
    crate::services::events::update(pool, id, name, desc, start_date, end_date).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn event_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::events::delete_(pool, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_event_list(state: State<'_, AppState>, doc_id: i64) -> Result<Vec<i64>, String> {
    let pool = &state.pool;
    crate::services::events::list_for_doc(pool, doc_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_event_attach(state: State<'_, AppState>, doc_id: i64, event_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::events::attach_to_doc(pool, doc_id, event_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_event_detach(state: State<'_, AppState>, doc_id: i64, event_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::events::detach_from_doc(pool, doc_id, event_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_event_list(state: State<'_, AppState>, doc_group_id: i64) -> Result<Vec<i64>, String> {
    let pool = &state.pool;
    crate::services::events::list_for_doc_group(pool, doc_group_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_events_from_docs(state: State<'_, AppState>, doc_group_id: i64) -> Result<Vec<i64>, String> {
    let pool = &state.pool;
    crate::services::events::list_from_docs_in_group(pool, doc_group_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_event_attach(state: State<'_, AppState>, doc_group_id: i64, event_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::events::attach_to_doc_group(pool, doc_group_id, event_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_event_detach(state: State<'_, AppState>, doc_group_id: i64, event_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::events::detach_from_doc_group(pool, doc_group_id, event_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn place_create(state: State<'_, AppState>, project_id: i64, name: String, desc: Option<String>) -> Result<Place, String> {
    let pool = &state.pool;
    crate::services::places::create(pool, project_id, &name, desc).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn place_list(state: State<'_, AppState>, project_id: i64) -> Result<Vec<Place>, String> {
    let pool = &state.pool;
    crate::services::places::list(pool, project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn place_update(state: State<'_, AppState>, id: i64, changes: Option<serde_json::Value>) -> Result<Place, String> {
    let pool = &state.pool;
    let name = changes.as_ref().and_then(|c| c.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()));
    let desc = changes.as_ref().and_then(|c| c.get("desc").and_then(|v| v.as_str()).map(|s| s.to_string()));
    crate::services::places::update(pool, id, name, desc).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn place_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::places::delete_(pool, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_place_list(state: State<'_, AppState>, doc_id: i64) -> Result<Vec<i64>, String> {
    let pool = &state.pool;
    crate::services::places::list_for_doc(pool, doc_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_place_attach(state: State<'_, AppState>, doc_id: i64, place_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::places::attach_to_doc(pool, doc_id, place_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_place_detach(state: State<'_, AppState>, doc_id: i64, place_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::places::detach_from_doc(pool, doc_id, place_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_place_list(state: State<'_, AppState>, doc_group_id: i64) -> Result<Vec<i64>, String> {
    let pool = &state.pool;
    crate::services::places::list_for_doc_group(pool, doc_group_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_places_from_docs(state: State<'_, AppState>, doc_group_id: i64) -> Result<Vec<i64>, String> {
    let pool = &state.pool;
    crate::services::places::list_from_docs_in_group(pool, doc_group_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_place_attach(state: State<'_, AppState>, doc_group_id: i64, place_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::places::attach_to_doc_group(pool, doc_group_id, place_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_place_detach(state: State<'_, AppState>, doc_group_id: i64, place_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::places::detach_from_doc_group(pool, doc_group_id, place_id).map_err(|e| e.to_string())
}

// Archive Commands

#[tauri::command]
pub async fn archive_create(state: State<'_, AppState>, project_id: i64, payload: ArchiveCreate) -> Result<Archive, String> {
    let pool = &state.pool;
    crate::services::archives::create(pool, project_id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn archive_list(state: State<'_, AppState>, project_id: i64) -> Result<Vec<Archive>, String> {
    let pool = &state.pool;
    crate::services::archives::list(pool, project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn archive_get(state: State<'_, AppState>, id: i64) -> Result<Option<Archive>, String> {
    let pool = &state.pool;
    crate::services::archives::get(pool, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn archive_update(state: State<'_, AppState>, id: i64, payload: ArchiveUpdate) -> Result<Archive, String> {
    let pool = &state.pool;
    crate::services::archives::update(pool, id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn archive_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::archives::delete(pool, id).map_err(|e| e.to_string())
}

// Draft Commands
#[tauri::command]
pub async fn draft_create(state: State<'_, AppState>, doc_id: i64, payload: DraftCreate) -> Result<Draft, String> {
    let pool = &state.pool;
    crate::services::drafts::create_draft(pool, doc_id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn draft_get(state: State<'_, AppState>, id: i64) -> Result<Option<Draft>, String> {
    let pool = &state.pool;
    crate::services::drafts::get_draft(pool, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn draft_list(state: State<'_, AppState>, doc_id: i64) -> Result<Vec<Draft>, String> {
    let pool = &state.pool;
    crate::services::drafts::list_drafts(pool, doc_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn draft_update(state: State<'_, AppState>, id: i64, payload: DraftUpdate) -> Result<Draft, String> {
    let pool = &state.pool;
    crate::services::drafts::update_draft(pool, id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn draft_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::drafts::delete_draft(pool, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn draft_restore(state: State<'_, AppState>, draft_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::drafts::restore_draft_to_doc(pool, draft_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn draft_delete_all(state: State<'_, AppState>, doc_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::drafts::delete_all_drafts_for_doc(pool, doc_id).map_err(|e| e.to_string())
}

// Project Draft Commands
#[tauri::command]
pub async fn project_draft_create(state: State<'_, AppState>, project_id: i64, payload: ProjectDraftCreate) -> Result<ProjectDraft, String> {
    let pool = &state.pool;
    crate::services::project_drafts::create(pool, project_id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn project_draft_get(state: State<'_, AppState>, id: i64) -> Result<Option<ProjectDraft>, String> {
    let pool = &state.pool;
    crate::services::project_drafts::get(pool, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn project_draft_list(state: State<'_, AppState>, project_id: i64) -> Result<Vec<ProjectDraft>, String> {
    let pool = &state.pool;
    crate::services::project_drafts::list(pool, project_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn project_draft_update(state: State<'_, AppState>, id: i64, payload: ProjectDraftUpdate) -> Result<ProjectDraft, String> {
    let pool = &state.pool;
    crate::services::project_drafts::update(pool, id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn project_draft_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::project_drafts::delete(pool, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn project_draft_delete_all(state: State<'_, AppState>, project_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::project_drafts::delete_all_for_project(pool, project_id).map_err(|e| e.to_string())
}

// Folder (Doc Group) Draft Commands
#[tauri::command]
pub async fn folder_draft_create(state: State<'_, AppState>, doc_group_id: i64, payload: FolderDraftCreate) -> Result<FolderDraft, String> {
    let pool = &state.pool;
    crate::services::folder_drafts::create(pool, doc_group_id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn folder_draft_get(state: State<'_, AppState>, id: i64) -> Result<Option<FolderDraft>, String> {
    let pool = &state.pool;
    crate::services::folder_drafts::get(pool, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn folder_draft_list(state: State<'_, AppState>, doc_group_id: i64) -> Result<Vec<FolderDraft>, String> {
    let pool = &state.pool;
    crate::services::folder_drafts::list(pool, doc_group_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn folder_draft_update(state: State<'_, AppState>, id: i64, payload: FolderDraftUpdate) -> Result<FolderDraft, String> {
    let pool = &state.pool;
    crate::services::folder_drafts::update(pool, id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn folder_draft_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::folder_drafts::delete(pool, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn folder_draft_delete_all(state: State<'_, AppState>, doc_group_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::folder_drafts::delete_all_for_group(pool, doc_group_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn folder_draft_reorder(state: State<'_, AppState>, id: i64, direction: String) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::folder_drafts::reorder(pool, id, &direction).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn folder_draft_move(state: State<'_, AppState>, id: i64, new_index: usize) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::folder_drafts::move_to_index(pool, id, new_index).map_err(|e| e.to_string())
}

// Timeline Commands
#[tauri::command]
pub async fn timeline_create(state: State<'_, AppState>, payload: TimelineCreate) -> Result<Timeline, String> {
    let pool = &state.pool;
    crate::services::timelines::create(pool, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn timeline_get(state: State<'_, AppState>, id: i64) -> Result<Option<Timeline>, String> {
    let pool = &state.pool;
    crate::services::timelines::get(pool, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn timeline_get_by_entity(state: State<'_, AppState>, entity_type: String, entity_id: i64) -> Result<Option<Timeline>, String> {
    let pool = &state.pool;
    crate::services::timelines::get_by_entity(pool, &entity_type, entity_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn timeline_list(state: State<'_, AppState>) -> Result<Vec<Timeline>, String> {
    let pool = &state.pool;
    crate::services::timelines::list(pool).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn timeline_update(state: State<'_, AppState>, id: i64, payload: TimelineUpdate) -> Result<Timeline, String> {
    let pool = &state.pool;
    crate::services::timelines::update(pool, id, payload).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn timeline_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::timelines::delete(pool, id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn timeline_delete_by_entity(state: State<'_, AppState>, entity_type: String, entity_id: i64) -> Result<(), String> {
    let pool = &state.pool;
    crate::services::timelines::delete_by_entity(pool, &entity_type, entity_id).map_err(|e| e.to_string())
}

/// Import multiple paths (files or folders).
/// - Files with .txt are imported as docs into the target folder (doc_group_id).
/// - Folders always become ROOT-LEVEL doc groups (parent_id = None), regardless of the target folder.
///   Only the folder's immediate .txt files are imported into that new group. Nested subfolders are ignored.
#[tauri::command]
pub async fn import_txt_files(state: State<'_, AppState>, project_id: i64, doc_group_id: i64, files: Vec<String>) -> Result<usize, String> {
    let pool = &state.pool;
    let mut imported = 0usize;

    for p in files {
        let path = Path::new(&p);
        if path.is_file() {
            // import a single file if .txt
            if path.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("txt")).unwrap_or(false) {
                let name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Imported");
                let content = std::fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", p, e))?;
                let doc = crate::services::docs::create_doc(pool, project_id, name, Some(doc_group_id))
                    .map_err(|e| e.to_string())?;
                crate::services::docs::update_doc(pool, doc.id, &content).map_err(|e| e.to_string())?;
                imported += 1;
            }
            continue;
        }

        if path.is_dir() {
            // Create a ROOT-LEVEL group for this directory
            let group_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("Imported Folder").to_string();
            let group = crate::services::doc_groups::create_doc_group(pool, project_id, &group_name, None)
                .map_err(|e| e.to_string())?;

            // Import only immediate .txt files (ignore subdirectories)
            let entries = std::fs::read_dir(&path).map_err(|e| format!("Failed to read dir {}: {}", p, e))?;
            for entry in entries {
                let entry = entry.map_err(|e| e.to_string())?;
                let entry_path = entry.path();
                if entry_path.is_file() {
                    if entry_path.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("txt")).unwrap_or(false) {
                        let name = entry_path.file_stem().and_then(|s| s.to_str()).unwrap_or("Imported");
                        let content = std::fs::read_to_string(&entry_path).map_err(|e| format!("Failed to read {}: {}", entry_path.display(), e))?;
                        let doc = crate::services::docs::create_doc(pool, project_id, name, Some(group.id))
                            .map_err(|e| e.to_string())?;
                        crate::services::docs::update_doc(pool, doc.id, &content).map_err(|e| e.to_string())?;
                        imported += 1;
                    }
                }
            }
        }
    }

    Ok(imported)
}

/// Import an entire project from a folder path.
/// - Creates a new project named after the folder (path basename)
/// - For each immediate subfolder: creates a root-level doc group and imports its immediate .txt files
/// - For immediate .txt files in the root: creates a doc group named "UNSORTED" (created last) and imports them there
#[tauri::command]
pub async fn import_project(state: State<'_, AppState>, folder_path: String) -> Result<serde_json::Value, String> {
    let pool = &state.pool;

    let base = Path::new(&folder_path);
    if !base.exists() || !base.is_dir() {
        return Err("Selected path is not a directory".to_string());
    }

    // First, check for metadata.json to detect exported project format
    let metadata_path = base.join("metadata.json");
    if metadata_path.exists() && metadata_path.is_file() {
        // Parse and import based on metadata
        let content = fs::read_to_string(&metadata_path).map_err(|e| format!("Failed to read metadata.json: {}", e))?;
        #[derive(serde::Deserialize)]
        struct MetaHeader { app: Option<String>, version: Option<u32>, exported_at: Option<String> }
        #[derive(serde::Deserialize)]
        struct ImportFile {
            meta: Option<MetaHeader>,
            project: crate::models::Project,
            groups: Vec<crate::models::DocGroup>,
            docs: Vec<crate::models::Doc>,
            characters: Vec<crate::models::Character>,
            events: Vec<crate::models::Event>,
            #[serde(default)]
            places: Vec<crate::models::Place>,
            doc_characters: std::collections::HashMap<i64, Vec<i64>>,
            doc_events: std::collections::HashMap<i64, Vec<i64>>,
            #[serde(default)]
            doc_places: std::collections::HashMap<i64, Vec<i64>>,
            project_timeline: Option<crate::models::Timeline>,
            doc_timelines: std::collections::HashMap<i64, Option<crate::models::Timeline>>,
            #[serde(default)]
            drafts_by_doc: std::collections::HashMap<i64, Vec<crate::models::Draft>>,
        }
        let parsed: ImportFile = match serde_json::from_str(&content) {
            Ok(v) => v,
            Err(_) => {
                // Fallback to legacy import on parse error
                return legacy_import_folder(pool, base, &folder_path);
            }
        };
        if let Some(meta) = &parsed.meta {
            if meta.app.as_deref() != Some("cora") {
                // Fallback to legacy import if not our format
                return legacy_import_folder(pool, base, &folder_path);
            }
        }

        // Create project (prefer metadata project name)
        let project_name = parsed.project.name.clone();
    let payload = crate::models::ProjectCreate { name: project_name, desc: parsed.project.desc.clone(), path: Some(folder_path.clone()), notes: parsed.project.notes.clone(), grid_order: None };
        let new_project = crate::services::projects::create(pool, payload).map_err(|e| e.to_string())?;

        use std::collections::HashMap;
        // Create groups in parent-first order using original ids for mapping
        let mut groups_by_parent: HashMap<Option<i64>, Vec<&crate::models::DocGroup>> = HashMap::new();
        for g in &parsed.groups {
            groups_by_parent.entry(g.parent_id).or_default().push(g);
        }
        for v in groups_by_parent.values_mut() {
            v.sort_by_key(|g| g.sort_order.unwrap_or(0_i64));
        }
        let mut group_id_map: HashMap<i64, i64> = HashMap::new(); // old -> new
        // Create root groups
        if let Some(root) = groups_by_parent.get(&None) {
            for g in root {
                let created = crate::services::doc_groups::create_doc_group(pool, new_project.id, &g.name, None).map_err(|e| e.to_string())?;
                group_id_map.insert(g.id, created.id);
                // Recurse children for this group
                let mut stack: Vec<i64> = vec![g.id];
                while let Some(parent_old_id) = stack.pop() {
                    if let Some(children) = groups_by_parent.get(&Some(parent_old_id)) {
                        for ch in children {
                            let new_parent_id = *group_id_map.get(&parent_old_id).expect("parent must be created");
                            let created_child = crate::services::doc_groups::create_doc_group(pool, new_project.id, &ch.name, Some(new_parent_id)).map_err(|e| e.to_string())?;
                            group_id_map.insert(ch.id, created_child.id);
                            stack.push(ch.id);
                        }
                    }
                }
            }
        }

        // Create docs ordered by (doc_group_id, sort_order)
        let mut docs_sorted: Vec<&crate::models::Doc> = parsed.docs.iter().collect();
        docs_sorted.sort_by_key(|d| (d.doc_group_id.unwrap_or(-1_i64), d.sort_order.unwrap_or(0_i64)));
        let mut doc_id_map: HashMap<i64, i64> = HashMap::new();
        for d in docs_sorted {
            let name = d.name.clone().unwrap_or("Untitled".to_string());
            let new_group = d.doc_group_id.and_then(|old_gid| group_id_map.get(&old_gid).copied());
            let created = crate::services::docs::create_doc(pool, new_project.id, &name, new_group).map_err(|e| e.to_string())?;
            if let Some(t) = d.text.clone() { crate::services::docs::update_doc(pool, created.id, &t).map_err(|e| e.to_string())?; }
            if let Some(n) = d.notes.clone() { crate::services::docs::update_doc_notes(pool, created.id, &n).map_err(|e| e.to_string())?; }
            doc_id_map.insert(d.id, created.id);
        }

        // Create drafts per doc if present
        for (old_doc_id, drafts) in parsed.drafts_by_doc.iter() {
            if let Some(&new_doc_id) = doc_id_map.get(old_doc_id) {
                for dr in drafts {
                    let name = dr.name.clone();
                    let content = dr.content.clone();
                    crate::services::drafts::create_draft(pool, new_doc_id, crate::models::DraftCreate { name, content }).map_err(|e| e.to_string())?;
                }
            }
        }

        // Characters
        let mut char_id_map: HashMap<i64, i64> = HashMap::new();
        for c in &parsed.characters {
            let created = crate::services::characters::create(pool, new_project.id, &c.name, c.desc.clone()).map_err(|e| e.to_string())?;
            char_id_map.insert(c.id, created.id);
        }
        // Events
        let mut event_id_map: HashMap<i64, i64> = HashMap::new();
        for e in &parsed.events {
            let created = crate::services::events::create(pool, new_project.id, &e.name, e.desc.clone(), e.start_date.clone(), e.end_date.clone(), e.date.clone()).map_err(|e| e.to_string())?;
            event_id_map.insert(e.id, created.id);
        }
        // Places
        let mut place_id_map: HashMap<i64, i64> = HashMap::new();
        for p in &parsed.places {
            let created = crate::services::places::create(pool, new_project.id, &p.name, p.desc.clone()).map_err(|e| e.to_string())?;
            place_id_map.insert(p.id, created.id);
        }

        // Attachments
        for (old_doc_id, old_chars) in parsed.doc_characters.iter() {
            if let Some(&new_doc_id) = doc_id_map.get(old_doc_id) {
                for old_ch in old_chars {
                    if let Some(&new_ch_id) = char_id_map.get(old_ch) {
                        crate::services::characters::attach_to_doc(pool, new_doc_id, new_ch_id).map_err(|e| e.to_string())?;
                    }
                }
            }
        }
        for (old_doc_id, old_events) in parsed.doc_events.iter() {
            if let Some(&new_doc_id) = doc_id_map.get(old_doc_id) {
                for old_ev in old_events {
                    if let Some(&new_ev_id) = event_id_map.get(old_ev) {
                        crate::services::events::attach_to_doc(pool, new_doc_id, new_ev_id).map_err(|e| e.to_string())?;
                    }
                }
            }
        }
        for (old_doc_id, old_places) in parsed.doc_places.iter() {
            if let Some(&new_doc_id) = doc_id_map.get(old_doc_id) {
                for old_pl in old_places {
                    if let Some(&new_pl_id) = place_id_map.get(old_pl) {
                        crate::services::places::attach_to_doc(pool, new_doc_id, new_pl_id).map_err(|e| e.to_string())?;
                    }
                }
            }
        }

        // Timelines
        if let Some(tl) = parsed.project_timeline.clone() {
            let _ = crate::services::timelines::create(pool, crate::models::TimelineCreate { entity_type: "project".into(), entity_id: new_project.id, start_date: tl.start_date, end_date: tl.end_date }).map_err(|e| e.to_string())?;
        }
        for (old_doc_id, maybe_tl) in parsed.doc_timelines.iter() {
            if let Some(&new_doc_id) = doc_id_map.get(old_doc_id) {
                if let Some(tl) = maybe_tl {
                    let _ = crate::services::timelines::create(pool, crate::models::TimelineCreate { entity_type: "doc".into(), entity_id: new_doc_id, start_date: tl.start_date.clone(), end_date: tl.end_date.clone() }).map_err(|e| e.to_string())?;
                }
            }
        }

        return serde_json::to_value(new_project).map_err(|e| e.to_string());
    }

        // Fallback: legacy folder import (no metadata.json)
        return legacy_import_folder(pool, base, &folder_path);
}

// Helper to perform legacy folder import
fn legacy_import_folder(pool: &crate::db::DbPool, base: &Path, folder_path: &str) -> Result<serde_json::Value, String> {
        // Project name from folder basename
        let project_name = base.file_name().and_then(|s| s.to_str()).unwrap_or("Imported Project").to_string();
    let payload = crate::models::ProjectCreate { name: project_name.clone(), desc: None, path: Some(folder_path.to_string()), notes: None, grid_order: None };
        let project = crate::services::projects::create(pool, payload).map_err(|e| e.to_string())?;

        // Read entries and partition into subdirs and root .txt files
        let mut subdirs: Vec<(String, std::path::PathBuf)> = Vec::new();
        let mut root_txt_files: Vec<std::path::PathBuf> = Vec::new();
        for entry in fs::read_dir(base).map_err(|e| format!("Failed to read dir {}: {}", base.display(), e))? {
                let entry = entry.map_err(|e| e.to_string())?;
                let p = entry.path();
                if p.is_dir() {
                        let name = p.file_name().and_then(|s| s.to_str()).unwrap_or("Folder").to_string();
                        subdirs.push((name, p));
                } else if p.is_file() {
                        if p.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("txt")).unwrap_or(false) {
                                root_txt_files.push(p);
                        }
                }
        }
        subdirs.sort_by(|a, b| a.0.to_lowercase().cmp(&b.0.to_lowercase()));
        root_txt_files.sort();
        for (dir_name, dir_path) in subdirs.iter() {
                let group = crate::services::doc_groups::create_doc_group(pool, project.id, dir_name, None).map_err(|e| e.to_string())?;
                for entry in fs::read_dir(dir_path).map_err(|e| format!("Failed to read dir {}: {}", dir_path.display(), e))? {
                        let entry = entry.map_err(|e| e.to_string())?;
                        let file_path = entry.path();
                        if file_path.is_file() {
                                if file_path.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("txt")).unwrap_or(false) {
                                        let name = file_path.file_stem().and_then(|s| s.to_str()).unwrap_or("Imported");
                                        let text = fs::read_to_string(&file_path).map_err(|e| format!("Failed to read {}: {}", file_path.display(), e))?;
                                        let doc = crate::services::docs::create_doc(pool, project.id, name, Some(group.id)).map_err(|e| e.to_string())?;
                                        crate::services::docs::update_doc(pool, doc.id, &text).map_err(|e| e.to_string())?;
                                }
                        }
                }
        }
        if !root_txt_files.is_empty() {
                let unsorted = crate::services::doc_groups::create_doc_group(pool, project.id, "UNSORTED", None).map_err(|e| e.to_string())?;
                for file_path in root_txt_files.iter() {
                        let name = file_path.file_stem().and_then(|s| s.to_str()).unwrap_or("Imported");
                        let text = fs::read_to_string(&file_path).map_err(|e| format!("Failed to read {}: {}", file_path.display(), e))?;
                        let doc = crate::services::docs::create_doc(pool, project.id, name, Some(unsorted.id)).map_err(|e| e.to_string())?;
                        crate::services::docs::update_doc(pool, doc.id, &text).map_err(|e| e.to_string())?;
                }
        }
        serde_json::to_value(project).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn export_project(state: State<'_, AppState>, project_id: i64, dest_path: String) -> Result<(), String> {
    // use std::path::{PathBuf};
    let pool = &state.pool;

    let dest = Path::new(&dest_path);
    if !dest.exists() {
        fs::create_dir_all(dest).map_err(|e| format!("Failed to create destination: {}", e))?;
    }
    if !dest.is_dir() { return Err("Destination is not a directory".into()); }

    // Load project
    let project = crate::services::projects::get(pool, project_id).map_err(|e| e.to_string())?
        .ok_or_else(|| "Project not found".to_string())?;

    // Load groups and docs
    let groups = crate::services::doc_groups::list_doc_groups(pool, project_id).map_err(|e| e.to_string())?;
    let docs = crate::services::docs::list_docs(pool, project_id).map_err(|e| e.to_string())?;

    // Build maps
    use std::collections::HashMap;
    let mut children: HashMap<Option<i64>, Vec<&crate::models::DocGroup>> = HashMap::new();
    for g in &groups {
        children.entry(g.parent_id).or_default().push(g);
    }
    // Sort siblings by sort_order
    for v in children.values_mut() {
        v.sort_by_key(|g| g.sort_order.unwrap_or(0));
    }
    let mut docs_by_group: HashMap<i64, Vec<&crate::models::Doc>> = HashMap::new();
    for d in &docs {
        if let Some(gid) = d.doc_group_id { docs_by_group.entry(gid).or_default().push(d); }
    }
    for v in docs_by_group.values_mut() { v.sort_by_key(|d| d.sort_order.unwrap_or(0)); }

    // Helper: sanitize names
    fn sanitize(s: &str) -> String {
        let mut out = s.trim().to_string();
        if out.is_empty() { out = "Untitled".into(); }
        let bad = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
        out.chars().map(|c| if bad.contains(&c) { '_' } else { c }).collect()
    }

    // Export recursively
    fn export_group_recursive(
        pool: &crate::db::DbPool,
        base_dir: &Path,
        group: &crate::models::DocGroup,
        group_index: usize,
        children: &HashMap<Option<i64>, Vec<&crate::models::DocGroup>>,
        docs_by_group: &HashMap<i64, Vec<&crate::models::Doc>>,
    ) -> Result<(), String> {
        // Directory name: "{index} {name}"
        let dir_name = format!("{} {}", group_index, sanitize(&group.name));
        let group_dir = base_dir.join(dir_name);
        fs::create_dir_all(&group_dir).map_err(|e| format!("Failed to create group dir: {}", e))?;

        // Docs in this group
        if let Some(dd) = docs_by_group.get(&group.id) {
            for (i, d) in dd.iter().enumerate() {
                let doc_index = format!("{}.{}", group_index, i + 1);
                let doc_name = sanitize(d.name.as_deref().unwrap_or("Untitled"));
                let file_name = format!("{} {}.txt", doc_index, doc_name);
                let file_path = group_dir.join(file_name);
                let content = d.text.clone().unwrap_or_default();
                fs::write(&file_path, content).map_err(|e| format!("Write doc failed: {}", e))?;

                // Drafts as separate files: doc_index + doc_file + draft_index
                let drafts = crate::services::drafts::list_drafts(pool, d.id).map_err(|e| e.to_string())?;
                for (k, draft) in drafts.iter().enumerate() {
                    let draft_file = format!("{} {} draft-{}.txt", doc_index, doc_name, k + 1);
                    let draft_path = group_dir.join(draft_file);
                    fs::write(&draft_path, &draft.content).map_err(|e| format!("Write draft failed: {}", e))?;
                }
            }
        }

        // Recurse into child groups under this group
        if let Some(childs) = children.get(&Some(group.id)) {
            for (idx, child) in childs.iter().enumerate() {
                export_group_recursive(pool, &group_dir, child, idx + 1, children, docs_by_group)?;
            }
        }
        Ok(())
    }

    // Determine export root directory name inside destination
    let base_name = sanitize(&project.name);
    let mut candidate = base_name.clone();
    let mut counter: usize = 2;
    let export_root = loop {
        let try_path = dest.join(&candidate);
        if !try_path.exists() { break try_path; }
        candidate = format!("{} export {}", base_name, counter);
        counter += 1;
        if counter > 9999 { return Err("Failed to pick unique export folder name".into()); }
    };
    fs::create_dir_all(&export_root).map_err(|e| format!("Failed to create export folder: {}", e))?;

    // Export root-level groups into export_root
    if let Some(root_groups) = children.get(&None) {
        for (gi, g) in root_groups.iter().enumerate() {
            export_group_recursive(pool, &export_root, g, gi + 1, &children, &docs_by_group)?;
        }
    }

    // Build metadata
    let characters = crate::services::characters::list(pool, project_id).map_err(|e| e.to_string())?;
    let events = crate::services::events::list(pool, project_id).map_err(|e| e.to_string())?;
    let places = crate::services::places::list(pool, project_id).map_err(|e| e.to_string())?;
    // doc -> character ids
    let mut doc_characters: HashMap<i64, Vec<i64>> = HashMap::new();
    let mut doc_events: HashMap<i64, Vec<i64>> = HashMap::new();
    let mut doc_places: HashMap<i64, Vec<i64>> = HashMap::new();
    for d in &docs {
        let ch = crate::services::characters::list_for_doc(pool, d.id).map_err(|e| e.to_string())?;
        doc_characters.insert(d.id, ch);
        let ev = crate::services::events::list_for_doc(pool, d.id).map_err(|e| e.to_string())?;
        doc_events.insert(d.id, ev);
        let pl = crate::services::places::list_for_doc(pool, d.id).map_err(|e| e.to_string())?;
        doc_places.insert(d.id, pl);
    }
    let project_timeline = crate::services::timelines::get_by_entity(pool, "project", project_id).map_err(|e| e.to_string())?;
    let mut doc_timelines: HashMap<i64, Option<crate::models::Timeline>> = HashMap::new();
    for d in &docs {
        let tl = crate::services::timelines::get_by_entity(pool, "doc", d.id).map_err(|e| e.to_string())?;
        doc_timelines.insert(d.id, tl);
    }

    // drafts_by_doc for robust import
    let mut drafts_by_doc: HashMap<i64, Vec<crate::models::Draft>> = HashMap::new();
    for d in &docs {
        let ds = crate::services::drafts::list_drafts(pool, d.id).map_err(|e| e.to_string())?;
        if !ds.is_empty() { drafts_by_doc.insert(d.id, ds); }
    }

    let meta = serde_json::json!({
        "meta": {
            "app": "cora",
            "version": 1,
            "exported_at": chrono::Utc::now().to_rfc3339(),
        },
        "project": project,
        "groups": groups,
        "docs": docs,
        "characters": characters,
        "events": events,
        "places": places,
        "doc_characters": doc_characters,
        "doc_events": doc_events,
        "doc_places": doc_places,
        "project_timeline": project_timeline,
        "doc_timelines": doc_timelines,
        "drafts_by_doc": drafts_by_doc,
    });

    let meta_json = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    let meta_path = export_root.join("metadata.json");
    fs::write(&meta_path, meta_json).map_err(|e| format!("Write metadata failed: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn export_project_to_pdf(state: State<'_, AppState>, project_id: i64, dest_path: String) -> Result<(), String> {
    let pool = &state.pool;
    let conn = pool.get().map_err(|e| e.to_string())?;
    
    // Get project
    let project: Project = conn.query_row(
        "SELECT id, name, desc, path, notes, timeline_start, timeline_end, grid_order FROM projects WHERE id = ?",
        [project_id],
        |row| Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            desc: row.get(2)?,
            path: row.get(3)?,
            notes: row.get(4)?,
            timeline_start: row.get(5)?,
            timeline_end: row.get(6)?,
            grid_order: row.get(7)?,
        })
    ).map_err(|e| e.to_string())?;
    
    // PDF Configuration
    let page_width = Mm(210.0);   // A4 width
    let page_height = Mm(297.0);  // A4 height
    let margin_top = Mm(25.0);
    let margin_bottom = Mm(25.0);
    let margin_left = Mm(25.0);
    let margin_right = Mm(25.0);
    let header_height = Mm(10.0);
    let footer_height = Mm(10.0);
    
    let text_area_width = page_width - margin_left - margin_right;  // 160mm
    let text_start_y = page_height - margin_top - header_height;
    let text_end_y = margin_bottom + footer_height;
    
    // Font sizes
    let title_size = 24.0;
    let part_size = 18.0;
    let chapter_size = 14.0;
    let body_size = 11.0;
    let header_size = 9.0;
    let footer_size = 9.0;
    
    // Line heights (spacing between lines)
    let body_line_height = Mm(5.0);
    let paragraph_spacing = Mm(3.0);
    
    // Character width approximation for wrapping
    // At 11pt Arial, average character width is approximately 2.0-2.2mm
    let avg_char_width_mm = 2.0;
    let max_chars = (text_area_width.0 / avg_char_width_mm) as usize;  // ~80 chars for 160mm
    
    // Create PDF document
    let (doc, page1, layer1) = PdfDocument::new(&project.name, page_width, page_height, "Layer 1");
    
    // Load fonts that support Cyrillic characters
    let font_paths = vec![
        "/System/Library/Fonts/Supplemental/Arial.ttf",  // macOS
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  // Linux
        "C:\\Windows\\Fonts\\arial.ttf",  // Windows
    ];
    
    let bold_font_paths = vec![
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",  // macOS
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  // Linux
        "C:\\Windows\\Fonts\\arialbd.ttf",  // Windows
    ];
    
    let mut font_data = None;
    for path in &font_paths {
        if let Ok(data) = std::fs::read(path) {
            font_data = Some(data);
            break;
        }
    }
    
    let mut bold_font_data = None;
    for path in &bold_font_paths {
        if let Ok(data) = std::fs::read(path) {
            bold_font_data = Some(data);
            break;
        }
    }
    
    let font = if let Some(data) = font_data {
        doc.add_external_font(Cursor::new(data)).map_err(|e| e.to_string())?
    } else {
        doc.add_builtin_font(BuiltinFont::TimesRoman).map_err(|e| e.to_string())?
    };
    
    let font_bold = if let Some(data) = bold_font_data {
        doc.add_external_font(Cursor::new(data)).map_err(|e| e.to_string())?
    } else {
        doc.add_builtin_font(BuiltinFont::TimesBold).map_err(|e| e.to_string())?
    };
    
    // Helper function to add a new page with header and footer
    let mut page_count = 1;
    let mut current_part_name = String::new();
    let mut current_chapter_name = String::new();
    
    let mut add_new_page = |doc: &PdfDocumentReference, 
                           page_num: &mut i32, 
                           part_name: &str,
                           chapter_name: &str,
                           font: &IndirectFontRef,
                           font_bold: &IndirectFontRef| -> (PdfPageReference, PdfLayerReference) {
        let (page_idx, layer_idx) = doc.add_page(page_width, page_height, "Layer 1");
        let page = doc.get_page(page_idx);
        let layer = page.get_layer(layer_idx);
        
        // Add header (part and chapter name)
        if !part_name.is_empty() || !chapter_name.is_empty() {
            let header_y = page_height - margin_top + Mm(3.0);
            let header_text = if !chapter_name.is_empty() {
                format!("{} / {}", part_name, chapter_name)
            } else {
                part_name.to_string()
            };
            
            // Truncate header if too long
            let max_header_chars = (text_area_width.0 * 2.5) as usize; // ~2.5 chars per mm at 9pt
            let truncated_header = if header_text.len() > max_header_chars {
                format!("{}...", &header_text[..max_header_chars - 3])
            } else {
                header_text
            };
            
            layer.use_text(&truncated_header, header_size, margin_left, header_y, font);
        }
        
        // Add footer (page number)
        let footer_y = margin_bottom - Mm(5.0);
        let page_number_text = format!("{}", page_num);
        // Center the page number
        let number_width = Mm(page_number_text.len() as f32 * 1.5); // Approximate width
        let center_x = (page_width - number_width) / 2.0;
        layer.use_text(&page_number_text, footer_size, center_x, footer_y, font);
        
        *page_num += 1;
        (page, layer)
    };
    
    // Initialize first page
    let mut current_page = doc.get_page(page1);
    let mut current_layer = current_page.get_layer(layer1);
    let mut y_position = text_start_y;
    
    // Add title on first page
    current_layer.use_text(&project.name, title_size, margin_left, y_position, &font_bold);
    y_position = y_position - Mm(15.0);
    
    // Add page number to first page
    let footer_y = margin_bottom - Mm(5.0);
    let page_number_text = "1";
    let number_width = Mm(page_number_text.len() as f32 * 1.5);
    let center_x = (page_width - number_width) / 2.0;
    current_layer.use_text(page_number_text, footer_size, center_x, footer_y, &font);
    page_count += 1;
    
    // Get all groups and docs
    let mut groups_stmt = conn.prepare(
        "SELECT id, name, parent_id FROM doc_groups WHERE project_id = ? ORDER BY sort_order"
    ).map_err(|e| e.to_string())?;
    
    let groups: Vec<(i64, String, Option<i64>)> = groups_stmt.query_map([project_id], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    }).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    // Get all docs
    let mut docs_stmt = conn.prepare(
        "SELECT id, name, text, doc_group_id FROM docs WHERE project_id = ? ORDER BY sort_order"
    ).map_err(|e| e.to_string())?;
    
    let docs: Vec<(i64, String, String, Option<i64>)> = docs_stmt.query_map([project_id], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
    }).map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    
    // Process groups and docs
    for (group_id, group_name, _parent) in &groups {
        current_part_name = group_name.clone();
        
        // Add group name (Part)
        if y_position < text_end_y + Mm(20.0) {
            let (page, layer) = add_new_page(&doc, &mut page_count, &current_part_name, "", &font, &font_bold);
            current_page = page;
            current_layer = layer;
            y_position = text_start_y;
        }
        
        current_layer.use_text(group_name, part_size, margin_left, y_position, &font_bold);
        y_position = y_position - Mm(12.0);
        
        // Add docs in this group
        for (_doc_id, doc_name, content, doc_group_id) in &docs {
            if doc_group_id.as_ref() == Some(group_id) {
                current_chapter_name = doc_name.clone();
                
                // Add chapter name
                if y_position < text_end_y + Mm(15.0) {
                    let (page, layer) = add_new_page(&doc, &mut page_count, &current_part_name, &current_chapter_name, &font, &font_bold);
                    current_page = page;
                    current_layer = layer;
                    y_position = text_start_y;
                }
                
                current_layer.use_text(doc_name, chapter_size, margin_left, y_position, &font_bold);
                y_position = y_position - Mm(8.0);
                
                // Add content with text wrapping
                for paragraph in content.split("\n\n") {
                    if paragraph.trim().is_empty() {
                        continue;
                    }
                    
                    // Wrap long paragraphs
                    let mut current_line = String::new();
                    for word in paragraph.split_whitespace() {
                        let test_line = if current_line.is_empty() {
                            word.to_string()
                        } else {
                            format!("{} {}", current_line, word)
                        };
                        
                        // Use chars().count() for proper Unicode character counting
                        if test_line.chars().count() > max_chars {
                            // Write current line before adding this word
                            if !current_line.is_empty() {
                                if y_position < text_end_y {
                                    let (page, layer) = add_new_page(&doc, &mut page_count, &current_part_name, &current_chapter_name, &font, &font_bold);
                                    current_page = page;
                                    current_layer = layer;
                                    y_position = text_start_y;
                                }
                                current_layer.use_text(&current_line, body_size, margin_left, y_position, &font);
                                y_position = y_position - body_line_height;
                            }
                            current_line = word.to_string();
                        } else {
                            current_line = test_line;
                        }
                    }
                    
                    // Write remaining text
                    if !current_line.is_empty() {
                        if y_position < text_end_y {
                            let (page, layer) = add_new_page(&doc, &mut page_count, &current_part_name, &current_chapter_name, &font, &font_bold);
                            current_page = page;
                            current_layer = layer;
                            y_position = text_start_y;
                        }
                        current_layer.use_text(&current_line, body_size, margin_left, y_position, &font);
                        y_position = y_position - body_line_height;
                    }
                    
                    // Add space between paragraphs
                    y_position = y_position - paragraph_spacing;
                }
                
                // Extra space after chapter
                y_position = y_position - Mm(5.0);
            }
        }
    }
    
    // Save PDF
    let pdf_path = Path::new(&dest_path).join(format!("{}.pdf", project.name));
    doc.save(&mut std::io::BufWriter::new(std::fs::File::create(&pdf_path).map_err(|e| e.to_string())?))
        .map_err(|e| e.to_string())?;
    
    Ok(())
}