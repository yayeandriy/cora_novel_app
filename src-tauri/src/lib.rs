mod db;
mod models;
mod services {
    pub mod projects;
    pub mod docs;
    pub mod characters;
    pub mod events;
    pub mod doc_groups;
    pub mod drafts;
}
mod commands;

use crate::db::init_pool;
use commands::{AppState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // initialize DB pool and run migrations
    let pool = init_pool().expect("failed to init db pool");
    let app_state = AppState { pool };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
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
            commands::character_create,
            commands::character_list,
            commands::character_update,
            commands::character_delete,
            commands::doc_character_list,
            commands::doc_character_attach,
            commands::doc_character_detach,
            commands::event_create,
            commands::draft_create,
            commands::draft_get,
            commands::draft_list,
            commands::draft_update,
            commands::draft_delete,
            commands::draft_restore,
            commands::draft_delete_all,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
