pub mod commands;
pub mod domain;
pub mod error;
pub mod persistence;

use persistence::db::DbHandle;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            let app_data = app
                .path()
                .app_data_dir()
                .expect("resolve app_data_dir");
            let db_path = app_data.join("history.sqlite");
            let db = DbHandle::open(&db_path).expect("open history db");
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::history::history_save,
            commands::history::history_list,
            commands::history::history_get,
            commands::history::history_delete,
            commands::json::json_parse,
            commands::json::json_parse_nested,
            commands::json::json_format,
            commands::json::json_unescape,
            commands::json::json_escape,
            commands::diff::json_diff,
            commands::codec::base64_encode,
            commands::codec::base64_decode,
            commands::codec::url_parse,
            commands::codec::url_build,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
