use serde::{Deserialize, Serialize};

#[derive(thiserror::Error, Debug)]
#[error("unknown tool kind: {0}")]
pub struct ParseToolKindError(pub String);

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ToolKind {
    JsonViewer,
    JsonDiff,
    Escape,
    Base64,
    UrlParser,
}

impl ToolKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            ToolKind::JsonViewer => "json_viewer",
            ToolKind::JsonDiff => "json_diff",
            ToolKind::Escape => "escape",
            ToolKind::Base64 => "base64",
            ToolKind::UrlParser => "url_parser",
        }
    }

}

impl std::str::FromStr for ToolKind {
    type Err = ParseToolKindError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "json_viewer" => Ok(Self::JsonViewer),
            "json_diff" => Ok(Self::JsonDiff),
            "escape" => Ok(Self::Escape),
            "base64" => Ok(Self::Base64),
            "url_parser" => Ok(Self::UrlParser),
            other => Err(ParseToolKindError(other.to_string())),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EscapeDirection {
    Escape,
    Unescape,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CodecDirection {
    Encode,
    Decode,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
#[serde(tag = "tool", rename_all = "snake_case")]
pub enum HistoryContent {
    JsonViewer { input: String },
    JsonDiff { left: String, right: String },
    Escape { input: String, direction: EscapeDirection },
    Base64 { input: String, direction: CodecDirection, url_safe: bool },
    UrlParser { url: String },
}

impl HistoryContent {
    pub fn tool(&self) -> ToolKind {
        match self {
            HistoryContent::JsonViewer { .. } => ToolKind::JsonViewer,
            HistoryContent::JsonDiff { .. } => ToolKind::JsonDiff,
            HistoryContent::Escape { .. } => ToolKind::Escape,
            HistoryContent::Base64 { .. } => ToolKind::Base64,
            HistoryContent::UrlParser { .. } => ToolKind::UrlParser,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct HistoryItem {
    pub id: i64,
    pub tool: ToolKind,
    pub title: String,
    pub content: HistoryContent,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "mode", rename_all = "snake_case")]
pub enum SaveMode {
    New,
    Overwrite { id: i64 },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SaveRequest {
    #[serde(flatten)]
    pub mode: SaveMode,
    pub title: String,
    pub content: HistoryContent,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tool_kind_round_trip() {
        use std::str::FromStr;
        for tool in [
            ToolKind::JsonViewer,
            ToolKind::JsonDiff,
            ToolKind::Escape,
            ToolKind::Base64,
            ToolKind::UrlParser,
        ] {
            assert_eq!(ToolKind::from_str(tool.as_str()).unwrap(), tool);
        }
    }

    #[test]
    fn tool_kind_from_str_rejects_unknown() {
        use std::str::FromStr;
        let err = ToolKind::from_str("nope").unwrap_err();
        assert!(err.to_string().contains("nope"));
    }

    #[test]
    fn history_content_serializes_with_tag() {
        let c = HistoryContent::JsonViewer {
            input: "{}".into(),
        };
        let v = serde_json::to_value(&c).unwrap();
        assert_eq!(v["tool"], "json_viewer");
        assert_eq!(v["input"], "{}");
    }

    #[test]
    fn save_request_overwrite_serializes_with_id() {
        let req = SaveRequest {
            mode: SaveMode::Overwrite { id: 42 },
            title: "t".into(),
            content: HistoryContent::JsonViewer { input: "1".into() },
        };
        let v = serde_json::to_value(&req).unwrap();
        assert_eq!(v["mode"], "overwrite");
        assert_eq!(v["id"], 42);
    }
}
