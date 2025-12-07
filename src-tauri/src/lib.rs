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
}
mod commands;

use crate::db::init_pool;
use commands::{AppState};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // initialize DB pool and run migrations
    let pool = init_pool().expect("failed to init db pool");
    let app_state = AppState { pool };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // Open the main window maximized by default (not macOS fullscreen space)
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
            commands::doc_reorder,
            commands::doc_move_to_group,
            commands::doc_rename,
            commands::doc_group_list,
            commands::doc_group_create,
            commands::doc_group_create_after,
            commands::doc_group_delete,
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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
