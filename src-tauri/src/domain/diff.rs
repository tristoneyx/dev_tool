//! Semantic JSON diff.
//!
//! Compares two `serde_json::Value` trees and produces a `DiffTree` whose
//! shape mirrors the JSON Viewer's `JsonTree` so the frontend can render it
//! with similar conventions (paths, keys, value type tags).
//!
//! Algorithm summary (see plan for full spec):
//! - Primitive vs primitive same type: `Equal` or `Modified`.
//! - Primitive vs primitive different type: `TypeChanged`.
//! - Container vs non-container (or array vs object): `TypeChanged`,
//!   no recursion below.
//! - Object vs object: union of keys, sorted; recurse on each. Container
//!   itself is `Equal` and rolls up via `has_difference`.
//! - Array vs array: positional zip up to max(len). Container is `Equal`
//!   and rolls up via `has_difference`.
//! - When an entire container is added/removed, the subtree is recursively
//!   materialized as `Added`/`Removed` nodes (fresh ids, all counted).

use crate::domain::path::{join_array_index, join_object_key};
use crate::error::AppError;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiffTree {
    pub root: DiffNode,
    pub stats: DiffStats,
}

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
pub struct DiffStats {
    pub total_nodes: u32,
    pub differences: u32,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum DiffKey {
    Root,
    Object { name: String },
    Array { index: u32 },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DiffValue {
    Null,
    Bool { value: bool },
    Number { raw: String },
    String { value: String },
    Object { key_count: u32 },
    Array { item_count: u32 },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum DiffStatus {
    Equal { value: DiffValue },
    Added { right: DiffValue },
    Removed { left: DiffValue },
    Modified { left: DiffValue, right: DiffValue },
    TypeChanged { left: DiffValue, right: DiffValue },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiffNode {
    pub id: u32,
    pub key: DiffKey,
    pub path: String,
    #[serde(flatten)]
    pub status: DiffStatus,
    pub children: Vec<DiffNode>,
    pub has_difference: bool,
}

/// Build a `DiffTree` from two parsed JSON values.
pub fn build_diff(left: Value, right: Value) -> DiffTree {
    let mut ctx = BuildCtx::default();
    let root = ctx.diff_node(Some(left), Some(right), DiffKey::Root, String::new());
    DiffTree {
        root,
        stats: DiffStats {
            total_nodes: ctx.next_id,
            differences: ctx.differences,
        },
    }
}

/// Public entry point used by the Tauri command.
pub fn build_diff_from_strings(left: &str, right: &str) -> Result<DiffTree, AppError> {
    let lv: Value = serde_json::from_str(left)?;
    let rv: Value = serde_json::from_str(right)?;
    Ok(build_diff(lv, rv))
}

#[derive(Default)]
struct BuildCtx {
    next_id: u32,
    differences: u32,
}

impl BuildCtx {
    fn alloc_id(&mut self) -> u32 {
        let id = self.next_id;
        self.next_id += 1;
        id
    }

    /// Diff a node where exactly one or both sides may be present.
    /// For the root we always pass both Some(_).
    fn diff_node(
        &mut self,
        left: Option<Value>,
        right: Option<Value>,
        key: DiffKey,
        path: String,
    ) -> DiffNode {
        let id = self.alloc_id();
        match (left, right) {
            (Some(l), Some(r)) => self.diff_present(id, l, r, key, path),
            (Some(l), None) => self.materialize_one_side(id, l, key, path, /*added=*/ false),
            (None, Some(r)) => self.materialize_one_side(id, r, key, path, /*added=*/ true),
            (None, None) => unreachable!("diff_node called with both sides None"),
        }
    }

    fn diff_present(
        &mut self,
        id: u32,
        l: Value,
        r: Value,
        key: DiffKey,
        path: String,
    ) -> DiffNode {
        match (l, r) {
            // Object vs object
            (Value::Object(lmap), Value::Object(rmap)) => {
                let mut keys: Vec<String> = lmap
                    .keys()
                    .chain(rmap.keys())
                    .cloned()
                    .collect();
                keys.sort();
                keys.dedup();

                let key_count = lmap.len().max(rmap.len()) as u32;

                let mut children = Vec::with_capacity(keys.len());
                let mut child_diff = false;

                let mut lmap = lmap;
                let mut rmap = rmap;
                for k in keys {
                    let child_path = join_object_key(&path, &k);
                    let child_key = DiffKey::Object { name: k.clone() };
                    let lv = lmap.remove(&k);
                    let rv = rmap.remove(&k);
                    let child = self.diff_node(lv, rv, child_key, child_path);
                    if child.has_difference {
                        child_diff = true;
                    }
                    children.push(child);
                }

                DiffNode {
                    id,
                    key,
                    path,
                    status: DiffStatus::Equal {
                        value: DiffValue::Object { key_count },
                    },
                    children,
                    has_difference: child_diff,
                }
            }

            // Array vs array
            (Value::Array(larr), Value::Array(rarr)) => {
                let item_count = larr.len().max(rarr.len()) as u32;
                let max_len = larr.len().max(rarr.len());

                let mut larr_iter = larr.into_iter();
                let mut rarr_iter = rarr.into_iter();

                let mut children = Vec::with_capacity(max_len);
                let mut child_diff = false;

                for i in 0..max_len {
                    let lv = larr_iter.next();
                    let rv = rarr_iter.next();
                    let child_path = join_array_index(&path, i as u32);
                    let child_key = DiffKey::Array { index: i as u32 };
                    let child = self.diff_node(lv, rv, child_key, child_path);
                    if child.has_difference {
                        child_diff = true;
                    }
                    children.push(child);
                }

                DiffNode {
                    id,
                    key,
                    path,
                    status: DiffStatus::Equal {
                        value: DiffValue::Array { item_count },
                    },
                    children,
                    has_difference: child_diff,
                }
            }

            // Same primitive type — compare for equality.
            (Value::Null, Value::Null) => DiffNode {
                id,
                key,
                path,
                status: DiffStatus::Equal {
                    value: DiffValue::Null,
                },
                children: Vec::new(),
                has_difference: false,
            },

            (Value::Bool(lb), Value::Bool(rb)) => {
                if lb == rb {
                    DiffNode {
                        id,
                        key,
                        path,
                        status: DiffStatus::Equal {
                            value: DiffValue::Bool { value: lb },
                        },
                        children: Vec::new(),
                        has_difference: false,
                    }
                } else {
                    self.differences += 1;
                    DiffNode {
                        id,
                        key,
                        path,
                        status: DiffStatus::Modified {
                            left: DiffValue::Bool { value: lb },
                            right: DiffValue::Bool { value: rb },
                        },
                        children: Vec::new(),
                        has_difference: true,
                    }
                }
            }

            (Value::Number(ln), Value::Number(rn)) => {
                let l_raw = ln.to_string();
                let r_raw = rn.to_string();
                if l_raw == r_raw {
                    DiffNode {
                        id,
                        key,
                        path,
                        status: DiffStatus::Equal {
                            value: DiffValue::Number { raw: l_raw },
                        },
                        children: Vec::new(),
                        has_difference: false,
                    }
                } else {
                    self.differences += 1;
                    DiffNode {
                        id,
                        key,
                        path,
                        status: DiffStatus::Modified {
                            left: DiffValue::Number { raw: l_raw },
                            right: DiffValue::Number { raw: r_raw },
                        },
                        children: Vec::new(),
                        has_difference: true,
                    }
                }
            }

            (Value::String(ls), Value::String(rs)) => {
                if ls == rs {
                    DiffNode {
                        id,
                        key,
                        path,
                        status: DiffStatus::Equal {
                            value: DiffValue::String { value: ls },
                        },
                        children: Vec::new(),
                        has_difference: false,
                    }
                } else {
                    self.differences += 1;
                    DiffNode {
                        id,
                        key,
                        path,
                        status: DiffStatus::Modified {
                            left: DiffValue::String { value: ls },
                            right: DiffValue::String { value: rs },
                        },
                        children: Vec::new(),
                        has_difference: true,
                    }
                }
            }

            // Different types — TypeChanged. No recursion below.
            (l, r) => {
                self.differences += 1;
                DiffNode {
                    id,
                    key,
                    path,
                    status: DiffStatus::TypeChanged {
                        left: shallow_value(&l),
                        right: shallow_value(&r),
                    },
                    children: Vec::new(),
                    has_difference: true,
                }
            }
        }
    }

    /// Materialize a one-sided subtree (Added or Removed). The container
    /// itself is Added/Removed; children are materialized recursively
    /// with fresh ids so the UI can show what was added/removed.
    fn materialize_one_side(
        &mut self,
        id: u32,
        v: Value,
        key: DiffKey,
        path: String,
        added: bool,
    ) -> DiffNode {
        self.differences += 1;
        let shallow = shallow_value(&v);
        let status = if added {
            DiffStatus::Added { right: shallow }
        } else {
            DiffStatus::Removed { left: shallow }
        };
        let children = match v {
            Value::Object(map) => {
                let mut keys: Vec<String> = map.keys().cloned().collect();
                keys.sort();
                let mut map = map;
                let mut children = Vec::with_capacity(keys.len());
                for k in keys {
                    let child_path = join_object_key(&path, &k);
                    let child_key = DiffKey::Object { name: k.clone() };
                    let child_value = map.remove(&k).unwrap_or(Value::Null);
                    let child_id = self.alloc_id();
                    let child = self.materialize_one_side(
                        child_id,
                        child_value,
                        child_key,
                        child_path,
                        added,
                    );
                    children.push(child);
                }
                children
            }
            Value::Array(arr) => {
                let mut children = Vec::with_capacity(arr.len());
                for (i, item) in arr.into_iter().enumerate() {
                    let child_path = join_array_index(&path, i as u32);
                    let child_key = DiffKey::Array { index: i as u32 };
                    let child_id = self.alloc_id();
                    let child = self.materialize_one_side(
                        child_id,
                        item,
                        child_key,
                        child_path,
                        added,
                    );
                    children.push(child);
                }
                children
            }
            _ => Vec::new(),
        };
        DiffNode {
            id,
            key,
            path,
            status,
            children,
            has_difference: true,
        }
    }
}

/// Build a `DiffValue` (a "shallow" tag describing the value's shape) from
/// a `serde_json::Value` without descending into containers.
fn shallow_value(v: &Value) -> DiffValue {
    match v {
        Value::Null => DiffValue::Null,
        Value::Bool(b) => DiffValue::Bool { value: *b },
        Value::Number(n) => DiffValue::Number { raw: n.to_string() },
        Value::String(s) => DiffValue::String { value: s.clone() },
        Value::Object(map) => DiffValue::Object {
            key_count: map.len() as u32,
        },
        Value::Array(arr) => DiffValue::Array {
            item_count: arr.len() as u32,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn parse(s: &str) -> Value {
        serde_json::from_str(s).unwrap()
    }

    #[test]
    fn equal_primitives() {
        let t = build_diff(parse("42"), parse("42"));
        assert_eq!(t.stats.total_nodes, 1);
        assert_eq!(t.stats.differences, 0);
        assert!(!t.root.has_difference);
        match &t.root.status {
            DiffStatus::Equal {
                value: DiffValue::Number { raw },
            } => assert_eq!(raw, "42"),
            other => panic!("expected Equal Number, got {other:?}"),
        }
        assert_eq!(t.root.path, "");
    }

    #[test]
    fn modified_primitives() {
        let t = build_diff(parse("1"), parse("2"));
        assert_eq!(t.stats.differences, 1);
        assert!(t.root.has_difference);
        match &t.root.status {
            DiffStatus::Modified {
                left: DiffValue::Number { raw: l },
                right: DiffValue::Number { raw: r },
            } => {
                assert_eq!(l, "1");
                assert_eq!(r, "2");
            }
            other => panic!("expected Modified Number, got {other:?}"),
        }
    }

    #[test]
    fn type_changed_primitives() {
        let t = build_diff(parse("\"hello\""), parse("42"));
        assert_eq!(t.stats.differences, 1);
        assert!(t.root.has_difference);
        match &t.root.status {
            DiffStatus::TypeChanged { left, right } => {
                assert!(matches!(left, DiffValue::String { .. }));
                assert!(matches!(right, DiffValue::Number { .. }));
            }
            other => panic!("expected TypeChanged, got {other:?}"),
        }
        // No children for TypeChanged.
        assert!(t.root.children.is_empty());
    }

    #[test]
    fn object_key_order_insensitive_equal() {
        let t = build_diff(parse(r#"{"a":1,"b":2}"#), parse(r#"{"b":2,"a":1}"#));
        assert!(!t.root.has_difference);
        assert_eq!(t.stats.differences, 0);
        // root + 2 children.
        assert_eq!(t.stats.total_nodes, 3);
        // children sorted alphabetically.
        assert_eq!(t.root.children.len(), 2);
        assert!(matches!(
            t.root.children[0].key,
            DiffKey::Object { ref name } if name == "a"
        ));
        assert!(matches!(
            t.root.children[1].key,
            DiffKey::Object { ref name } if name == "b"
        ));
    }

    #[test]
    fn object_added_child() {
        let t = build_diff(parse(r#"{"a":1}"#), parse(r#"{"a":1,"b":2}"#));
        assert!(t.root.has_difference);
        assert_eq!(t.stats.differences, 1);
        let child_b = t
            .root
            .children
            .iter()
            .find(|c| matches!(&c.key, DiffKey::Object { name } if name == "b"))
            .expect("child b present");
        assert!(child_b.has_difference);
        match &child_b.status {
            DiffStatus::Added {
                right: DiffValue::Number { raw },
            } => assert_eq!(raw, "2"),
            other => panic!("expected Added, got {other:?}"),
        }
        assert_eq!(child_b.path, "b");
    }

    #[test]
    fn object_removed_child() {
        let t = build_diff(parse(r#"{"a":1,"b":2}"#), parse(r#"{"a":1}"#));
        assert!(t.root.has_difference);
        assert_eq!(t.stats.differences, 1);
        let child_b = t
            .root
            .children
            .iter()
            .find(|c| matches!(&c.key, DiffKey::Object { name } if name == "b"))
            .expect("child b present");
        match &child_b.status {
            DiffStatus::Removed {
                left: DiffValue::Number { raw },
            } => assert_eq!(raw, "2"),
            other => panic!("expected Removed, got {other:?}"),
        }
    }

    #[test]
    fn array_positional_modified() {
        let t = build_diff(parse("[1,2,3]"), parse("[1,9,3]"));
        assert!(t.root.has_difference);
        assert_eq!(t.stats.differences, 1);
        // root + 3 children.
        assert_eq!(t.stats.total_nodes, 4);
        let mid = &t.root.children[1];
        assert_eq!(mid.path, "[1]");
        match &mid.status {
            DiffStatus::Modified {
                left: DiffValue::Number { raw: l },
                right: DiffValue::Number { raw: r },
            } => {
                assert_eq!(l, "2");
                assert_eq!(r, "9");
            }
            other => panic!("expected Modified, got {other:?}"),
        }
    }

    #[test]
    fn array_trailing_added() {
        let t = build_diff(parse("[1,2]"), parse("[1,2,3]"));
        assert!(t.root.has_difference);
        assert_eq!(t.stats.differences, 1);
        let last = &t.root.children[2];
        assert_eq!(last.path, "[2]");
        match &last.status {
            DiffStatus::Added {
                right: DiffValue::Number { raw },
            } => assert_eq!(raw, "3"),
            other => panic!("expected Added, got {other:?}"),
        }
    }

    #[test]
    fn array_trailing_removed() {
        let t = build_diff(parse("[1,2,3]"), parse("[1,2]"));
        assert!(t.root.has_difference);
        assert_eq!(t.stats.differences, 1);
        let last = &t.root.children[2];
        match &last.status {
            DiffStatus::Removed {
                left: DiffValue::Number { raw },
            } => assert_eq!(raw, "3"),
            other => panic!("expected Removed, got {other:?}"),
        }
    }

    #[test]
    fn nested_has_difference_rolls_up() {
        let l = json!({
            "outer": {
                "inner": [
                    {"x": 1},
                    {"x": 2},
                    {"x": 3}
                ]
            }
        });
        let r = json!({
            "outer": {
                "inner": [
                    {"x": 1},
                    {"x": 2},
                    {"x": 99}
                ]
            }
        });
        let t = build_diff(l, r);
        assert!(t.root.has_difference);
        // Drill outer.inner[2].x
        let outer = &t.root.children[0];
        assert!(outer.has_difference);
        let inner = &outer.children[0];
        assert!(inner.has_difference);
        let item2 = &inner.children[2];
        assert!(item2.has_difference);
        let x = &item2.children[0];
        assert!(x.has_difference);
        assert_eq!(x.path, "outer.inner[2].x");
        match &x.status {
            DiffStatus::Modified {
                left: DiffValue::Number { raw: l },
                right: DiffValue::Number { raw: r },
            } => {
                assert_eq!(l, "3");
                assert_eq!(r, "99");
            }
            other => panic!("expected Modified, got {other:?}"),
        }
        // Items 0 and 1 should not have diffs.
        assert!(!inner.children[0].has_difference);
        assert!(!inner.children[1].has_difference);
        // Exactly one difference at the leaf.
        assert_eq!(t.stats.differences, 1);
    }

    #[test]
    fn build_diff_from_strings_success() {
        let t = build_diff_from_strings("{\"a\":1}", "{\"a\":2}").unwrap();
        assert!(t.root.has_difference);
        assert_eq!(t.stats.differences, 1);
    }

    #[test]
    fn build_diff_from_strings_parse_error() {
        let err = build_diff_from_strings("{not json", "{}").unwrap_err();
        match err {
            AppError::Parse { .. } => {}
            other => panic!("expected AppError::Parse, got {other:?}"),
        }
    }

    #[test]
    fn stats_counting_simple_modify() {
        // {"a":1,"b":2} vs {"a":1,"b":9}
        // root + 2 children = 3 nodes; one of them differs.
        let t = build_diff(parse(r#"{"a":1,"b":2}"#), parse(r#"{"a":1,"b":9}"#));
        assert_eq!(t.stats.total_nodes, 3);
        assert_eq!(t.stats.differences, 1);
    }

    #[test]
    fn serde_flatten_roundtrip_modified() {
        let t = build_diff(parse("1"), parse("2"));
        let v = serde_json::to_value(&t.root).unwrap();
        assert_eq!(v["status"], "modified");
        assert!(v["left"].is_object());
        assert!(v["right"].is_object());
        assert_eq!(v["right"]["raw"], "2");
        assert_eq!(v["left"]["raw"], "1");
        // Status field should NOT be a nested object.
        assert!(v.get("status").unwrap().is_string());
    }

    #[test]
    fn serde_flatten_roundtrip_equal() {
        let t = build_diff(parse("7"), parse("7"));
        let v = serde_json::to_value(&t.root).unwrap();
        assert_eq!(v["status"], "equal");
        assert!(v["value"].is_object());
        assert_eq!(v["value"]["raw"], "7");
    }

    #[test]
    fn added_subtree_recursively_materialized() {
        // Right adds a whole nested object.
        let t = build_diff(
            parse(r#"{}"#),
            parse(r#"{"x":{"a":1,"b":[10,20]}}"#),
        );
        assert!(t.root.has_difference);
        // root (Equal) + x (Added) + a (Added) + b (Added array) + b[0] + b[1] = 6 nodes
        assert_eq!(t.stats.total_nodes, 6);
        // Everything under x is a difference, including x itself = 5 differences
        assert_eq!(t.stats.differences, 5);

        let x = &t.root.children[0];
        match &x.status {
            DiffStatus::Added {
                right: DiffValue::Object { key_count },
            } => assert_eq!(*key_count, 2),
            other => panic!("expected Added Object, got {other:?}"),
        }
        assert_eq!(x.children.len(), 2);
        // Children sorted alphabetically: a, b.
        let a = &x.children[0];
        assert_eq!(a.path, "x.a");
        match &a.status {
            DiffStatus::Added {
                right: DiffValue::Number { raw },
            } => assert_eq!(raw, "1"),
            other => panic!("expected Added Number, got {other:?}"),
        }
        let b = &x.children[1];
        assert_eq!(b.path, "x.b");
        match &b.status {
            DiffStatus::Added {
                right: DiffValue::Array { item_count },
            } => assert_eq!(*item_count, 2),
            other => panic!("expected Added Array, got {other:?}"),
        }
        assert_eq!(b.children.len(), 2);
        assert_eq!(b.children[0].path, "x.b[0]");
        assert_eq!(b.children[1].path, "x.b[1]");
    }

    #[test]
    fn weird_key_uses_bracket_path() {
        let t = build_diff(parse(r#"{"weird-key":1}"#), parse(r#"{"weird-key":2}"#));
        let child = &t.root.children[0];
        assert_eq!(child.path, r#"["weird-key"]"#);
    }

    #[test]
    fn array_inside_object_path() {
        // For {"a":[10,20]} vs {"a":[10,99]}, the path of 99 should be "a[1]".
        let t = build_diff(parse(r#"{"a":[10,20]}"#), parse(r#"{"a":[10,99]}"#));
        let a = &t.root.children[0];
        assert_eq!(a.path, "a");
        let last = &a.children[1];
        assert_eq!(last.path, "a[1]");
        match &last.status {
            DiffStatus::Modified {
                left: DiffValue::Number { raw: l },
                right: DiffValue::Number { raw: r },
            } => {
                assert_eq!(l, "20");
                assert_eq!(r, "99");
            }
            other => panic!("expected Modified, got {other:?}"),
        }
    }
}
