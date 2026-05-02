//! Detect whether a string value contains JSON. Used to flag string
//! nodes that the UI can offer to expand inline.

use serde_json::Value;

/// Result of inspecting a string value. None when the string is not JSON.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct NestedSummary {
    /// Short summary like "{ 8 keys }" or "[ 12 items ]".
    pub kind_summary: String,
}

/// Try to parse `value` as JSON. Returns `Some` only if the parsed result
/// is an object or an array (string-as-number / string-as-bool excluded).
pub fn detect(value: &str) -> Option<NestedSummary> {
    let trimmed = value.trim_start();
    if !trimmed.starts_with('{') && !trimmed.starts_with('[') {
        return None;
    }
    let parsed = serde_json::from_str::<Value>(trimmed).ok()?;
    match &parsed {
        Value::Object(obj) => Some(NestedSummary {
            kind_summary: format!("{{ {} keys }}", obj.len()),
        }),
        Value::Array(arr) => Some(NestedSummary {
            kind_summary: format!("[ {} items ]", arr.len()),
        }),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_object() {
        let s = detect(r#"{"a":1,"b":2}"#).unwrap();
        assert_eq!(s.kind_summary, "{ 2 keys }");
    }

    #[test]
    fn detects_array() {
        let s = detect(r#"[1,2,3]"#).unwrap();
        assert_eq!(s.kind_summary, "[ 3 items ]");
    }

    #[test]
    fn detects_nothing_for_plain_string() {
        assert!(detect("hello world").is_none());
    }

    #[test]
    fn detects_nothing_for_numeric_string() {
        assert!(detect("123").is_none());
    }

    #[test]
    fn detects_nothing_for_bool_string() {
        assert!(detect("true").is_none());
    }

    #[test]
    fn detects_with_leading_whitespace() {
        let s = detect("   {\"x\":1}").unwrap();
        assert_eq!(s.kind_summary, "{ 1 keys }");
    }

    #[test]
    fn detects_nothing_for_string_starting_with_brace_but_invalid_json() {
        assert!(detect("{not really json").is_none());
    }
}
