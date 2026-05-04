use crate::error::AppError;
use serde::{Deserialize, Serialize};
use url::Url;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct UrlParts {
    pub scheme: String,
    pub host: String,
    pub port: Option<u16>,
    pub path: String,
    pub query: Vec<QueryParam>,
    pub fragment: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct QueryParam {
    pub key: String,
    pub value: String,
}

pub fn parse_url(input: &str) -> Result<UrlParts, AppError> {
    let url = Url::parse(input).map_err(|e| AppError::UrlParse(format!("{e}")))?;

    let scheme = url.scheme().to_string();
    let host = url.host_str().unwrap_or("").to_string();
    let port = url.port();
    let path_str = url.path();
    let path = if path_str.is_empty() {
        "/".to_string()
    } else {
        path_str.to_string()
    };

    let query: Vec<QueryParam> = url
        .query_pairs()
        .map(|(k, v)| QueryParam {
            key: k.into_owned(),
            value: v.into_owned(),
        })
        .collect();

    let fragment = url.fragment().map(|s| s.to_string());

    Ok(UrlParts {
        scheme,
        host,
        port,
        path,
        query,
        fragment,
    })
}

pub fn build_url(parts: &UrlParts) -> Result<String, AppError> {
    let base = match parts.port {
        Some(p) => format!("{}://{}:{}", parts.scheme, parts.host, p),
        None => format!("{}://{}", parts.scheme, parts.host),
    };
    let mut url =
        Url::parse(&base).map_err(|e| AppError::UrlParse(format!("invalid base: {e}")))?;
    let path = if parts.path.is_empty() { "/" } else { &parts.path };
    url.set_path(path);

    if parts.query.is_empty() {
        url.set_query(None);
    } else {
        let mut serializer = url::form_urlencoded::Serializer::new(String::new());
        for p in &parts.query {
            serializer.append_pair(&p.key, &p.value);
        }
        url.set_query(Some(&serializer.finish()));
    }

    url.set_fragment(parts.fragment.as_deref());
    Ok(url.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_full_url() {
        let parts =
            parse_url("https://example.com:8080/path?a=1&b=2#frag").expect("parses");
        assert_eq!(parts.scheme, "https");
        assert_eq!(parts.host, "example.com");
        assert_eq!(parts.port, Some(8080));
        assert_eq!(parts.path, "/path");
        assert_eq!(parts.query.len(), 2);
        assert_eq!(parts.query[0].key, "a");
        assert_eq!(parts.query[0].value, "1");
        assert_eq!(parts.query[1].key, "b");
        assert_eq!(parts.query[1].value, "2");
        assert_eq!(parts.fragment.as_deref(), Some("frag"));
    }

    #[test]
    fn parse_minimal() {
        let parts = parse_url("https://example.com").expect("parses");
        assert_eq!(parts.scheme, "https");
        assert_eq!(parts.host, "example.com");
        assert_eq!(parts.port, None);
        assert_eq!(parts.path, "/");
        assert!(parts.query.is_empty());
        assert_eq!(parts.fragment, None);
    }

    #[test]
    fn parse_invalid() {
        let err = parse_url("not a url").unwrap_err();
        match err {
            AppError::UrlParse(_) => {}
            other => panic!("expected AppError::UrlParse, got {other:?}"),
        }
    }

    #[test]
    fn query_values_are_url_decoded() {
        let parts = parse_url("https://x.com?q=hello%20world").expect("parses");
        assert_eq!(parts.query.len(), 1);
        assert_eq!(parts.query[0].key, "q");
        assert_eq!(parts.query[0].value, "hello world");
    }

    #[test]
    fn build_round_trip() {
        let original =
            parse_url("https://example.com:8080/path?a=1&b=2#frag").expect("parses");
        let built = build_url(&original).expect("builds");
        let reparsed = parse_url(&built).expect("re-parses");
        assert_eq!(original, reparsed);
    }

    #[test]
    fn build_url_encodes_special_chars_in_query() {
        let parts = UrlParts {
            scheme: "https".into(),
            host: "x.com".into(),
            port: None,
            path: "/".into(),
            query: vec![QueryParam {
                key: "q".into(),
                value: "a b&c".into(),
            }],
            fragment: None,
        };
        let built = build_url(&parts).expect("builds");
        assert!(
            !built.contains("a b&c"),
            "raw value should not appear literally in built URL: {built}"
        );
        let reparsed = parse_url(&built).expect("re-parses");
        assert_eq!(reparsed.query.len(), 1);
        assert_eq!(reparsed.query[0].key, "q");
        assert_eq!(reparsed.query[0].value, "a b&c");
    }
}
