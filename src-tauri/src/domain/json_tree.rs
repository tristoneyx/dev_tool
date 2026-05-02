//! `JsonTree` — the serializable tree representation returned to the
//! frontend after parsing. The frontend never re-parses JSON; it only
//! consumes this structure.

use crate::domain::nested_detect::{detect as detect_nested, NestedSummary};
use crate::domain::path::{join_array_index, join_object_key};
use crate::domain::unescape::parse_with_auto_unescape;
use crate::error::AppError;
use serde::{Deserialize, Serialize};
use serde_json::Value;

pub type NodeId = u32;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct JsonTree {
    pub root: JsonNode,
    pub stats: TreeStats,
    pub unescape_layers: u8,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TreeStats {
    pub total_nodes: u32,
    pub max_depth: u16,
    pub byte_size: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct JsonNode {
    pub id: NodeId,
    pub key: NodeKey,
    pub path: String,
    pub value: NodeValue,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum NodeKey {
    Root,
    Object { name: String },
    Array { index: u32 },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum NodeValue {
    Null,
    Bool { value: bool },
    Number {
        /// Original textual form preserves precision.
        raw: String,
    },
    String {
        value: String,
        nested_hint: Option<NestedHint>,
    },
    Object {
        children: Vec<JsonNode>,
        key_count: u32,
    },
    Array {
        children: Vec<JsonNode>,
        item_count: u32,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NestedHint {
    pub kind_summary: String,
}

impl From<NestedSummary> for NestedHint {
    fn from(s: NestedSummary) -> Self {
        NestedHint { kind_summary: s.kind_summary }
    }
}

/// Public entry: parse text into a JsonTree, applying auto-unescape.
pub fn build_from_text(input: &str) -> Result<JsonTree, AppError> {
    let parsed = parse_with_auto_unescape(input)?;
    let mut ctx = BuildCtx::default();
    let root = ctx.build_node(parsed.value, NodeKey::Root, String::new());
    Ok(JsonTree {
        stats: TreeStats {
            total_nodes: ctx.next_id,
            max_depth: ctx.max_depth,
            byte_size: input.len() as u32,
        },
        root,
        unescape_layers: parsed.unescape_layers,
    })
}

/// Public entry for the "expand nested string as JSON" path.
pub fn build_from_value(value: Value) -> JsonTree {
    let mut ctx = BuildCtx::default();
    let root = ctx.build_node(value, NodeKey::Root, String::new());
    JsonTree {
        stats: TreeStats {
            total_nodes: ctx.next_id,
            max_depth: ctx.max_depth,
            byte_size: 0,
        },
        root,
        unescape_layers: 0,
    }
}

#[derive(Default)]
struct BuildCtx {
    next_id: u32,
    max_depth: u16,
    current_depth: u16,
}

impl BuildCtx {
    fn alloc_id(&mut self) -> NodeId {
        let id = self.next_id;
        self.next_id += 1;
        id
    }

    fn build_node(&mut self, value: Value, key: NodeKey, path: String) -> JsonNode {
        if self.current_depth > self.max_depth {
            self.max_depth = self.current_depth;
        }

        let id = self.alloc_id();
        let node_value = match value {
            Value::Null => NodeValue::Null,
            Value::Bool(b) => NodeValue::Bool { value: b },
            Value::Number(n) => NodeValue::Number {
                raw: n.to_string(),
            },
            Value::String(s) => {
                let nested = detect_nested(&s).map(NestedHint::from);
                NodeValue::String {
                    value: s,
                    nested_hint: nested,
                }
            }
            Value::Array(items) => {
                let item_count = items.len() as u32;
                self.current_depth += 1;
                let children = items
                    .into_iter()
                    .enumerate()
                    .map(|(i, child_val)| {
                        let child_path = join_array_index(&path, i as u32);
                        self.build_node(
                            child_val,
                            NodeKey::Array { index: i as u32 },
                            child_path,
                        )
                    })
                    .collect();
                self.current_depth -= 1;
                NodeValue::Array {
                    children,
                    item_count,
                }
            }
            Value::Object(map) => {
                let key_count = map.len() as u32;
                self.current_depth += 1;
                let children = map
                    .into_iter()
                    .map(|(k, v)| {
                        let child_path = join_object_key(&path, &k);
                        self.build_node(v, NodeKey::Object { name: k }, child_path)
                    })
                    .collect();
                self.current_depth -= 1;
                NodeValue::Object {
                    children,
                    key_count,
                }
            }
        };

        JsonNode {
            id,
            key,
            path,
            value: node_value,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_object_yields_root_with_zero_keys() {
        let tree = build_from_text("{}").unwrap();
        assert_eq!(tree.unescape_layers, 0);
        assert_eq!(tree.stats.total_nodes, 1);
        match tree.root.value {
            NodeValue::Object { key_count, .. } => assert_eq!(key_count, 0),
            other => panic!("expected object, got {other:?}"),
        }
    }

    #[test]
    fn primitive_root_works() {
        let tree = build_from_text("42").unwrap();
        match tree.root.value {
            NodeValue::Number { raw } => assert_eq!(raw, "42"),
            _ => panic!("expected number"),
        }
        assert!(matches!(tree.root.key, NodeKey::Root));
    }

    #[test]
    fn nested_object_has_correct_paths() {
        let tree = build_from_text(r#"{"a":{"b":1}}"#).unwrap();
        let root_children = match &tree.root.value {
            NodeValue::Object { children, .. } => children,
            _ => panic!(),
        };
        assert_eq!(root_children[0].path, "a");
        let nested = match &root_children[0].value {
            NodeValue::Object { children, .. } => children,
            _ => panic!(),
        };
        assert_eq!(nested[0].path, "a.b");
    }

    #[test]
    fn array_indices_appear_in_path() {
        let tree = build_from_text(r#"{"xs":[10,20]}"#).unwrap();
        let xs = match &tree.root.value {
            NodeValue::Object { children, .. } => &children[0],
            _ => panic!(),
        };
        let arr = match &xs.value {
            NodeValue::Array { children, .. } => children,
            _ => panic!(),
        };
        assert_eq!(arr[0].path, "xs[0]");
        assert_eq!(arr[1].path, "xs[1]");
    }

    #[test]
    fn weird_keys_use_brackets_in_path() {
        let tree = build_from_text(r#"{"weird-key":1}"#).unwrap();
        let kid = match &tree.root.value {
            NodeValue::Object { children, .. } => &children[0],
            _ => panic!(),
        };
        assert_eq!(kid.path, r#"["weird-key"]"#);
    }

    #[test]
    fn string_values_get_nested_hint_when_inner_is_json() {
        let tree = build_from_text(r#"{"payload":"{\"x\":1}"}"#).unwrap();
        let kid = match &tree.root.value {
            NodeValue::Object { children, .. } => &children[0],
            _ => panic!(),
        };
        match &kid.value {
            NodeValue::String { nested_hint, .. } => {
                assert!(nested_hint.is_some());
                assert_eq!(nested_hint.as_ref().unwrap().kind_summary, "{ 1 keys }");
            }
            other => panic!("expected string, got {other:?}"),
        }
    }

    #[test]
    fn number_precision_preserved() {
        let big = "12345678901234567890";
        let tree = build_from_text(big).unwrap();
        match tree.root.value {
            NodeValue::Number { raw } => assert_eq!(raw, big),
            _ => panic!(),
        }
    }

    #[test]
    fn auto_unescape_is_reflected_in_layers() {
        let tree = build_from_text(r#"{\"a\":1}"#).unwrap();
        assert_eq!(tree.unescape_layers, 1);
    }

    #[test]
    fn assigns_unique_ids() {
        let tree = build_from_text(r#"{"a":1,"b":[2,3]}"#).unwrap();
        // root + a + b + 2 array items = 5
        assert_eq!(tree.stats.total_nodes, 5);
    }

    #[test]
    fn build_from_value_works() {
        let v: Value = serde_json::from_str(r#"{"x":1}"#).unwrap();
        let tree = build_from_value(v);
        assert_eq!(tree.unescape_layers, 0);
        match tree.root.value {
            NodeValue::Object { key_count, .. } => assert_eq!(key_count, 1),
            _ => panic!(),
        }
    }
}
