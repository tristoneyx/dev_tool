use serde::Serialize;

#[derive(thiserror::Error, Debug)]
pub enum AppError {
    #[error("JSON parse error at line {line}, col {col}: {message}")]
    Parse { line: u32, col: u32, message: String },

    #[error("Codec error: {0}")]
    Codec(String),

    #[error("URL parse error: {0}")]
    UrlParse(String),

    #[error("Database error: {0}")]
    Db(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut s = serializer.serialize_struct("AppError", 5)?;
        match self {
            AppError::Parse { line, col, message } => {
                s.serialize_field("code", "parse")?;
                s.serialize_field("message", message)?;
                s.serialize_field("line", line)?;
                s.serialize_field("col", col)?;
            }
            AppError::Codec(msg) => {
                s.serialize_field("code", "codec")?;
                s.serialize_field("message", msg)?;
            }
            AppError::UrlParse(msg) => {
                s.serialize_field("code", "url_parse")?;
                s.serialize_field("message", msg)?;
            }
            AppError::Db(msg) => {
                s.serialize_field("code", "db")?;
                s.serialize_field("message", msg)?;
            }
            AppError::Io(msg) => {
                s.serialize_field("code", "io")?;
                s.serialize_field("message", msg)?;
            }
            AppError::Internal(msg) => {
                s.serialize_field("code", "internal")?;
                s.serialize_field("message", msg)?;
            }
        }
        s.end()
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(e: rusqlite::Error) -> Self {
        AppError::Db(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(e.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Parse {
            line: e.line() as u32,
            col: e.column() as u32,
            message: e.to_string(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_error_serializes_with_position() {
        let err = AppError::Parse {
            line: 5,
            col: 12,
            message: "expected ','".into(),
        };
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["code"], "parse");
        assert_eq!(json["line"], 5);
        assert_eq!(json["col"], 12);
        assert_eq!(json["message"], "expected ','");
    }

    #[test]
    fn codec_error_serializes_with_code() {
        let err = AppError::Codec("invalid base64".into());
        let json = serde_json::to_value(&err).unwrap();
        assert_eq!(json["code"], "codec");
        assert_eq!(json["message"], "invalid base64");
    }

    #[test]
    fn rusqlite_error_converts_to_db_variant() {
        let e: AppError = rusqlite::Error::QueryReturnedNoRows.into();
        let json = serde_json::to_value(&e).unwrap();
        assert_eq!(json["code"], "db");
    }
}
