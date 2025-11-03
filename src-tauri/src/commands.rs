use crate::db::DbPool;
use crate::models::{ProjectCreate, Project, Character, Event, DraftCreate, DraftUpdate, Draft, Timeline, TimelineCreate, TimelineUpdate};
use crate::services::projects as project_service;
use tauri::State;
use std::path::Path;
use std::fs;

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

    // Project name from folder basename
    let project_name = base.file_name().and_then(|s| s.to_str()).unwrap_or("Imported Project").to_string();

    // Create project with path saved
    let payload = crate::models::ProjectCreate { name: project_name.clone(), desc: None, path: Some(folder_path.clone()) };
    let project = crate::services::projects::create(pool, payload).map_err(|e| e.to_string())?;

    // Read entries and partition into subdirs and root .txt files
    let mut subdirs: Vec<(String, std::path::PathBuf)> = Vec::new();
    let mut root_txt_files: Vec<std::path::PathBuf> = Vec::new();

    for entry in fs::read_dir(base).map_err(|e| format!("Failed to read dir {}: {}", base.display(), e))? {
        let entry = entry.map_err(|e| e.to_string())?;
        let p = entry.path();
        if p.is_dir() {
            // collect subdir
            let name = p.file_name().and_then(|s| s.to_str()).unwrap_or("Folder").to_string();
            subdirs.push((name, p));
        } else if p.is_file() {
            if p.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("txt")).unwrap_or(false) {
                root_txt_files.push(p);
            }
        }
    }

    // Sort by name for determinism
    subdirs.sort_by(|a, b| a.0.to_lowercase().cmp(&b.0.to_lowercase()));
    root_txt_files.sort();

    // Create groups for subdirs and import immediate .txt files
    for (dir_name, dir_path) in subdirs.iter() {
        let group = crate::services::doc_groups::create_doc_group(pool, project.id, dir_name, None)
            .map_err(|e| e.to_string())?;
        // Import only immediate .txt files
        for entry in fs::read_dir(dir_path).map_err(|e| format!("Failed to read dir {}: {}", dir_path.display(), e))? {
            let entry = entry.map_err(|e| e.to_string())?;
            let file_path = entry.path();
            if file_path.is_file() {
                if file_path.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("txt")).unwrap_or(false) {
                    let name = file_path.file_stem().and_then(|s| s.to_str()).unwrap_or("Imported");
                    let content = fs::read_to_string(&file_path).map_err(|e| format!("Failed to read {}: {}", file_path.display(), e))?;
                    let doc = crate::services::docs::create_doc(pool, project.id, name, Some(group.id))
                        .map_err(|e| e.to_string())?;
                    crate::services::docs::update_doc(pool, doc.id, &content).map_err(|e| e.to_string())?;
                }
            }
        }
    }

    // If root .txt files exist, create UNSORTED group last and import
    if !root_txt_files.is_empty() {
        let unsorted = crate::services::doc_groups::create_doc_group(pool, project.id, "UNSORTED", None)
            .map_err(|e| e.to_string())?;
        for file_path in root_txt_files.iter() {
            let name = file_path.file_stem().and_then(|s| s.to_str()).unwrap_or("Imported");
            let content = fs::read_to_string(&file_path).map_err(|e| format!("Failed to read {}: {}", file_path.display(), e))?;
            let doc = crate::services::docs::create_doc(pool, project.id, name, Some(unsorted.id))
                .map_err(|e| e.to_string())?;
            crate::services::docs::update_doc(pool, doc.id, &content).map_err(|e| e.to_string())?;
        }
    }

    serde_json::to_value(project).map_err(|e| e.to_string())
}