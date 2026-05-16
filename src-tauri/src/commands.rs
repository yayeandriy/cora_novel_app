use std::sync::{Arc, Mutex};
use crate::models::{
    ProjectCreate, Project, ProjectFile,
    Character, Event, Place,
    DraftCreate, DraftUpdate, Draft,
    ProjectDraft, ProjectDraftCreate, ProjectDraftUpdate,
    FolderDraft, FolderDraftCreate, FolderDraftUpdate,
    Timeline, TimelineCreate, TimelineUpdate,
    Archive, ArchiveCreate, ArchiveUpdate,
    ExportPdfOptions,
    Sync, SyncCreate, SyncUpdate, SyncStatus,
    RecentFile, OpenProjectInfo,
};
use std::io::Cursor;
use docx_rs::*;
use tauri::State;
use std::path::Path;
use printpdf::*;

/// Currently open project — swapped when the user opens a different file.
pub struct OpenProject {
    pub path: String,
    pub data: ProjectFile,
    #[cfg(target_os = "macos")]
    pub _scoped_url: Option<objc2::rc::Retained<objc2_foundation::NSURL>>,
}

impl Drop for OpenProject {
    fn drop(&mut self) {
        #[cfg(target_os = "macos")]
        if let Some(url) = &self._scoped_url {
            crate::services::recents::stop_bookmark_access(url);
        }
    }
}

/// Global app state. `project` is `None` on the dashboard (no file open).
#[derive(Clone)]
pub struct AppState {
    pub project: Arc<Mutex<Option<OpenProject>>>,
    /// Tiny recents.db — only `recent_files` table.
    pub recents_pool: crate::db::DbPool,
    /// Pending file path from macOS `RunEvent::Opened` (Finder double-click).
    pub pending_open_file: Arc<Mutex<Option<String>>>,
    /// FSEvents watcher for iCloud Drive changes.
    pub icloud_watcher: crate::services::icloud_watcher::ICloudWatcher,
}

impl AppState {
    /// Returns the path of the currently open project file.
    pub fn get_project_path(&self) -> Result<String, String> {
        self.project
            .lock()
            .map_err(|e| e.to_string())?
            .as_ref()
            .map(|p| p.path.clone())
            .ok_or_else(|| "No project is currently open.".to_string())
    }

    /// Read-only access to the in-memory ProjectFile.
    pub fn read_project<T, F: FnOnce(&ProjectFile) -> T>(&self, f: F) -> Result<T, String> {
        let guard = self.project.lock().map_err(|e| e.to_string())?;
        let open = guard.as_ref().ok_or_else(|| "No project is currently open. Please open or create a project.".to_string())?;
        Ok(f(&open.data))
    }

    /// Mutable access to the in-memory ProjectFile. Saves to disk after a successful mutation.
    pub fn mutate_project<T, F: FnOnce(&mut ProjectFile) -> Result<T, String>>(&self, f: F) -> Result<T, String> {
        let mut guard = self.project.lock().map_err(|e| e.to_string())?;
        let open = guard.as_mut().ok_or_else(|| "No project is currently open. Please open or create a project.".to_string())?;
        let result = f(&mut open.data)?;
        crate::services::file_store::save_project(Path::new(&open.path), &open.data)
            .map_err(|e| e.to_string())?;
        Ok(result)
    }
}

// ─── File / project lifecycle commands ───────────────────────────────────────

#[tauri::command]
pub async fn file_new_project(
    state: State<'_, AppState>,
    path: String,
    name: String,
) -> Result<OpenProjectInfo, String> {
    let dest = if path.ends_with(".cora") { path.clone() } else { format!("{}.cora", path) };

    // Create a new in-memory project file with initial content.
    let mut data = crate::services::file_store::new_project_file(&name, &dest);
    let project_id_val = data.project.id;
    let folder = crate::services::doc_groups::create_doc_group(&mut data, project_id_val, "Part I", None);
    let _doc = crate::services::docs::create_doc(&mut data, project_id_val, "Chapter One", Some(folder.id));

    // Save to disk.
    crate::services::file_store::save_project(Path::new(&dest), &data)
        .map_err(|e| e.to_string())?;

    // Add to recents.
    crate::services::recents::touch(&state.recents_pool, &dest, &name)
        .map_err(|e| e.to_string())?;

    let project_id = data.project.id;
    *state.project.lock().map_err(|e| e.to_string())? = Some(OpenProject {
        path: dest.clone(),
        data,
        #[cfg(target_os = "macos")]
        _scoped_url: None,
    });

    Ok(OpenProjectInfo { path: dest, project_id, name })
}

#[tauri::command]
pub async fn file_open_project(
    state: State<'_, AppState>,
    path: String,
) -> Result<OpenProjectInfo, String> {
    let project_path_buf = std::path::PathBuf::from(&path);

    // Handle iCloud eviction: if real file is missing but placeholder exists, trigger download.
    if !project_path_buf.exists() {
        let placeholder = project_path_buf
            .parent()
            .zip(project_path_buf.file_name())
            .map(|(parent, name)| parent.join(format!(".{}.icloud", name.to_string_lossy())));

        if placeholder.as_ref().map_or(false, |p| p.exists()) {
            let _ = crate::services::icloud::trigger_download(&project_path_buf);
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(30);
            loop {
                std::thread::sleep(std::time::Duration::from_millis(500));
                if project_path_buf.exists() { break; }
                if std::time::Instant::now() >= deadline {
                    return Err(
                        "The project file is downloading from iCloud but is taking too long. \
                         Please wait for it to finish downloading in Finder, then try again.".into()
                    );
                }
            }
        } else {
            let _ = crate::services::recents::remove(&state.recents_pool, &path);
            return Err(format!("File not found: {}", path));
        }
    }

    // On macOS, resolve security-scoped bookmark to regain sandbox access.
    #[cfg(target_os = "macos")]
    let scoped_url = {
        let bookmark_bytes = crate::services::recents::get_bookmark(&state.recents_pool, &path)
            .unwrap_or(None);
        if let Some(bytes) = bookmark_bytes {
            crate::services::recents::start_bookmark_access(&bytes)
        } else {
            None
        }
    };

    let path_for_task = path.clone();
    let open_result = tokio::time::timeout(
        std::time::Duration::from_secs(10),
        tokio::task::spawn_blocking(move || -> Result<ProjectFile, String> {
            let p = Path::new(&path_for_task);
            if crate::services::file_store::is_zip_file(p) {
                crate::services::file_store::migrate_zip_to_json(p).map_err(|e| e.to_string())
            } else if crate::services::file_store::is_sqlite_file(p) {
                crate::services::file_store::migrate_sqlite_to_json(p)
                    .map_err(|e| format!("Failed to migrate legacy .cora file: {e:#}"))
            } else {
                crate::services::file_store::load_project(p).map_err(|e| e.to_string())
            }
        }),
    )
    .await;

    let mut data = match open_result {
        Err(_elapsed) => return Err(
            "The file took too long to open. It may still be downloading from iCloud. \
             Open Finder, wait for the file to download, then try again.".into()
        ),
        Ok(Err(join_err)) => return Err(format!("Internal error: {join_err}")),
        Ok(Ok(Err(e))) => return Err(e),
        Ok(Ok(Ok(v))) => v,
    };

    // If migrated from an old format, save the new JSON format.
    let p = Path::new(&path);
    if crate::services::file_store::is_zip_file(p) || crate::services::file_store::is_sqlite_file(p) {
        crate::services::file_store::save_project(p, &data).map_err(|e| e.to_string())?;
    }

    // Ensure the stored path matches the actual file path.
    data.project.path = Some(path.clone());

    let name = data.project.name.clone();
    let project_id = data.project.id;

    crate::services::recents::touch(&state.recents_pool, &path, &name)
        .map_err(|e| e.to_string())?;

    *state.project.lock().map_err(|e| e.to_string())? = Some(OpenProject {
        path: path.clone(),
        data,
        #[cfg(target_os = "macos")]
        _scoped_url: scoped_url,
    });

    Ok(OpenProjectInfo { path, project_id, name })
}

#[tauri::command]
pub async fn file_close_project(state: State<'_, AppState>) -> Result<(), String> {
    *state.project.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

#[tauri::command]
pub async fn file_get_open_project(state: State<'_, AppState>) -> Result<Option<OpenProjectInfo>, String> {
    let guard = state.project.lock().map_err(|e| e.to_string())?;
    let Some(open) = guard.as_ref() else { return Ok(None); };
    Ok(Some(OpenProjectInfo {
        path: open.path.clone(),
        project_id: open.data.project.id,
        name: open.data.project.name.clone(),
    }))
}

#[tauri::command]
pub async fn file_checkpoint(state: State<'_, AppState>) -> Result<(), String> {
    // In the JSON architecture, saving is done on every mutation. This is a no-op.
    let _ = &state;
    Ok(())
}

#[tauri::command]
pub async fn file_save_as(
    state: State<'_, AppState>,
    path: String,
) -> Result<OpenProjectInfo, String> {
    let dest = if path.ends_with(".cora") { path.clone() } else { format!("{}.cora", path) };
    let dest_path = Path::new(&dest);

    // Clone current data and save to new path.
    let (mut data, name) = {
        let guard = state.project.lock().map_err(|e| e.to_string())?;
        let open = guard.as_ref().ok_or("No project is currently open.")?;
        (open.data.clone(), open.data.project.name.clone())
    };

    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Cannot create destination directory: {e}"))?;
    }

    data.project.path = Some(dest.clone());
    crate::services::file_store::save_project(dest_path, &data)
        .map_err(|e| format!("Failed to save project file: {e}"))?;

    let project_id = data.project.id;
    *state.project.lock().map_err(|e| e.to_string())? = Some(OpenProject {
        path: dest.clone(),
        data,
        #[cfg(target_os = "macos")]
        _scoped_url: None,
    });

    crate::services::recents::touch(&state.recents_pool, &dest, &name)
        .map_err(|e| e.to_string())?;

    Ok(OpenProjectInfo { path: dest, project_id, name })
}

// ─── Recents commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn recents_list(state: State<'_, AppState>) -> Result<Vec<RecentFile>, String> {
    crate::services::recents::list(&state.recents_pool).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn recents_remove(state: State<'_, AppState>, path: String) -> Result<(), String> {
    crate::services::recents::remove(&state.recents_pool, &path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_pending_open_file(state: State<'_, AppState>) -> Result<Option<String>, String> {
    let mut pending = state.pending_open_file.lock().map_err(|e| e.to_string())?;
    Ok(pending.take())
}

// ─── Project commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn project_create(state: State<'_, AppState>, _payload: ProjectCreate) -> Result<Project, String> {
    // In the new architecture each file IS the project; return the current project.
    state.read_project(|data| crate::services::projects::get(data))
}

#[tauri::command]
pub async fn project_get(state: State<'_, AppState>, _id: i64) -> Result<Option<Project>, String> {
    state.read_project(|data| Some(crate::services::projects::get(data)))
}

#[tauri::command]
pub async fn project_list(state: State<'_, AppState>) -> Result<Vec<Project>, String> {
    state.read_project(|data| vec![crate::services::projects::get(data)])
}

#[tauri::command]
pub async fn project_update(state: State<'_, AppState>, _id: i64, changes: Option<serde_json::Value>) -> Result<Project, String> {
    let name = changes.as_ref().and_then(|c| c.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()));
    let desc = changes.as_ref().and_then(|c| c.get("desc").and_then(|v| v.as_str()).map(|s| s.to_string()));
    let path = changes.as_ref().and_then(|c| c.get("path").and_then(|v| v.as_str()).map(|s| s.to_string()));
    let notes = changes.as_ref().and_then(|c| c.get("notes").and_then(|v| v.as_str()).map(|s| s.to_string()));
    state.mutate_project(|data| crate::services::projects::update(data, name, desc, path, notes).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn project_delete(state: State<'_, AppState>, _id: i64) -> Result<bool, String> {
    // Deleting a project in the new architecture means closing it.
    *state.project.lock().map_err(|e| e.to_string())? = None;
    Ok(true)
}

// ─── Doc Group commands ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn doc_group_list(state: State<'_, AppState>, project_id: i64) -> Result<serde_json::Value, String> {
    let groups = state.read_project(|data| crate::services::doc_groups::list_doc_groups(data, project_id))?;
    serde_json::to_value(groups).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_create(state: State<'_, AppState>, project_id: i64, name: String, parent_id: Option<i64>) -> Result<serde_json::Value, String> {
    let group = state.mutate_project(|data| Ok(crate::services::doc_groups::create_doc_group(data, project_id, &name, parent_id)))?;
    serde_json::to_value(group).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_create_after(state: State<'_, AppState>, project_id: i64, name: String, parent_id: Option<i64>, after_sort_order: i64) -> Result<serde_json::Value, String> {
    let group = state.mutate_project(|data| Ok(crate::services::doc_groups::create_doc_group_after(data, project_id, &name, parent_id, after_sort_order)))?;
    serde_json::to_value(group).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::doc_groups::delete_doc_group(data, id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_group_restore(
    state: State<'_, AppState>,
    project_id: i64,
    parent_id: Option<i64>,
    name: String,
    sort_order: i64,
    notes: String,
    docs: Vec<crate::models::DocSnapshot>,
) -> Result<serde_json::Value, String> {
    let group = state.mutate_project(|data| Ok(crate::services::doc_groups::restore_doc_group(data, project_id, parent_id, &name, sort_order, &notes, docs)))?;
    serde_json::to_value(group).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_group_reorder(state: State<'_, AppState>, id: i64, direction: String) -> Result<(), String> {
    state.mutate_project(|data| crate::services::doc_groups::reorder_doc_group(data, id, &direction).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_group_rename(state: State<'_, AppState>, id: i64, new_name: String) -> Result<(), String> {
    state.mutate_project(|data| crate::services::doc_groups::rename_doc_group(data, id, &new_name).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_group_update_notes(state: State<'_, AppState>, id: i64, notes: String) -> Result<(), String> {
    state.mutate_project(|data| crate::services::doc_groups::update_doc_group_notes(data, id, &notes).map_err(|e| e.to_string()))
}

// ─── Doc commands ─────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn doc_list(state: State<'_, AppState>, project_id: i64) -> Result<serde_json::Value, String> {
    let docs = state.read_project(|data| crate::services::docs::list_docs(data, project_id))?;
    serde_json::to_value(docs).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_get(state: State<'_, AppState>, id: i64) -> Result<serde_json::Value, String> {
    let doc = state.read_project(|data| crate::services::docs::get_doc(data, id))?;
    serde_json::to_value(doc).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_create_new(state: State<'_, AppState>, project_id: i64, name: String, doc_group_id: Option<i64>) -> Result<serde_json::Value, String> {
    let doc = state.mutate_project(|data| Ok(crate::services::docs::create_doc(data, project_id, &name, doc_group_id)))?;
    serde_json::to_value(doc).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_create_after(state: State<'_, AppState>, project_id: i64, name: String, doc_group_id: Option<i64>, after_sort_order: i64) -> Result<serde_json::Value, String> {
    let doc = state.mutate_project(|data| Ok(crate::services::docs::create_doc_after(data, project_id, &name, doc_group_id, after_sort_order)))?;
    serde_json::to_value(doc).map_err(|e| e.to_string())
}

/// Legacy doc_create for import flows (takes a path, optional name, optional text).
#[tauri::command]
pub async fn doc_create(state: State<'_, AppState>, project_id: i64, path: String, name: Option<String>, text: Option<String>) -> Result<serde_json::Value, String> {
    let doc = state.mutate_project(|data| {
        Ok(crate::services::docs::create(data, project_id, &path, name, None, text))
    })?;
    serde_json::to_value(doc).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_update_text(state: State<'_, AppState>, id: i64, text: String) -> Result<(), String> {
    state.mutate_project(|data| crate::services::docs::update_doc(data, id, &text).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_update_notes(state: State<'_, AppState>, id: i64, notes: String) -> Result<(), String> {
    state.mutate_project(|data| crate::services::docs::update_doc_notes(data, id, &notes).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::docs::delete_doc(data, id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_restore(
    state: State<'_, AppState>,
    project_id: i64,
    doc_group_id: Option<i64>,
    name: String,
    sort_order: i64,
    text: String,
    notes: String,
) -> Result<serde_json::Value, String> {
    let doc = state.mutate_project(|data| Ok(crate::services::docs::restore_doc(data, project_id, doc_group_id, &name, sort_order, &text, &notes)))?;
    serde_json::to_value(doc).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn doc_reorder(state: State<'_, AppState>, id: i64, direction: String) -> Result<(), String> {
    state.mutate_project(|data| crate::services::docs::reorder_doc(data, id, &direction).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_move_to_group(state: State<'_, AppState>, doc_id: i64, new_group_id: Option<i64>) -> Result<(), String> {
    state.mutate_project(|data| crate::services::docs::move_doc_to_group(data, doc_id, new_group_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_rename(state: State<'_, AppState>, id: i64, new_name: String) -> Result<(), String> {
    state.mutate_project(|data| crate::services::docs::rename_doc(data, id, &new_name).map_err(|e| e.to_string()))
}

// ─── Character commands ───────────────────────────────────────────────────────

#[tauri::command]
pub async fn character_create(state: State<'_, AppState>, project_id: i64, name: String, desc: Option<String>) -> Result<Character, String> {
    state.mutate_project(|data| Ok(crate::services::characters::create(data, project_id, &name, desc)))
}

#[tauri::command]
pub async fn character_list(state: State<'_, AppState>, project_id: i64) -> Result<Vec<Character>, String> {
    state.read_project(|data| crate::services::characters::list(data, project_id))
}

#[tauri::command]
pub async fn character_update(state: State<'_, AppState>, id: i64, changes: Option<serde_json::Value>) -> Result<Character, String> {
    let name = changes.as_ref().and_then(|c| c.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()));
    let desc = changes.as_ref().and_then(|c| c.get("desc").and_then(|v| v.as_str()).map(|s| s.to_string()));
    state.mutate_project(|data| crate::services::characters::update(data, id, name, desc).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn character_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::characters::delete_(data, id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_character_list(state: State<'_, AppState>, doc_id: i64) -> Result<Vec<i64>, String> {
    state.read_project(|data| crate::services::characters::list_for_doc(data, doc_id))
}

#[tauri::command]
pub async fn doc_character_attach(state: State<'_, AppState>, doc_id: i64, character_id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::characters::attach_to_doc(data, doc_id, character_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_character_detach(state: State<'_, AppState>, doc_id: i64, character_id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::characters::detach_from_doc(data, doc_id, character_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_group_character_list(state: State<'_, AppState>, doc_group_id: i64) -> Result<Vec<i64>, String> {
    state.read_project(|data| crate::services::characters::list_for_doc_group(data, doc_group_id))
}

#[tauri::command]
pub async fn doc_group_characters_from_docs(state: State<'_, AppState>, doc_group_id: i64) -> Result<Vec<i64>, String> {
    state.read_project(|data| crate::services::characters::list_from_docs_in_group(data, doc_group_id))
}

#[tauri::command]
pub async fn doc_group_character_attach(state: State<'_, AppState>, doc_group_id: i64, character_id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::characters::attach_to_doc_group(data, doc_group_id, character_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_group_character_detach(state: State<'_, AppState>, doc_group_id: i64, character_id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::characters::detach_from_doc_group(data, doc_group_id, character_id).map_err(|e| e.to_string()))
}

// ─── Event commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn event_create(state: State<'_, AppState>, project_id: i64, name: String, desc: Option<String>, start_date: Option<String>, end_date: Option<String>, _date: Option<String>) -> Result<Event, String> {
    state.mutate_project(|data| {
        let event = crate::services::events::create(data, project_id, &name, desc);
        // If date range provided, upsert a timeline entry for this event.
        if start_date.is_some() || end_date.is_some() {
            let payload = TimelineCreate {
                entity_type: "event".to_string(),
                entity_id: event.id,
                start_date: start_date.clone(),
                end_date: end_date.clone(),
            };
            crate::services::timelines::create_timeline(data, payload);
        }
        Ok(event)
    })
}

#[tauri::command]
pub async fn event_list(state: State<'_, AppState>, project_id: i64) -> Result<Vec<Event>, String> {
    state.read_project(|data| crate::services::events::list(data, project_id))
}

#[tauri::command]
pub async fn event_update(state: State<'_, AppState>, id: i64, changes: Option<serde_json::Value>) -> Result<Event, String> {
    let name = changes.as_ref().and_then(|c| c.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()));
    let desc = changes.as_ref().and_then(|c| c.get("desc").and_then(|v| v.as_str()).map(|s| s.to_string()));
    state.mutate_project(|data| crate::services::events::update(data, id, name, desc).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn event_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::events::delete_(data, id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_event_list(state: State<'_, AppState>, doc_id: i64) -> Result<Vec<i64>, String> {
    state.read_project(|data| crate::services::events::list_for_doc(data, doc_id))
}

#[tauri::command]
pub async fn doc_event_attach(state: State<'_, AppState>, doc_id: i64, event_id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::events::attach_to_doc(data, doc_id, event_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_event_detach(state: State<'_, AppState>, doc_id: i64, event_id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::events::detach_from_doc(data, doc_id, event_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_group_event_list(state: State<'_, AppState>, doc_group_id: i64) -> Result<Vec<i64>, String> {
    state.read_project(|data| crate::services::events::list_for_doc_group(data, doc_group_id))
}

#[tauri::command]
pub async fn doc_group_events_from_docs(state: State<'_, AppState>, doc_group_id: i64) -> Result<Vec<i64>, String> {
    state.read_project(|data| crate::services::events::list_from_docs_in_group(data, doc_group_id))
}

#[tauri::command]
pub async fn doc_group_event_attach(state: State<'_, AppState>, doc_group_id: i64, event_id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::events::attach_to_doc_group(data, doc_group_id, event_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_group_event_detach(state: State<'_, AppState>, doc_group_id: i64, event_id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::events::detach_from_doc_group(data, doc_group_id, event_id).map_err(|e| e.to_string()))
}

// ─── Place commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn place_create(state: State<'_, AppState>, project_id: i64, name: String, desc: Option<String>) -> Result<Place, String> {
    state.mutate_project(|data| Ok(crate::services::places::create(data, project_id, &name, desc)))
}

#[tauri::command]
pub async fn place_list(state: State<'_, AppState>, project_id: i64) -> Result<Vec<Place>, String> {
    state.read_project(|data| crate::services::places::list(data, project_id))
}

#[tauri::command]
pub async fn place_update(state: State<'_, AppState>, id: i64, changes: Option<serde_json::Value>) -> Result<Place, String> {
    let name = changes.as_ref().and_then(|c| c.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()));
    let desc = changes.as_ref().and_then(|c| c.get("desc").and_then(|v| v.as_str()).map(|s| s.to_string()));
    state.mutate_project(|data| crate::services::places::update(data, id, name, desc).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn place_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::places::delete_(data, id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_place_list(state: State<'_, AppState>, doc_id: i64) -> Result<Vec<i64>, String> {
    state.read_project(|data| crate::services::places::list_for_doc(data, doc_id))
}

#[tauri::command]
pub async fn doc_place_attach(state: State<'_, AppState>, doc_id: i64, place_id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::places::attach_to_doc(data, doc_id, place_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_place_detach(state: State<'_, AppState>, doc_id: i64, place_id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::places::detach_from_doc(data, doc_id, place_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_group_place_list(state: State<'_, AppState>, doc_group_id: i64) -> Result<Vec<i64>, String> {
    state.read_project(|data| crate::services::places::list_for_doc_group(data, doc_group_id))
}

#[tauri::command]
pub async fn doc_group_places_from_docs(state: State<'_, AppState>, doc_group_id: i64) -> Result<Vec<i64>, String> {
    state.read_project(|data| crate::services::places::list_from_docs_in_group(data, doc_group_id))
}

#[tauri::command]
pub async fn doc_group_place_attach(state: State<'_, AppState>, doc_group_id: i64, place_id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::places::attach_to_doc_group(data, doc_group_id, place_id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn doc_group_place_detach(state: State<'_, AppState>, doc_group_id: i64, place_id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::places::detach_from_doc_group(data, doc_group_id, place_id).map_err(|e| e.to_string()))
}

// ─── Archive commands ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn archive_create(state: State<'_, AppState>, project_id: i64, payload: ArchiveCreate) -> Result<Archive, String> {
    state.mutate_project(|data| Ok(crate::services::archives::create(data, project_id, payload)))
}

#[tauri::command]
pub async fn archive_list(state: State<'_, AppState>, project_id: i64) -> Result<Vec<Archive>, String> {
    state.read_project(|data| crate::services::archives::list(data, project_id))
}

#[tauri::command]
pub async fn archive_get(state: State<'_, AppState>, id: i64) -> Result<Option<Archive>, String> {
    state.read_project(|data| crate::services::archives::get(data, id))
}

#[tauri::command]
pub async fn archive_update(state: State<'_, AppState>, id: i64, payload: ArchiveUpdate) -> Result<Archive, String> {
    state.mutate_project(|data| crate::services::archives::update(data, id, payload).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn archive_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::archives::delete_(data, id).map_err(|e| e.to_string()))
}

// ─── Draft commands ───────────────────────────────────────────────────────────

#[tauri::command]
pub async fn draft_create(state: State<'_, AppState>, doc_id: i64, payload: DraftCreate) -> Result<Draft, String> {
    state.mutate_project(|data| Ok(crate::services::drafts::create_draft(data, doc_id, payload)))
}

#[tauri::command]
pub async fn draft_get(state: State<'_, AppState>, id: i64) -> Result<Option<Draft>, String> {
    state.read_project(|data| crate::services::drafts::get_draft(data, id))
}

#[tauri::command]
pub async fn draft_list(state: State<'_, AppState>, doc_id: i64) -> Result<Vec<Draft>, String> {
    state.read_project(|data| crate::services::drafts::list_drafts(data, doc_id))
}

#[tauri::command]
pub async fn draft_update(state: State<'_, AppState>, id: i64, payload: DraftUpdate) -> Result<Draft, String> {
    state.mutate_project(|data| crate::services::drafts::update_draft(data, id, payload).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn draft_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::drafts::delete_draft(data, id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn draft_restore(state: State<'_, AppState>, doc_id: i64, payload: DraftCreate) -> Result<Draft, String> {
    state.mutate_project(|data| Ok(crate::services::drafts::restore_draft(data, doc_id, payload)))
}

#[tauri::command]
pub async fn draft_delete_all(state: State<'_, AppState>, doc_id: i64) -> Result<(), String> {
    state.mutate_project(|data| { crate::services::drafts::delete_all_for_doc(data, doc_id); Ok(()) })
}

// ─── Project Draft commands ───────────────────────────────────────────────────

#[tauri::command]
pub async fn project_draft_create(state: State<'_, AppState>, project_id: i64, payload: ProjectDraftCreate) -> Result<ProjectDraft, String> {
    state.mutate_project(|data| Ok(crate::services::project_drafts::create(data, project_id, payload)))
}

#[tauri::command]
pub async fn project_draft_get(state: State<'_, AppState>, id: i64) -> Result<Option<ProjectDraft>, String> {
    state.read_project(|data| crate::services::project_drafts::get(data, id))
}

#[tauri::command]
pub async fn project_draft_list(state: State<'_, AppState>, project_id: i64) -> Result<Vec<ProjectDraft>, String> {
    state.read_project(|data| crate::services::project_drafts::list(data, project_id))
}

#[tauri::command]
pub async fn project_draft_update(state: State<'_, AppState>, id: i64, payload: ProjectDraftUpdate) -> Result<ProjectDraft, String> {
    state.mutate_project(|data| crate::services::project_drafts::update(data, id, payload).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn project_draft_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::project_drafts::delete_(data, id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn project_draft_delete_all(state: State<'_, AppState>, project_id: i64) -> Result<(), String> {
    state.mutate_project(|data| { crate::services::project_drafts::delete_all_for_project(data, project_id); Ok(()) })
}

// ─── Folder Draft commands ────────────────────────────────────────────────────

#[tauri::command]
pub async fn folder_draft_create(state: State<'_, AppState>, doc_group_id: i64, payload: FolderDraftCreate) -> Result<FolderDraft, String> {
    state.mutate_project(|data| Ok(crate::services::folder_drafts::create_folder_draft(data, doc_group_id, payload)))
}

#[tauri::command]
pub async fn folder_draft_get(state: State<'_, AppState>, id: i64) -> Result<Option<FolderDraft>, String> {
    state.read_project(|data| crate::services::folder_drafts::get_folder_draft(data, id))
}

#[tauri::command]
pub async fn folder_draft_list(state: State<'_, AppState>, doc_group_id: i64) -> Result<Vec<FolderDraft>, String> {
    state.read_project(|data| crate::services::folder_drafts::list_folder_drafts(data, doc_group_id))
}

#[tauri::command]
pub async fn folder_draft_update(state: State<'_, AppState>, id: i64, payload: FolderDraftUpdate) -> Result<FolderDraft, String> {
    state.mutate_project(|data| crate::services::folder_drafts::update_folder_draft(data, id, payload).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn folder_draft_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::folder_drafts::delete_folder_draft(data, id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn folder_draft_delete_all(state: State<'_, AppState>, doc_group_id: i64) -> Result<(), String> {
    state.mutate_project(|data| { crate::services::folder_drafts::delete_all_for_group(data, doc_group_id); Ok(()) })
}

#[tauri::command]
pub async fn folder_draft_reorder(state: State<'_, AppState>, id: i64, direction: String) -> Result<(), String> {
    state.mutate_project(|data| crate::services::folder_drafts::reorder(data, id, &direction).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn folder_draft_move(state: State<'_, AppState>, id: i64, doc_group_id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::folder_drafts::move_folder_draft(data, id, doc_group_id).map(|_| ()).map_err(|e| e.to_string()))
}

// ─── Timeline commands ────────────────────────────────────────────────────────

#[tauri::command]
pub async fn timeline_create(state: State<'_, AppState>, payload: TimelineCreate) -> Result<Timeline, String> {
    state.mutate_project(|data| Ok(crate::services::timelines::create_timeline(data, payload)))
}

#[tauri::command]
pub async fn timeline_get(state: State<'_, AppState>, id: i64) -> Result<Option<Timeline>, String> {
    state.read_project(|data| crate::services::timelines::get_timeline(data, id))
}

#[tauri::command]
pub async fn timeline_get_by_entity(state: State<'_, AppState>, entity_type: String, entity_id: i64) -> Result<Option<Timeline>, String> {
    state.read_project(|data| crate::services::timelines::get_timeline_by_entity(data, &entity_type, entity_id))
}

#[tauri::command]
pub async fn timeline_list(state: State<'_, AppState>, _project_id: i64) -> Result<Vec<Timeline>, String> {
    state.read_project(|data| crate::services::timelines::list_timelines(data, 0))
}

#[tauri::command]
pub async fn timeline_update(state: State<'_, AppState>, id: i64, payload: TimelineUpdate) -> Result<Timeline, String> {
    state.mutate_project(|data| crate::services::timelines::update_timeline(data, id, payload).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn timeline_delete(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::timelines::delete_timeline(data, id).map_err(|e| e.to_string()))
}

#[tauri::command]
pub async fn timeline_delete_by_entity(state: State<'_, AppState>, entity_type: String, entity_id: i64) -> Result<(), String> {
    state.mutate_project(|data| crate::services::timelines::delete_timeline_by_entity(data, &entity_type, entity_id).map_err(|e| e.to_string()))
}

// ─── Import commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn import_txt_files(state: State<'_, AppState>, project_id: i64, doc_group_id: i64, files: Vec<String>) -> Result<usize, String> {
    let mut imported = 0usize;

    for p in files {
        let path = Path::new(&p);
        if path.is_file() {
            if path.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("txt")).unwrap_or(false) {
                let name = path.file_stem().and_then(|s| s.to_str()).unwrap_or("Imported").to_string();
                let content = std::fs::read_to_string(path).map_err(|e| format!("Failed to read {}: {}", p, e))?;
                state.mutate_project(|data| {
                    let doc = crate::services::docs::create_doc(data, project_id, &name, Some(doc_group_id));
                    crate::services::docs::update_doc(data, doc.id, &content).map_err(|e| e.to_string())
                })?;
                imported += 1;
            }
            continue;
        }

        if path.is_dir() {
            let group_name = path.file_name().and_then(|s| s.to_str()).unwrap_or("Imported Folder").to_string();
            let group_id = state.mutate_project(|data| Ok(crate::services::doc_groups::create_doc_group(data, project_id, &group_name, None).id))?;

            let entries = std::fs::read_dir(path).map_err(|e| format!("Failed to read dir {}: {}", p, e))?;
            for entry in entries {
                let entry = entry.map_err(|e| e.to_string())?;
                let entry_path = entry.path();
                if entry_path.is_file() && entry_path.extension().and_then(|e| e.to_str()).map(|e| e.eq_ignore_ascii_case("txt")).unwrap_or(false) {
                    let name = entry_path.file_stem().and_then(|s| s.to_str()).unwrap_or("Imported").to_string();
                    let content = std::fs::read_to_string(&entry_path).map_err(|e| format!("Failed to read {}: {}", entry_path.display(), e))?;
                    state.mutate_project(|data| {
                        let doc = crate::services::docs::create_doc(data, project_id, &name, Some(group_id));
                        crate::services::docs::update_doc(data, doc.id, &content).map_err(|e| e.to_string())
                    })?;
                    imported += 1;
                }
            }
        }
    }

    Ok(imported)
}

#[tauri::command]
pub async fn import_project(_state: State<'_, AppState>, _folder_path: String) -> Result<serde_json::Value, String> {
    Err("import_project is not supported; use file_open_project to open a .cora file.".to_string())
}

// ─── Export commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn export_project(state: State<'_, AppState>, _project_id: i64, dest_path: String) -> Result<(), String> {
    use std::io::Write;
    use zip::write::FileOptions;

    let zip_path = if dest_path.ends_with(".cora") {
        dest_path
    } else if dest_path.ends_with(".zip") {
        dest_path.replace(".zip", ".cora")
    } else {
        format!("{}.cora", dest_path)
    };

    let (project, groups, docs, drafts) = state.read_project(|data| {
        (data.project.clone(), data.groups.clone(), data.docs.clone(), data.drafts.clone())
    })?;

    use std::collections::HashMap;
    let mut children: HashMap<Option<i64>, Vec<usize>> = HashMap::new();
    for (i, g) in groups.iter().enumerate() {
        children.entry(g.parent_id).or_default().push(i);
    }
    for v in children.values_mut() {
        v.sort_by_key(|&i| groups[i].sort_order.unwrap_or(0));
    }
    let mut docs_by_group: HashMap<i64, Vec<usize>> = HashMap::new();
    for (i, d) in docs.iter().enumerate() {
        if let Some(gid) = d.doc_group_id { docs_by_group.entry(gid).or_default().push(i); }
    }
    for v in docs_by_group.values_mut() { v.sort_by_key(|&i| docs[i].sort_order.unwrap_or(0)); }

    fn sanitize(s: &str) -> String {
        let mut out = s.trim().to_string();
        if out.is_empty() { out = "Untitled".into(); }
        let bad = ['/', '\\', ':', '*', '?', '"', '<', '>', '|'];
        out.chars().map(|c| if bad.contains(&c) { '_' } else { c }).collect()
    }

    let file = std::fs::File::create(&zip_path)
        .map_err(|e| format!("Failed to create zip file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o755);

    fn export_group_recursive(
        zip: &mut zip::ZipWriter<std::fs::File>,
        options: FileOptions,
        base_path: &str,
        group_idx: usize,
        group_index: usize,
        groups: &[crate::models::DocGroup],
        docs: &[crate::models::Doc],
        drafts: &[crate::models::Draft],
        children: &HashMap<Option<i64>, Vec<usize>>,
        docs_by_group: &HashMap<i64, Vec<usize>>,
    ) -> Result<(), String> {
        let group = &groups[group_idx];
        let dir_name = format!("{} {}", group_index, sanitize(&group.name));
        let group_path = format!("{}/{}", base_path, dir_name);

        if let Some(didxs) = docs_by_group.get(&group.id) {
            for (i, &di) in didxs.iter().enumerate() {
                let d = &docs[di];
                let doc_index = format!("{}.{}", group_index, i + 1);
                let doc_name = sanitize(d.name.as_deref().unwrap_or("Untitled"));
                let file_name = format!("{} {}.txt", doc_index, doc_name);
                let file_path = format!("{}/{}", group_path, file_name);
                let content = d.text.clone().unwrap_or_default();
                zip.start_file(&file_path, options).map_err(|e| format!("zip start_file: {}", e))?;
                zip.write_all(content.as_bytes()).map_err(|e| format!("zip write: {}", e))?;

                let doc_drafts: Vec<&crate::models::Draft> = drafts.iter().filter(|dr| dr.doc_id == d.id).collect();
                for (k, draft) in doc_drafts.iter().enumerate() {
                    let draft_path = format!("{}/{} {} draft-{}.txt", group_path, doc_index, doc_name, k + 1);
                    zip.start_file(&draft_path, options).map_err(|e| format!("zip start draft: {}", e))?;
                    zip.write_all(draft.content.as_bytes()).map_err(|e| format!("zip write draft: {}", e))?;
                }
            }
        }

        if let Some(child_idxs) = children.get(&Some(group.id)) {
            for (ci, &child_idx) in child_idxs.iter().enumerate() {
                export_group_recursive(zip, options, &group_path, child_idx, ci + 1, groups, docs, drafts, children, docs_by_group)?;
            }
        }
        Ok(())
    }

    let base_name = sanitize(&project.name);
    if let Some(root_idxs) = children.get(&None) {
        for (gi, &gi_idx) in root_idxs.iter().enumerate() {
            export_group_recursive(&mut zip, options, &base_name, gi_idx, gi + 1, &groups, &docs, &drafts, &children, &docs_by_group)?;
        }
    }

    // Write metadata.json
    let meta = serde_json::json!({
        "meta": { "app": "cora", "version": 2, "exported_at": chrono::Utc::now().to_rfc3339() },
        "project": project,
        "groups": groups,
        "docs": docs,
    });
    let meta_json = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    let meta_path = format!("{}/metadata.json", base_name);
    zip.start_file(&meta_path, options).map_err(|e| format!("zip start metadata: {}", e))?;
    zip.write_all(meta_json.as_bytes()).map_err(|e| format!("zip write metadata: {}", e))?;
    zip.finish().map_err(|e| format!("Failed to finalize zip: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn export_project_to_pdf(state: State<'_, AppState>, _project_id: i64, dest_path: String, options: Option<ExportPdfOptions>) -> Result<(), String> {
    let (project, mut groups, mut docs) = state.read_project(|data| {
        let mut g = data.groups.clone();
        g.sort_by_key(|x| x.sort_order.unwrap_or(0));
        let mut d = data.docs.clone();
        d.sort_by_key(|x| x.sort_order.unwrap_or(0));
        (data.project.clone(), g, d)
    })?;

    let font_size = options.as_ref().and_then(|o| o.font_size.as_deref()).unwrap_or("small");
    let font_style = options.as_ref().and_then(|o| o.font_style.as_deref()).unwrap_or("serif");
    let line_space = options.as_ref().and_then(|o| o.line_space.as_deref()).unwrap_or("small");
    let chapter_mode = options.as_ref().and_then(|o| o.chapter_mode.as_deref()).unwrap_or("all");
    let range_part_id = options.as_ref().and_then(|o| o.range_part_id);
    let range_start = options.as_ref().and_then(|o| o.range_start).unwrap_or(1).max(1);
    let range_end = options.as_ref().and_then(|o| o.range_end).unwrap_or(range_start).max(range_start);

    if chapter_mode == "range" {
        let target_group_id = range_part_id.or_else(|| groups.first().map(|g| g.id));
        if let Some(group_id) = target_group_id {
            groups.retain(|g| g.id == group_id);
            docs.retain(|d| d.doc_group_id == Some(group_id));
            let start_idx = (range_start - 1) as usize;
            let end_idx = range_end as usize;
            docs = docs.into_iter().enumerate().filter(|(i, _)| *i >= start_idx && *i < end_idx).map(|(_, d)| d).collect();
        }
    }

    let page_width = Mm(210.0);
    let page_height = Mm(297.0);
    let margin_top = Mm(25.0);
    let margin_bottom = Mm(25.0);
    let margin_left = Mm(25.0);
    let header_height = Mm(10.0);
    let footer_height = Mm(10.0);
    let text_area_width = page_width - margin_left - Mm(25.0);
    let text_start_y = page_height - margin_top - header_height;
    let text_end_y = margin_bottom + footer_height;

    let body_size: f32 = match font_size { "medium" => 12.5, "large" => 14.0, _ => 11.0 };
    let scale = body_size / 11.0;
    let title_size = 24.0 * scale;
    let part_size = 18.0 * scale;
    let chapter_size = 14.0 * scale;
    let header_size = 9.0 * scale;
    let footer_size = 9.0 * scale;
    let body_line_height = match line_space { "medium" => Mm(6.0), "large" => Mm(7.0), _ => Mm(5.0) };
    let paragraph_spacing = match line_space { "medium" => Mm(4.0), "large" => Mm(5.0), _ => Mm(3.0) };

    let base_char_width_mm = 2.0 * (body_size / 11.0);
    let avg_char_width_mm = match font_style { "mono" => base_char_width_mm * 1.18, _ => base_char_width_mm };
    let max_chars = (text_area_width.0 / avg_char_width_mm) as usize;

    let (doc, page1, layer1) = PdfDocument::new(&project.name, page_width, page_height, "Layer 1");

    let (font_paths, bold_font_paths, fallback_font, fallback_font_bold) = match font_style {
        "mono" => (
            vec!["/System/Library/Fonts/Supplemental/Courier New.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"],
            vec!["/System/Library/Fonts/Supplemental/Courier New Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"],
            BuiltinFont::Courier, BuiltinFont::CourierBold,
        ),
        "sans" => (
            vec!["/System/Library/Fonts/Supplemental/Arial.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"],
            vec!["/System/Library/Fonts/Supplemental/Arial Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"],
            BuiltinFont::Helvetica, BuiltinFont::HelveticaBold,
        ),
        _ => (
            vec!["/System/Library/Fonts/Supplemental/Times New Roman.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf"],
            vec!["/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"],
            BuiltinFont::TimesRoman, BuiltinFont::TimesBold,
        ),
    };

    let font_data = font_paths.iter().find_map(|p| std::fs::read(p).ok());
    let bold_font_data = bold_font_paths.iter().find_map(|p| std::fs::read(p).ok());

    let font = if let Some(data) = font_data {
        doc.add_external_font(Cursor::new(data)).map_err(|e| e.to_string())?
    } else {
        doc.add_builtin_font(fallback_font).map_err(|e| e.to_string())?
    };
    let font_bold = if let Some(data) = bold_font_data {
        doc.add_external_font(Cursor::new(data)).map_err(|e| e.to_string())?
    } else {
        doc.add_builtin_font(fallback_font_bold).map_err(|e| e.to_string())?
    };

    let mut page_count = 1i32;
    let mut current_part_name = String::new();
    let mut current_chapter_name = String::new();

    let mut add_new_page = |doc: &PdfDocumentReference, page_num: &mut i32, part_name: &str, chapter_name: &str, font: &IndirectFontRef, font_bold: &IndirectFontRef| -> (PdfPageReference, PdfLayerReference) {
        let (page_idx, layer_idx) = doc.add_page(page_width, page_height, "Layer 1");
        let page = doc.get_page(page_idx);
        let layer = page.get_layer(layer_idx);
        if !part_name.is_empty() || !chapter_name.is_empty() {
            let header_y = page_height - margin_top + Mm(3.0);
            let header_text = if !chapter_name.is_empty() { format!("{} / {}", part_name, chapter_name) } else { part_name.to_string() };
            let max_hc = (text_area_width.0 * 2.5) as usize;
            let truncated = if header_text.len() > max_hc { format!("{}...", &header_text[..max_hc - 3]) } else { header_text };
            layer.use_text(&truncated, header_size, margin_left, header_y, font);
        }
        let footer_y = margin_bottom - Mm(5.0);
        let page_number_text = format!("{}", page_num);
        let number_width = Mm(page_number_text.len() as f32 * 1.5);
        let center_x = (page_width - number_width) / 2.0;
        layer.use_text(&page_number_text, footer_size, center_x, footer_y, font);
        *page_num += 1;
        (page, layer)
    };

    let mut current_page = doc.get_page(page1);
    let mut current_layer = current_page.get_layer(layer1);
    let mut y_position = text_start_y;

    current_layer.use_text(&project.name, title_size, margin_left, y_position, &font_bold);
    y_position = y_position - Mm(15.0);
    let footer_y = margin_bottom - Mm(5.0);
    let center_x = (page_width - Mm(1.5)) / 2.0;
    current_layer.use_text("1", footer_size, center_x, footer_y, &font);
    page_count += 1;

    for group in &groups {
        current_part_name = group.name.clone();
        if y_position < text_end_y + Mm(20.0) {
            let (page, layer) = add_new_page(&doc, &mut page_count, &current_part_name, "", &font, &font_bold);
            current_page = page; current_layer = layer; y_position = text_start_y;
        }
        current_layer.use_text(&group.name, part_size, margin_left, y_position, &font_bold);
        y_position = y_position - Mm(12.0);

        for d in docs.iter().filter(|d| d.doc_group_id == Some(group.id)) {
            current_chapter_name = d.name.clone().unwrap_or_default();
            if y_position < text_end_y + Mm(15.0) {
                let (page, layer) = add_new_page(&doc, &mut page_count, &current_part_name, &current_chapter_name, &font, &font_bold);
                current_page = page; current_layer = layer; y_position = text_start_y;
            }
            current_layer.use_text(&current_chapter_name, chapter_size, margin_left, y_position, &font_bold);
            y_position = y_position - Mm(8.0);

            let content = d.text.clone().unwrap_or_default();
            for paragraph in content.split("\n\n") {
                if paragraph.trim().is_empty() { continue; }
                let mut current_line = String::new();
                for word in paragraph.split_whitespace() {
                    let test_line = if current_line.is_empty() { word.to_string() } else { format!("{} {}", current_line, word) };
                    if test_line.chars().count() > max_chars {
                        if !current_line.is_empty() {
                            if y_position < text_end_y {
                                let (page, layer) = add_new_page(&doc, &mut page_count, &current_part_name, &current_chapter_name, &font, &font_bold);
                                current_page = page; current_layer = layer; y_position = text_start_y;
                            }
                            current_layer.use_text(&current_line, body_size, margin_left, y_position, &font);
                            y_position = y_position - body_line_height;
                        }
                        current_line = word.to_string();
                    } else {
                        current_line = test_line;
                    }
                }
                if !current_line.is_empty() {
                    if y_position < text_end_y {
                        let (page, layer) = add_new_page(&doc, &mut page_count, &current_part_name, &current_chapter_name, &font, &font_bold);
                        current_page = page; current_layer = layer; y_position = text_start_y;
                    }
                    current_layer.use_text(&current_line, body_size, margin_left, y_position, &font);
                    y_position = y_position - body_line_height;
                }
                y_position = y_position - paragraph_spacing;
            }
            y_position = y_position - Mm(5.0);
        }
    }

    let pdf_path = Path::new(&dest_path).join(format!("{}.pdf", project.name));
    doc.save(&mut std::io::BufWriter::new(std::fs::File::create(&pdf_path).map_err(|e| e.to_string())?))
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn export_project_to_word(state: State<'_, AppState>, _project_id: i64, dest_path: String, options: Option<ExportPdfOptions>) -> Result<(), String> {
    let (project, mut groups, mut docs) = state.read_project(|data| {
        let mut g = data.groups.clone();
        g.sort_by_key(|x| x.sort_order.unwrap_or(0));
        let mut d = data.docs.clone();
        d.sort_by_key(|x| x.sort_order.unwrap_or(0));
        (data.project.clone(), g, d)
    })?;

    let font_style = options.as_ref().and_then(|o| o.font_style.as_deref()).unwrap_or("serif");
    let font_size = options.as_ref().and_then(|o| o.font_size.as_deref()).unwrap_or("small");
    let line_space = options.as_ref().and_then(|o| o.line_space.as_deref()).unwrap_or("small");
    let chapter_mode = options.as_ref().and_then(|o| o.chapter_mode.as_deref()).unwrap_or("all");
    let range_part_id = options.as_ref().and_then(|o| o.range_part_id);
    let range_start = options.as_ref().and_then(|o| o.range_start).unwrap_or(1).max(1);
    let range_end = options.as_ref().and_then(|o| o.range_end).unwrap_or(range_start).max(range_start);

    if chapter_mode == "range" {
        let target_group_id = range_part_id.or_else(|| groups.first().map(|g| g.id));
        if let Some(group_id) = target_group_id {
            groups.retain(|g| g.id == group_id);
            docs.retain(|d| d.doc_group_id == Some(group_id));
            let start_idx = (range_start - 1) as usize;
            let end_idx = range_end as usize;
            docs = docs.into_iter().enumerate().filter(|(i, _)| *i >= start_idx && *i < end_idx).map(|(_, d)| d).collect();
        }
    }

    let font_family = match font_style { "mono" => "Courier New", "sans" => "Arial", _ => "Times New Roman" };
    let body_size_pt: f64 = match font_size { "medium" => 12.5, "large" => 14.0, _ => 11.0 };
    let body_size_half_points = (body_size_pt * 2.0).round() as u32;
    let title_size_half_points = (24.0 * (body_size_pt / 11.0) * 2.0).round() as u32;
    let part_size_half_points = (18.0 * (body_size_pt / 11.0) * 2.0).round() as u32;
    let chapter_size_half_points = (14.0 * (body_size_pt / 11.0) * 2.0).round() as u32;
    let line_multiplier: f64 = match line_space { "medium" => 1.5, "large" => 1.8, _ => 1.2 };
    let line_twips = ((body_size_pt * 20.0) * line_multiplier).round() as u32;

    let base_line_spacing = LineSpacing::new().line(line_twips as i32).line_rule(LineSpacingType::Auto);
    let title_after_twips = (line_twips as f64 * 3.0).round() as u32;
    let part_after_twips = (line_twips as f64 * 2.0).round() as u32;
    let chapter_after_twips = (line_twips as f64 * 1.5).round() as u32;
    let title_line_spacing = base_line_spacing.clone().after(title_after_twips);
    let part_line_spacing = base_line_spacing.clone().after(part_after_twips);
    let chapter_line_spacing = base_line_spacing.clone().after(chapter_after_twips);
    let body_line_spacing = base_line_spacing.clone().after(line_twips);

    let make_run = |text: &str, size_half_points: u32, bold: bool| {
        let mut run = Run::new()
            .add_text(text)
            .size(size_half_points as usize)
            .fonts(RunFonts::new().ascii(font_family).hi_ansi(font_family));
        if bold { run = run.bold(); }
        run
    };

    let title_style = Style::new("Title", StyleType::Paragraph).name("Title").size(title_size_half_points as usize).bold().fonts(RunFonts::new().ascii(font_family).hi_ansi(font_family)).line_spacing(title_line_spacing.clone());
    let heading1_style = Style::new("Heading1", StyleType::Paragraph).name("Heading 1").size(part_size_half_points as usize).bold().fonts(RunFonts::new().ascii(font_family).hi_ansi(font_family)).line_spacing(part_line_spacing.clone());
    let heading2_style = Style::new("Heading2", StyleType::Paragraph).name("Heading 2").size(chapter_size_half_points as usize).bold().fonts(RunFonts::new().ascii(font_family).hi_ansi(font_family)).line_spacing(chapter_line_spacing.clone());
    let body_style = Style::new("Body", StyleType::Paragraph).name("Body").size(body_size_half_points as usize).fonts(RunFonts::new().ascii(font_family).hi_ansi(font_family)).line_spacing(body_line_spacing.clone());

    let mut docx = Docx::new().add_style(title_style).add_style(heading1_style).add_style(heading2_style).add_style(body_style);
    docx = docx.add_paragraph(Paragraph::new().style("Title").line_spacing(title_line_spacing.clone()).add_run(make_run(&project.name, title_size_half_points, true)));

    for group in &groups {
        docx = docx.add_paragraph(Paragraph::new().style("Heading1").line_spacing(part_line_spacing.clone()).add_run(make_run(&group.name, part_size_half_points, true)));
        for d in docs.iter().filter(|d| d.doc_group_id == Some(group.id)) {
            let doc_name = d.name.clone().unwrap_or_default();
            docx = docx.add_paragraph(Paragraph::new().style("Heading2").line_spacing(chapter_line_spacing.clone()).add_run(make_run(&doc_name, chapter_size_half_points, true)));
            let content = d.text.clone().unwrap_or_default();
            for paragraph in content.split("\n\n") {
                let clean = paragraph.trim();
                if clean.is_empty() { continue; }
                let text = clean.replace('\n', " ");
                docx = docx.add_paragraph(Paragraph::new().style("Body").line_spacing(body_line_spacing.clone()).add_run(make_run(&text, body_size_half_points, false)));
            }
            docx = docx.add_paragraph(Paragraph::new().line_spacing(base_line_spacing.clone()).add_run(Run::new().add_break(BreakType::Page)));
        }
        docx = docx.add_paragraph(Paragraph::new().line_spacing(base_line_spacing.clone().after(part_after_twips)).align(AlignmentType::Center).add_run(make_run("\u{2726}", body_size_half_points, false)));
    }

    let docx_path = Path::new(&dest_path).join(format!("{}.docx", project.name));
    let file = std::fs::File::create(&docx_path).map_err(|e| e.to_string())?;
    docx.build().pack(file).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn export_project_to_text(state: State<'_, AppState>, _project_id: i64, dest_path: String, options: Option<ExportPdfOptions>) -> Result<(), String> {
    let (project, mut groups, mut docs) = state.read_project(|data| {
        let mut g = data.groups.clone();
        g.sort_by_key(|x| x.sort_order.unwrap_or(0));
        let mut d = data.docs.clone();
        d.sort_by_key(|x| x.sort_order.unwrap_or(0));
        (data.project.clone(), g, d)
    })?;

    let chapter_mode = options.as_ref().and_then(|o| o.chapter_mode.as_deref()).unwrap_or("all");
    let range_part_id = options.as_ref().and_then(|o| o.range_part_id);
    let range_start = options.as_ref().and_then(|o| o.range_start).unwrap_or(1).max(1);
    let range_end = options.as_ref().and_then(|o| o.range_end).unwrap_or(range_start).max(range_start);

    if chapter_mode == "range" {
        let target_group_id = range_part_id.or_else(|| groups.first().map(|g| g.id));
        if let Some(group_id) = target_group_id {
            groups.retain(|g| g.id == group_id);
            docs.retain(|d| d.doc_group_id == Some(group_id));
            let start_idx = (range_start - 1) as usize;
            let end_idx = range_end as usize;
            docs = docs.into_iter().enumerate().filter(|(i, _)| *i >= start_idx && *i < end_idx).map(|(_, d)| d).collect();
        }
    }

    let mut output = String::new();
    output.push_str(&project.name);
    output.push_str("\n\n");

    for group in &groups {
        output.push_str(&group.name);
        output.push_str("\n\n");
        for d in docs.iter().filter(|d| d.doc_group_id == Some(group.id)) {
            output.push_str(d.name.as_deref().unwrap_or(""));
            output.push_str("\n\n");
            let content = d.text.clone().unwrap_or_default();
            for paragraph in content.split("\n\n") {
                let clean = paragraph.trim();
                if clean.is_empty() { continue; }
                let text = clean.replace('\n', " ");
                output.push_str(&text);
                output.push_str("\n\n");
            }
            output.push_str("\n\n\n\n");
        }
    }

    let text_path = Path::new(&dest_path).join(format!("{}.txt", project.name));
    std::fs::write(&text_path, output).map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Sync commands (all stubbed — sync uses the old per-project pool model) ───

#[tauri::command]
pub async fn sync_create(_state: State<'_, AppState>, _payload: SyncCreate) -> Result<Sync, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_get(_state: State<'_, AppState>, _id: i64) -> Result<Option<Sync>, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_get_by_project(_state: State<'_, AppState>, _project_id: i64) -> Result<Option<Sync>, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_list(_state: State<'_, AppState>) -> Result<Vec<Sync>, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_update(_state: State<'_, AppState>, _id: i64, _payload: SyncUpdate) -> Result<Sync, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_delete(_state: State<'_, AppState>, _id: i64) -> Result<(), String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_delete_by_project(_state: State<'_, AppState>, _project_id: i64) -> Result<(), String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_get_status(_state: State<'_, AppState>, _project_id: i64) -> Result<Option<SyncStatus>, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_mark_started(_state: State<'_, AppState>, _project_id: i64) -> Result<Sync, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_mark_completed(_state: State<'_, AppState>, _project_id: i64, _db_hash: String, _file_hash: String) -> Result<Sync, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_mark_failed(_state: State<'_, AppState>, _project_id: i64, _error: String) -> Result<Sync, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_mark_conflict(_state: State<'_, AppState>, _project_id: i64, _conflict_data: String) -> Result<Sync, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_resolve_conflict(_state: State<'_, AppState>, _project_id: i64, _resolution: String) -> Result<Sync, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_reset_retries(_state: State<'_, AppState>, _project_id: i64) -> Result<Sync, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_mark_db_changed(_state: State<'_, AppState>, _project_id: i64) -> Result<Option<Sync>, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_mark_file_changed(_state: State<'_, AppState>, _project_id: i64) -> Result<Option<Sync>, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_get_pending_retries(_state: State<'_, AppState>) -> Result<Vec<Sync>, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_pause(_state: State<'_, AppState>, _project_id: i64) -> Result<Sync, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_resume(_state: State<'_, AppState>, _project_id: i64) -> Result<Sync, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_should_auto_sync(_state: State<'_, AppState>, _project_id: i64) -> Result<bool, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_mark_db_changed_simple(_state: State<'_, AppState>, _project_id: i64) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
pub async fn sync_calculate_hash(_content: Vec<u8>) -> Result<String, String> {
    Err("sync not available".to_string())
}

#[tauri::command]
pub async fn sync_import_to_project(_state: State<'_, AppState>, _project_id: i64, _file_path: String) -> Result<(), String> {
    Err("sync not available".to_string())
}

// ─── iCloud commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn icloud_is_available() -> bool {
    crate::services::icloud::is_available()
}

/// Returns the path of the currently open project file (for iCloud sync use).
#[tauri::command]
pub async fn icloud_get_project_path(state: State<'_, AppState>) -> Result<String, String> {
    state.get_project_path()
}

#[tauri::command]
pub async fn icloud_check_file_status(path: String) -> Result<crate::services::icloud::ICloudFileStatus, String> {
    Ok(crate::services::icloud::check_file_status(Path::new(&path)))
}

#[tauri::command]
pub async fn icloud_trigger_download(path: String) -> Result<(), String> {
    crate::services::icloud::trigger_download(Path::new(&path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn icloud_read_file(path: String) -> Result<Vec<u8>, String> {
    crate::services::icloud::read_file(Path::new(&path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn icloud_write_file(path: String, content: Vec<u8>) -> Result<(), String> {
    crate::services::icloud::write_file(Path::new(&path), &content).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn icloud_scan_documents() -> Vec<crate::services::icloud::ICloudDocInfo> {
    crate::services::icloud::scan_documents()
}

#[tauri::command]
pub async fn icloud_delete_file(path: String) -> Result<(), String> {
    crate::services::icloud::delete_file(Path::new(&path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn icloud_move_file(src_path: String, dest_path: String) -> Result<(), String> {
    crate::services::icloud::move_file_to(Path::new(&src_path), Path::new(&dest_path)).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn icloud_watch_project(state: State<'_, AppState>, project_id: i64, file_path: String) -> Result<(), String> {
    state.icloud_watcher.watch(project_id, std::path::PathBuf::from(file_path));
    Ok(())
}

#[tauri::command]
pub async fn icloud_unwatch_project(state: State<'_, AppState>, project_id: i64) -> Result<(), String> {
    state.icloud_watcher.unwatch(project_id);
    Ok(())
}
