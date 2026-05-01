use crate::domain::history::{HistoryItem, SaveRequest, ToolKind};
use crate::error::AppError;
use crate::persistence::{db::DbHandle, history as repo};
use tauri::State;

#[tauri::command]
pub async fn history_save(
    db: State<'_, DbHandle>,
    req: SaveRequest,
) -> Result<HistoryItem, AppError> {
    let conn = db.conn.lock().expect("db poisoned");
    repo::save(&conn, req)
}

#[tauri::command]
pub async fn history_list(
    db: State<'_, DbHandle>,
    tool: ToolKind,
    search: Option<String>,
) -> Result<Vec<HistoryItem>, AppError> {
    let conn = db.conn.lock().expect("db poisoned");
    repo::list(&conn, tool, search.as_deref())
}

#[tauri::command]
pub async fn history_get(
    db: State<'_, DbHandle>,
    id: i64,
) -> Result<HistoryItem, AppError> {
    let conn = db.conn.lock().expect("db poisoned");
    repo::get(&conn, id)
}

#[tauri::command]
pub async fn history_delete(
    db: State<'_, DbHandle>,
    id: i64,
) -> Result<(), AppError> {
    let conn = db.conn.lock().expect("db poisoned");
    repo::delete(&conn, id)
}
