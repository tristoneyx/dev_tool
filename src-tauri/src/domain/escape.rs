//! JSON-string escape/unescape used by both the JSON Viewer's "Unescape
//! in place" toolbar and (later) the dedicated Escape tool.

use crate::error::AppError;

/// Escape `input` so it becomes a valid JSON string body (without
/// surrounding quotes). Useful when the user wants to paste arbitrary
/// text into a JSON field.
pub fn escape(input: &str) -> String {
    // serde_json::to_string adds the outer quotes; strip them.
    let mut s = serde_json::to_string(input).expect("string serialization is infallible");
    // Remove first and last char (the wrapping quotes).
    s.pop();
    s.remove(0);
    s
}

/// Unescape `input` by treating it as a JSON string literal. Adds
/// surrounding quotes if missing.
pub fn unescape(input: &str) -> Result<String, AppError> {
    let trimmed = input.trim();
    let candidate = if trimmed.starts_with('"') && trimmed.ends_with('"') {
        trimmed.to_string()
    } else {
        format!("\"{trimmed}\"")
    };
    let parsed: serde_json::Value = serde_json::from_str(&candidate)
        .map_err(|e| AppError::Codec(format!("unescape failed: {e}")))?;
    match parsed {
        serde_json::Value::String(s) => Ok(s),
        _ => Err(AppError::Codec("unescape produced non-string".into())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn escape_basic_chars() {
        assert_eq!(escape("hello"), "hello");
        assert_eq!(escape("with \"quotes\""), r#"with \"quotes\""#);
        assert_eq!(escape("tab\there"), r#"tab\there"#);
        assert_eq!(escape("line\nbreak"), r#"line\nbreak"#);
    }

    #[test]
    fn unescape_basic_chars() {
        assert_eq!(unescape(r#"hello"#).unwrap(), "hello");
        assert_eq!(unescape(r#"with \"quotes\""#).unwrap(), "with \"quotes\"");
        assert_eq!(unescape(r#"tab\there"#).unwrap(), "tab\there");
    }

    #[test]
    fn escape_unescape_round_trip() {
        let original = "{\"a\":\"b\\nc\"}";
        let escaped = escape(original);
        let back = unescape(&escaped).unwrap();
        assert_eq!(back, original);
    }

    #[test]
    fn unescape_with_quotes_already_present() {
        assert_eq!(unescape(r#""hello""#).unwrap(), "hello");
    }

    #[test]
    fn unescape_invalid_returns_codec_error() {
        let err = unescape(r#"\xZZ"#).unwrap_err();
        assert!(matches!(err, AppError::Codec(_)));
    }
}
