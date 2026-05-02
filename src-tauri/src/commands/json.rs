use crate::domain::escape::{escape, unescape};
use crate::domain::json_tree::{build_from_text, build_from_value, JsonTree};
use crate::error::AppError;
use serde_json::Value;

#[tauri::command]
pub async fn json_parse(input: String) -> Result<JsonTree, AppError> {
    tauri::async_runtime::spawn_blocking(move || build_from_text(&input))
        .await
        .map_err(|e| AppError::Internal(format!("spawn_blocking join error: {e}")))?
}

#[tauri::command]
pub async fn json_parse_nested(input: String) -> Result<JsonTree, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let value: Value = serde_json::from_str(&input)?;
        Ok::<_, AppError>(build_from_value(value))
    })
    .await
    .map_err(|e| AppError::Internal(format!("spawn_blocking join error: {e}")))?
}

#[tauri::command]
pub fn json_format(input: String, indent: u8) -> Result<String, AppError> {
    let value: Value = serde_json::from_str(&input)?;
    if indent == 0 {
        Ok(serde_json::to_string(&value)?)
    } else {
        // serde_json's pretty printer uses 2 spaces; we only honor indent=0 vs >0
        // (any non-zero indent yields the standard pretty form).
        Ok(serde_json::to_string_pretty(&value)?)
    }
}

#[tauri::command]
pub fn json_unescape(input: String) -> Result<String, AppError> {
    unescape(&input)
}

#[tauri::command]
pub fn json_escape(input: String) -> Result<String, AppError> {
    Ok(escape(&input))
}
