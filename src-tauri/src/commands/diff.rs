use crate::domain::diff::{build_diff_from_strings, DiffTree};
use crate::error::AppError;

#[tauri::command]
pub async fn json_diff(left: String, right: String) -> Result<DiffTree, AppError> {
    tauri::async_runtime::spawn_blocking(move || build_diff_from_strings(&left, &right))
        .await
        .map_err(|e| AppError::Internal(format!("spawn_blocking join error: {e}")))?
}
