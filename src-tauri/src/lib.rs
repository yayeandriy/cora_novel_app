mod db;
mod models;
mod services {
    pub mod projects;
    pub mod docs;
    pub mod characters;
    pub mod events;
    pub mod places;
    pub mod doc_groups;
    pub mod drafts;
    pub mod project_drafts;
    pub mod folder_drafts;
    pub mod timelines;
    pub mod archives;
    pub mod sync;
    pub mod icloud;
    pub mod icloud_watcher;
    pub mod recents;
    pub mod legacy_migrate;
}
mod commands;

use commands::AppState;
use std::sync::{Arc, Mutex};
use tauri::{Manager, Emitter};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let recents_pool = crate::db::init_recents_pool().expect("failed to init recents db");
    let app_state = AppState {
        project: Arc::new(Mutex::new(None)),
        recents_pool,
        pending_open_file: Arc::new(Mutex::new(None)),
        icloud_watcher: crate::services::icloud_watcher::ICloudWatcher::new(),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .setup(|app| {
            let state = app.state::<AppState>();
            let watcher = state.icloud_watcher.clone();
            watcher.start_watching(app.handle().clone());

            if let Some(win) = app.get_webview_window("main") {
                let _ = win.maximize();
                let _ = win.set_focus();
            }
            Ok(())
        })
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::project_create,
            commands::project_get,
            commands::project_list,
            commands::project_update,
            commands::project_delete,
            commands::doc_create,
            commands::doc_list,
            commands::doc_get,
            commands::doc_create_new,
            commands::doc_create_after,
            commands::doc_update_text,
            commands::doc_update_notes,
            commands::doc_delete,
            commands::doc_restore,
            commands::doc_reorder,
            commands::doc_move_to_group,
            commands::doc_rename,
            commands::doc_group_list,
            commands::doc_group_create,
            commands::doc_group_create_after,
            commands::doc_group_delete,
            commands::doc_group_restore,
            commands::doc_group_reorder,
            commands::doc_group_rename,
            commands::doc_group_update_notes,
            commands::character_create,
            commands::character_list,
            commands::character_update,
            commands::character_delete,
            commands::doc_character_list,
            commands::doc_character_attach,
            commands::doc_character_detach,
            commands::doc_group_character_list,
            commands::doc_group_characters_from_docs,
            commands::doc_group_character_attach,
            commands::doc_group_character_detach,
            commands::event_create,
            commands::event_list,
            commands::event_update,
            commands::event_delete,
            commands::doc_event_list,
            commands::doc_event_attach,
            commands::doc_event_detach,
            commands::doc_group_event_list,
            commands::doc_group_events_from_docs,
            commands::doc_group_event_attach,
            commands::doc_group_event_detach,
            commands::place_create,
            commands::place_list,
            commands::place_update,
            commands::place_delete,
            commands::doc_place_list,
            commands::doc_place_attach,
            commands::doc_place_detach,
            commands::doc_group_place_list,
            commands::doc_group_places_from_docs,
            commands::doc_group_place_attach,
            commands::doc_group_place_detach,
            commands::archive_create,
            commands::archive_list,
            commands::archive_get,
            commands::archive_update,
            commands::archive_delete,
            commands::draft_create,
            commands::draft_get,
            commands::draft_list,
            commands::draft_update,
            commands::draft_delete,
            commands::draft_restore,
            commands::draft_delete_all,
            commands::project_draft_create,
            commands::project_draft_get,
            commands::project_draft_list,
            commands::project_draft_update,
            commands::project_draft_delete,
            commands::project_draft_delete_all,
            commands::folder_draft_create,
            commands::folder_draft_get,
            commands::folder_draft_list,
            commands::folder_draft_update,
            commands::folder_draft_delete,
            commands::folder_draft_delete_all,
            commands::folder_draft_reorder,
            commands::folder_draft_move,
            commands::timeline_create,
            commands::timeline_get,
            commands::timeline_get_by_entity,
            commands::timeline_list,
            commands::timeline_update,
            commands::timeline_delete,
            commands::timeline_delete_by_entity,
            commands::import_txt_files,
            commands::import_project,
            commands::export_project,
            commands::export_project_to_pdf,
            commands::export_project_to_word,
            commands::export_project_to_text,
            // Sync commands
            commands::sync_create,
            commands::sync_get,
            commands::sync_get_by_project,
            commands::sync_list,
            commands::sync_update,
            commands::sync_delete,
            commands::sync_delete_by_project,
            commands::sync_get_status,
            commands::sync_mark_started,
            commands::sync_mark_completed,
            commands::sync_mark_failed,
            commands::sync_mark_conflict,
            commands::sync_resolve_conflict,
            commands::sync_reset_retries,
            commands::sync_mark_db_changed,
            commands::sync_mark_file_changed,
            commands::sync_get_pending_retries,
            commands::sync_pause,
            commands::sync_resume,
            commands::sync_should_auto_sync,
            commands::sync_mark_db_changed_simple,
            commands::sync_calculate_hash,
            commands::sync_import_to_project,
            // iCloud Drive commands
            commands::icloud_is_available,
            commands::icloud_get_project_path,
            commands::icloud_check_file_status,
            commands::icloud_trigger_download,
            commands::icloud_read_file,
            commands::icloud_write_file,
            commands::icloud_scan_documents,
            commands::icloud_delete_file,
            commands::icloud_move_file,
            // iCloud watcher commands
            commands::icloud_watch_project,
            commands::icloud_unwatch_project,
            // Per-file project lifecycle
            commands::file_new_project,
            commands::file_open_project,
            commands::file_close_project,
            commands::file_get_open_project,
            commands::file_checkpoint,
            // Recents
            commands::recents_list,
            commands::recents_remove,
            commands::get_pending_open_file,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::Opened { urls } = event {
                // Filter for .cora file URLs (macOS file association open events)
                let cora_path = urls.iter().find_map(|url| {
                    url.to_file_path().ok()
                        .filter(|p| p.extension().and_then(|e| e.to_str()) == Some("cora"))
                        .and_then(|p| p.to_str().map(String::from))
                });
                if let Some(path) = cora_path {
                    // Store for frontend to pick up on init (handles startup case)
                    if let Some(state) = app_handle.try_state::<AppState>() {
                        if let Ok(mut pending) = state.pending_open_file.lock() {
                            *pending = Some(path.clone());
                        }
                    }
                    // Also emit event for the "app already running" case
                    let _ = app_handle.emit("cora://open-file", path);
                }
            }
        });
}
