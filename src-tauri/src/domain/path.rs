//! JS dot-path construction for JSON tree nodes.
//!
//! Output style: `a.b[0].c`. Keys with non-identifier characters or
//! containing `.`, `[`, `]`, `'`, `"` use bracket notation: `a["weird-key"]`.
//! Empty keys become `[""]`. Numeric-looking keys still use dot.

const IDENT_FIRST_CHARS: &str =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$";
const IDENT_REST_CHARS: &str =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_$";

fn is_safe_identifier(key: &str) -> bool {
    let mut chars = key.chars();
    let Some(first) = chars.next() else { return false };
    if !IDENT_FIRST_CHARS.contains(first) {
        return false;
    }
    chars.all(|c| IDENT_REST_CHARS.contains(c))
}

/// Append `key` to the existing dot-path `parent` (which may be empty).
pub fn join_object_key(parent: &str, key: &str) -> String {
    if is_safe_identifier(key) {
        if parent.is_empty() {
            key.to_string()
        } else {
            format!("{parent}.{key}")
        }
    } else {
        // Bracket-notation: escape \\ and " inside the key.
        let escaped = key.replace('\\', "\\\\").replace('"', "\\\"");
        format!("{parent}[\"{escaped}\"]")
    }
}

/// Append `index` to the existing dot-path `parent`.
pub fn join_array_index(parent: &str, index: u32) -> String {
    format!("{parent}[{index}]")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_identifier_uses_dot() {
        assert_eq!(join_object_key("a", "b"), "a.b");
        assert_eq!(join_object_key("", "root"), "root");
        assert_eq!(join_object_key("a", "_field"), "a._field");
        assert_eq!(join_object_key("a", "$ref"), "a.$ref");
    }

    #[test]
    fn weird_keys_use_brackets() {
        assert_eq!(join_object_key("a", "weird-key"), r#"a["weird-key"]"#);
        assert_eq!(join_object_key("a", "key.with.dots"), r#"a["key.with.dots"]"#);
        assert_eq!(join_object_key("a", "9lives"), r#"a["9lives"]"#);
    }

    #[test]
    fn empty_key_uses_brackets() {
        assert_eq!(join_object_key("a", ""), r#"a[""]"#);
    }

    #[test]
    fn key_with_quotes_is_escaped() {
        assert_eq!(
            join_object_key("a", "say \"hi\""),
            r#"a["say \"hi\""]"#
        );
    }

    #[test]
    fn array_index_appends_brackets() {
        assert_eq!(join_array_index("a", 0), "a[0]");
        assert_eq!(join_array_index("a.b", 7), "a.b[7]");
        assert_eq!(join_array_index("", 3), "[3]");
    }
}
