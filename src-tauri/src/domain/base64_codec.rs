use crate::error::AppError;
use base64::engine::general_purpose::{STANDARD, URL_SAFE};
use base64::Engine;

pub fn encode(input: &str, url_safe: bool) -> String {
    if url_safe {
        URL_SAFE.encode(input.as_bytes())
    } else {
        STANDARD.encode(input.as_bytes())
    }
}

pub fn decode(input: &str, url_safe: bool) -> Result<String, AppError> {
    let trimmed = input.trim();
    let bytes = if url_safe {
        URL_SAFE.decode(trimmed)
    } else {
        STANDARD.decode(trimmed)
    }
    .map_err(|e| AppError::Codec(format!("base64 decode failed: {e}")))?;
    String::from_utf8(bytes)
        .map_err(|e| AppError::Codec(format!("decoded bytes are not valid UTF-8: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn encode_standard() {
        assert_eq!(encode("hello", false), "aGVsbG8=");
    }

    #[test]
    fn encode_url_safe_uses_dash_underscore() {
        // Standard base64 of "<<<???" is "PDw8Pz8/" which contains '/'.
        let standard = encode("<<<???", false);
        let url_safe = encode("<<<???", true);

        assert_eq!(standard, "PDw8Pz8/");
        assert!(
            standard.contains('/') || standard.contains('+'),
            "standard encoding should contain + or / for this fixture"
        );
        assert!(
            !url_safe.contains('/') && !url_safe.contains('+'),
            "url-safe encoding must not contain '/' or '+', got {url_safe}"
        );
        assert!(
            url_safe.contains('_') || url_safe.contains('-'),
            "url-safe encoding should substitute '_' or '-' for the chars replaced; got {url_safe}"
        );
        assert_eq!(url_safe, "PDw8Pz8_");
    }

    #[test]
    fn decode_standard_round_trip() {
        assert_eq!(decode("aGVsbG8=", false).unwrap(), "hello");
    }

    #[test]
    fn decode_url_safe_round_trip() {
        let encoded = encode("hello world", true);
        let decoded = decode(&encoded, true).unwrap();
        assert_eq!(decoded, "hello world");
    }

    #[test]
    fn decode_invalid_returns_codec_error() {
        let err = decode("!!!", false).unwrap_err();
        match err {
            AppError::Codec(_) => {}
            other => panic!("expected AppError::Codec, got {other:?}"),
        }
    }

    #[test]
    fn decode_non_utf8_returns_codec_error() {
        // Encode raw bytes that are NOT valid UTF-8.
        let raw = [0xff_u8, 0xfe, 0xfd];
        let encoded = STANDARD.encode(raw);
        // Sanity-check: standard base64 of [0xff, 0xfe, 0xfd] is "//79".
        assert_eq!(encoded, "//79");
        let err = decode(&encoded, false).unwrap_err();
        match err {
            AppError::Codec(msg) => assert!(
                msg.contains("UTF-8") || msg.contains("utf-8") || msg.contains("utf8"),
                "expected UTF-8 mention in error, got {msg}"
            ),
            other => panic!("expected AppError::Codec, got {other:?}"),
        }
    }

    #[test]
    fn decode_trims_whitespace() {
        assert_eq!(decode("  aGVsbG8=  \n", false).unwrap(), "hello");
    }
}
