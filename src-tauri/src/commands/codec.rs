use crate::domain::base64_codec;
use crate::domain::url_parts::{self, UrlParts};
use crate::error::AppError;

#[tauri::command]
pub fn base64_encode(input: String, url_safe: bool) -> Result<String, AppError> {
    Ok(base64_codec::encode(&input, url_safe))
}

#[tauri::command]
pub fn base64_decode(input: String, url_safe: bool) -> Result<String, AppError> {
    base64_codec::decode(&input, url_safe)
}

#[tauri::command]
pub fn url_parse(input: String) -> Result<UrlParts, AppError> {
    url_parts::parse_url(&input)
}

#[tauri::command]
pub fn url_build(parts: UrlParts) -> Result<String, AppError> {
    url_parts::build_url(&parts)
}
