//! Auto-unescape JSON input. If `serde_json::from_str` fails, treat the
//! input as a JSON string literal (wrap with quotes if needed) and try
//! again, recursing up to 3 layers. Returns the parsed value plus the
//! number of unescape layers peeled.

use crate::error::AppError;
use serde_json::Value;

pub const MAX_UNESCAPE_LAYERS: u8 = 3;

#[derive(Debug)]
pub struct ParseOutput {
    pub value: Value,
    pub unescape_layers: u8,
}

/// Try to parse `input` as JSON. On failure, attempt to treat the input
/// as a JSON string literal and recursively re-parse the contained string.
/// Returns the original parse error if no layer succeeds.
pub fn parse_with_auto_unescape(input: &str) -> Result<ParseOutput, AppError> {
    parse_inner(input.trim(), 0)
}

fn parse_inner(input: &str, layers: u8) -> Result<ParseOutput, AppError> {
    // Try a direct parse first.
    match serde_json::from_str::<Value>(input) {
        Ok(Value::String(inner)) => {
            // The input parsed as a JSON string. Try to see if the inner
            // content is itself JSON. If it is, we need to recurse (unescape).
            let inner_trimmed = inner.trim();
            // Check whether the inner string can be parsed as JSON.
            let inner_parseable = serde_json::from_str::<Value>(inner_trimmed).is_ok();
            if inner_parseable {
                // We need to recurse. Check budget first.
                if layers >= MAX_UNESCAPE_LAYERS {
                    return Err(AppError::Parse {
                        line: 0,
                        col: 0,
                        message: format!(
                            "input requires more than {MAX_UNESCAPE_LAYERS} unescape layers"
                        ),
                    });
                }
                // Propagate errors from deeper recursion (don't swallow them).
                parse_inner(inner_trimmed, layers + 1)
            } else {
                // Inner string is not JSON — this is the final value.
                Ok(ParseOutput {
                    value: Value::String(inner),
                    unescape_layers: layers,
                })
            }
        }
        Ok(value) => Ok(ParseOutput {
            value,
            unescape_layers: layers,
        }),
        Err(direct_err) => {
            // Stop recursing if we've used the budget.
            if layers >= MAX_UNESCAPE_LAYERS {
                return Err(direct_err.into());
            }

            // Try treating the input as a JSON string literal:
            //   - If input already starts with `"`, parse it as-is.
            //   - Otherwise wrap with quotes.
            let candidate = if input.starts_with('"') && input.ends_with('"') {
                input.to_string()
            } else {
                format!("\"{input}\"")
            };

            match serde_json::from_str::<Value>(&candidate) {
                Ok(Value::String(inner)) => parse_inner(inner.trim(), layers + 1),
                _ => Err(direct_err.into()),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_normal_json_with_zero_layers() {
        let out = parse_with_auto_unescape(r#"{"a":1}"#).unwrap();
        assert_eq!(out.unescape_layers, 0);
        assert_eq!(out.value["a"], 1);
    }

    #[test]
    fn unescapes_one_layer() {
        // {\"a\":1}  — Rust string literal: a single layer of escaping
        let out = parse_with_auto_unescape(r#"{\"a\":1}"#).unwrap();
        assert_eq!(out.unescape_layers, 1);
        assert_eq!(out.value["a"], 1);
    }

    #[test]
    fn unescapes_quoted_one_layer() {
        // Already wrapped in quotes:  "{\"a\":1}"
        let raw = r#""{\"a\":1}""#;
        let out = parse_with_auto_unescape(raw).unwrap();
        assert_eq!(out.unescape_layers, 1);
        assert_eq!(out.value["a"], 1);
    }

    #[test]
    fn unescapes_two_layers() {
        //   raw outer:  "{\\\"a\\\":1}"  (when written in a Rust raw string)
        // Conceptually: the input is a JSON-encoded JSON-encoded JSON.
        let inner = r#"{"a":1}"#;
        let once = serde_json::to_string(inner).unwrap();        // -> "{\"a\":1}"
        let twice = serde_json::to_string(&once).unwrap();       // -> "\"{\\\"a\\\":1}\""
        let out = parse_with_auto_unescape(&twice).unwrap();
        assert_eq!(out.unescape_layers, 2);
        assert_eq!(out.value["a"], 1);
    }

    #[test]
    fn surfaces_original_error_when_unparseable() {
        let err = parse_with_auto_unescape("not json at all").unwrap_err();
        assert!(matches!(err, AppError::Parse { .. }));
    }

    #[test]
    fn caps_at_max_layers() {
        // Build something that needs 4 layers.
        let mut s = serde_json::to_string(r#"{"a":1}"#).unwrap();
        for _ in 0..3 {
            s = serde_json::to_string(&s).unwrap();
        }
        // 4 layers of escaping → exceeds MAX_UNESCAPE_LAYERS=3.
        let err = parse_with_auto_unescape(&s).unwrap_err();
        assert!(matches!(err, AppError::Parse { .. }));
    }
}
