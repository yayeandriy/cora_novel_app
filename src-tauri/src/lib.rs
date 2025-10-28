mod db;
mod models;
mod services {
    pub mod projects;
    pub mod docs;
    pub mod characters;
    pub mod events;
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
            commands::character_create,
            commands::event_create,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
