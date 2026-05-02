# JSON Viewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the JSON Viewer placeholder with a fully functional viewer: CodeMirror 6 editor, Rust-side parser with auto-unescape, virtualized tree view with default-expanded nodes, large-array auto-collapse, click-to-toggle nested JSON strings, search by key/value/both, copy value or JS dot-path, format/minify/unescape-in-place, and history save/load.

**Architecture:** All JSON parse and tree construction happens in Rust (`json_parse`, `json_parse_nested`, `json_format`, `json_unescape`). Frontend stores the returned `JsonTree` in a Zustand store and renders a flattened-list virtualized tree using `react-window`. The editor side (CodeMirror 6) debounces input and feeds it to the parser; parse errors flow back as `AppError::Parse { line, col, message }` and are rendered as a red squiggle via CodeMirror's `linter()` extension.

**Tech Stack:** serde_json (arbitrary_precision) · `JsonTree` domain model · CodeMirror 6 (`@codemirror/state` `@codemirror/view` `@codemirror/lang-json` `@codemirror/lint`) · `react-window` · Zustand · existing i18n + AppError + history infrastructure.

---

## Conventions

- **Working directory:** `/Users/tristoney/dev_tool`. All paths relative.
- **Branch:** create `plan-2-json-viewer` off `main` before starting.
- **Tests:** Rust via `cargo test --manifest-path src-tauri/Cargo.toml`. Frontend via `npm test -- --run`.
- **Commit format:** Conventional Commits with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer. Each task is one commit.
- **i18n:** All new user-facing strings go into BOTH `src/i18n/locales/zh-CN.json` and `src/i18n/locales/en.json`. Use `t()` everywhere — no hardcoded user-visible English/Chinese.
- **Tool key:** the tool's i18n namespace is `json_viewer.*` (under the existing `tools.json_viewer` label).

---

## File Structure

### Backend (Rust) — files created/modified

```
src-tauri/src/
├── domain/
│   ├── json_tree.rs              # NEW: JsonTree, JsonNode, NodeValue, NodeKey, build_tree
│   ├── unescape.rs               # NEW: parse_with_auto_unescape (≤3 layers)
│   ├── nested_detect.rs          # NEW: detect string-as-JSON, build NestedHint
│   ├── path.rs                   # NEW: build JS dot-path with bracket fallback
│   ├── escape.rs                 # NEW: json_escape / json_unescape pure logic
│   └── mod.rs                    # MODIFY: declare new submodules
├── commands/
│   ├── json.rs                   # NEW: json_parse, json_parse_nested, json_format, json_unescape commands
│   └── mod.rs                    # MODIFY: declare json submodule
└── lib.rs                        # MODIFY: register new commands in invoke_handler
```

**Why these files:** the domain logic (tree, unescape, nested-detect, path, escape) has no Tauri concerns and is easily unit-tested in isolation. The Tauri commands (`commands/json.rs`) are a thin adapter layer.

### Frontend (TypeScript) — files created/modified

```
src/
├── tools/json-viewer/
│   ├── index.tsx                 # MODIFY: replace placeholder with full layout
│   ├── store.ts                  # NEW: Zustand store (input text, tree, parse error, expansion state, search, loadedHistoryId)
│   ├── api.ts                    # NEW: jsonApi wrapping invoke for parse/parseNested/format/unescape
│   ├── flatten.ts                # NEW: tree → visible flat node list (respects collapse + nested-expansion + search)
│   ├── path.ts                   # NEW: JS dot-path builder helper (mirrors Rust impl for client-side path display)
│   ├── Editor.tsx                # NEW: CodeMirror wrapper component
│   ├── lint.ts                   # NEW: CodeMirror linter integrating with parse error
│   ├── Tree.tsx                  # NEW: virtualized tree (react-window VariableSizeList)
│   ├── TreeNode.tsx              # NEW: single tree row (chevron + key + value/preview + nested badge + copy menu)
│   ├── SearchBar.tsx             # NEW: search input + mode selector (key/value/both)
│   ├── Toolbar.tsx               # NEW: Format / Minify / Unescape in place / Clear / Save buttons
│   ├── SaveButton.tsx            # NEW: opens SaveDialog and writes via history store
│   ├── nodePreview.ts            # NEW: collapsed-state preview string ("{ \"a\": ..., +N } 8 keys")
│   └── __tests__/
│       ├── flatten.test.ts
│       ├── path.test.ts
│       ├── nodePreview.test.ts
│       └── store.test.ts
├── lib/
│   └── clipboard.ts              # NEW: thin wrapper around navigator.clipboard with fallback
└── i18n/locales/
    ├── zh-CN.json                # MODIFY: add json_viewer.* keys
    └── en.json                   # MODIFY: add json_viewer.* keys
```

**Why these files:** `flatten.ts`, `path.ts`, `nodePreview.ts` are pure functions easy to unit-test. `Editor.tsx` and `Tree.tsx` are presentational. `store.ts` holds all view state. `api.ts` mirrors the pattern from `src/history/api.ts`.

### npm dependencies to add

```
@codemirror/state @codemirror/view @codemirror/commands @codemirror/lang-json @codemirror/lint
react-window
@types/react-window
```

---

## Task 1: Branch + scaffold deps

**Files:**
- Modify: `package.json` (via npm install)
- Create: branch `plan-2-json-viewer`

- [ ] **Step 1.1: Create branch**

```bash
cd /Users/tristoney/dev_tool
git checkout main
git pull --ff-only || true
git checkout -b plan-2-json-viewer
```

- [ ] **Step 1.2: Install npm deps**

```bash
npm install @codemirror/state @codemirror/view @codemirror/commands @codemirror/lang-json @codemirror/lint react-window
npm install --save-dev @types/react-window
```

Expected: `npm install` exits 0. `package.json` gains the deps. Versions can be the latest at install time.

- [ ] **Step 1.3: Verify build still works**

```bash
npm run build
```

Expected: build succeeds (no usage yet, just deps installed).

- [ ] **Step 1.4: Commit**

```bash
git add package.json package-lock.json
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
chore(deps): add CodeMirror 6 + react-window for JSON Viewer

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Rust JS dot-path builder

**Files:**
- Create: `src-tauri/src/domain/path.rs`
- Modify: `src-tauri/src/domain/mod.rs`

- [ ] **Step 2.1: Update mod.rs**

Append to `src-tauri/src/domain/mod.rs`:

```rust
pub mod path;
```

- [ ] **Step 2.2: Write the path module with tests**

Create `src-tauri/src/domain/path.rs`:

```rust
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
        assert_eq!(join_object_key("", "0"), r#"[""0""]"#.replace(r#"""#, "\""));
        // Specifically: key starting with a digit is NOT a valid identifier.
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
```

- [ ] **Step 2.3: Run tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml domain::path
```

Expected: 5 tests pass.

- [ ] **Step 2.4: Commit**

```bash
git add src-tauri/src/domain/path.rs src-tauri/src/domain/mod.rs
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
feat(domain): add JS dot-path builder with bracket fallback

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Rust auto-unescape

**Files:**
- Create: `src-tauri/src/domain/unescape.rs`
- Modify: `src-tauri/src/domain/mod.rs`

- [ ] **Step 3.1: Update mod.rs**

Append:

```rust
pub mod unescape;
```

- [ ] **Step 3.2: Write the module with tests**

Create `src-tauri/src/domain/unescape.rs`:

```rust
//! Auto-unescape JSON input. If `serde_json::from_str` fails, treat the
//! input as a JSON string literal (wrap with quotes if needed) and try
//! again, recursing up to 3 layers. Returns the parsed value plus the
//! number of unescape layers peeled.

use crate::error::AppError;
use serde_json::Value;

pub const MAX_UNESCAPE_LAYERS: u8 = 3;

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
```

- [ ] **Step 3.3: Run tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml domain::unescape
```

Expected: 6 tests pass.

- [ ] **Step 3.4: Commit**

```bash
git add src-tauri/src/domain/unescape.rs src-tauri/src/domain/mod.rs
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
feat(domain): add parse_with_auto_unescape (≤3 layers)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Nested JSON detection

**Files:**
- Create: `src-tauri/src/domain/nested_detect.rs`
- Modify: `src-tauri/src/domain/mod.rs`

- [ ] **Step 4.1: Update mod.rs**

Append:

```rust
pub mod nested_detect;
```

- [ ] **Step 4.2: Write module with tests**

Create `src-tauri/src/domain/nested_detect.rs`:

```rust
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
```

- [ ] **Step 4.3: Run tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml domain::nested_detect
```

Expected: 7 tests pass.

- [ ] **Step 4.4: Commit**

```bash
git add src-tauri/src/domain/nested_detect.rs src-tauri/src/domain/mod.rs
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
feat(domain): add nested JSON detection for string values

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: JsonTree domain types + builder

**Files:**
- Create: `src-tauri/src/domain/json_tree.rs`
- Modify: `src-tauri/src/domain/mod.rs`

- [ ] **Step 5.1: Update mod.rs**

Append:

```rust
pub mod json_tree;
```

- [ ] **Step 5.2: Write the module with tests**

Create `src-tauri/src/domain/json_tree.rs`:

```rust
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
    Bool(bool),
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
            Value::Bool(b) => NodeValue::Bool(b),
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
```

- [ ] **Step 5.3: Run tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml domain::json_tree
```

Expected: 10 tests pass.

- [ ] **Step 5.4: Commit**

```bash
git add src-tauri/src/domain/json_tree.rs src-tauri/src/domain/mod.rs
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
feat(domain): add JsonTree builder with paths and nested hints

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Rust escape/unescape pure logic

**Files:**
- Create: `src-tauri/src/domain/escape.rs`
- Modify: `src-tauri/src/domain/mod.rs`

- [ ] **Step 6.1: Update mod.rs**

Append:

```rust
pub mod escape;
```

- [ ] **Step 6.2: Write module with tests**

Create `src-tauri/src/domain/escape.rs`:

```rust
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
```

- [ ] **Step 6.3: Run tests**

```bash
cargo test --manifest-path src-tauri/Cargo.toml domain::escape
```

Expected: 5 tests pass.

- [ ] **Step 6.4: Commit**

```bash
git add src-tauri/src/domain/escape.rs src-tauri/src/domain/mod.rs
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
feat(domain): add JSON string escape/unescape helpers

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Rust Tauri commands for JSON viewer

**Files:**
- Create: `src-tauri/src/commands/json.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 7.1: Update commands/mod.rs**

Append:

```rust
pub mod json;
```

- [ ] **Step 7.2: Create commands/json.rs**

```rust
use crate::domain::escape::{escape, unescape};
use crate::domain::json_tree::{build_from_text, build_from_value, JsonTree};
use crate::error::AppError;
use serde_json::Value;

#[tauri::command]
pub async fn json_parse(input: String) -> Result<JsonTree, AppError> {
    tauri::async_runtime::spawn_blocking(move || build_from_text(&input))
        .await
        .map_err(|e| AppError::Internal(format!("spawn_blocking join error: {e}")))?
}

#[tauri::command]
pub async fn json_parse_nested(input: String) -> Result<JsonTree, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let value: Value = serde_json::from_str(&input)?;
        Ok::<_, AppError>(build_from_value(value))
    })
    .await
    .map_err(|e| AppError::Internal(format!("spawn_blocking join error: {e}")))?
}

#[tauri::command]
pub fn json_format(input: String, indent: u8) -> Result<String, AppError> {
    let value: Value = serde_json::from_str(&input)?;
    if indent == 0 {
        Ok(serde_json::to_string(&value)?)
    } else {
        // serde_json's pretty printer uses 2 spaces; we only honor indent=0 vs >0
        // (any non-zero indent yields the standard pretty form).
        Ok(serde_json::to_string_pretty(&value)?)
    }
}

#[tauri::command]
pub fn json_unescape(input: String) -> Result<String, AppError> {
    unescape(&input)
}

#[tauri::command]
pub fn json_escape(input: String) -> Result<String, AppError> {
    Ok(escape(&input))
}
```

- [ ] **Step 7.3: Wire commands into lib.rs**

Modify `src-tauri/src/lib.rs` to include the new commands in `invoke_handler`. Find the existing `tauri::generate_handler![…]` block and replace it:

```rust
        .invoke_handler(tauri::generate_handler![
            commands::history::history_save,
            commands::history::history_list,
            commands::history::history_get,
            commands::history::history_delete,
            commands::json::json_parse,
            commands::json::json_parse_nested,
            commands::json::json_format,
            commands::json::json_unescape,
            commands::json::json_escape,
        ])
```

- [ ] **Step 7.4: Build + run all tests**

```bash
cargo build --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml --lib
```

Expected: 16 prior tests + 5 escape + 6 unescape + 7 nested_detect + 5 path + 10 json_tree = 49 tests pass. Build succeeds.

- [ ] **Step 7.5: Commit**

```bash
git add src-tauri/src/commands/ src-tauri/src/lib.rs
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
feat(commands): wire json_parse/parse_nested/format/escape/unescape commands

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Frontend types + i18n keys for JSON viewer

**Files:**
- Modify: `src/types/ipc.ts` (extend with JsonTree types)
- Modify: `src/i18n/locales/zh-CN.json`
- Modify: `src/i18n/locales/en.json`

- [ ] **Step 8.1: Append types to `src/types/ipc.ts`**

Open `src/types/ipc.ts` and append at the end:

```ts
// ----- JSON Viewer types (mirror src-tauri/src/domain/json_tree.rs) -----

export type NodeKey =
  | { kind: "root" }
  | { kind: "object"; name: string }
  | { kind: "array"; index: number };

export interface NestedHint {
  kind_summary: string;
}

export type NodeValue =
  | { type: "null" }
  | { type: "bool"; value: boolean }
  | { type: "number"; raw: string }
  | { type: "string"; value: string; nested_hint: NestedHint | null }
  | {
      type: "object";
      children: JsonNode[];
      key_count: number;
    }
  | {
      type: "array";
      children: JsonNode[];
      item_count: number;
    };

export interface JsonNode {
  id: number;
  key: NodeKey;
  path: string;
  value: NodeValue;
}

export interface TreeStats {
  total_nodes: number;
  max_depth: number;
  byte_size: number;
}

export interface JsonTree {
  root: JsonNode;
  stats: TreeStats;
  unescape_layers: number;
}
```

Note: serde's `#[serde(tag = "type", rename_all = "snake_case")]` produces `{ "type": "bool", "value": true }` for `NodeValue::Bool(b)` because `Bool` is a tuple variant. To keep the TS type exhaustive and aligned, the `bool` case carries a `value: boolean` field. **However**, `serde` actually emits a tuple variant `Bool(bool)` as `{ "type": "bool", "0": true }` when using `tag` + tuple. If you observe the actual JSON during testing and it doesn't match, see Task 8b below.

- [ ] **Step 8.2: Verify the actual JSON shape and adjust if needed**

Run a quick smoke check by adding a temporary unit test (do NOT commit it). In `src-tauri/src/domain/json_tree.rs`'s `tests` module, add temporarily:

```rust
#[test]
fn debug_print_bool_shape() {
    let tree = build_from_text("true").unwrap();
    println!("{}", serde_json::to_string(&tree).unwrap());
}
```

Run with `cargo test --manifest-path src-tauri/Cargo.toml domain::json_tree::tests::debug_print_bool_shape -- --nocapture`. Inspect the output to confirm the `value` field shape for the `Bool` variant. If it shows `"0": true`, change the TS type to:

```ts
| { type: "bool"; "0": boolean }
```

…and consume it in TreeNode as `node.value["0"]`. **Better approach**: change Rust's `NodeValue::Bool(bool)` to `NodeValue::Bool { value: bool }` in the existing `json_tree.rs` (in the same file you wrote in Task 5) and update Task 5 tests. Then the TS type can stay as written. **Make this change now if needed**, then remove the temporary debug test before committing.

- [ ] **Step 8.3: Add i18n keys**

Append the following block inside the top-level object of `src/i18n/locales/zh-CN.json` (insert after the `tools` block):

```json
  "json_viewer": {
    "editor_placeholder": "在此粘贴 JSON…",
    "tree_empty": "输入有效 JSON 后将自动渲染。",
    "auto_unescape_pill": "已自动反转义 {{n}} 层",
    "format": "格式化",
    "minify": "压缩",
    "unescape_in_place": "就地反转义",
    "clear": "清空",
    "save": "保存…",
    "search_placeholder": "在树中搜索…",
    "search_mode_key": "键",
    "search_mode_value": "值",
    "search_mode_both": "键+值",
    "copy_value": "复制值",
    "copy_path": "复制路径",
    "expand_nested": "展开嵌套 JSON",
    "collapse_nested": "折叠嵌套 JSON",
    "expand_all_n": "展开全部 {{n}} 项",
    "type_null": "null",
    "type_bool": "bool",
    "type_object_keys": "{{n}} 个键",
    "type_array_items": "{{n}} 项",
    "copied_toast": "已复制",
    "format_failed": "格式化失败：JSON 无效",
    "save_default_title": "JSON 片段"
  }
```

(If the file already has trailing commas or other content, slot the block correctly so JSON remains valid. Run `python3 -m json.tool < src/i18n/locales/zh-CN.json` to validate.)

- [ ] **Step 8.4: Add the same keys to `en.json`**

Same structural location, English copy:

```json
  "json_viewer": {
    "editor_placeholder": "Paste JSON here…",
    "tree_empty": "Enter valid JSON to render.",
    "auto_unescape_pill": "Auto-unescaped {{n}} layer(s)",
    "format": "Format",
    "minify": "Minify",
    "unescape_in_place": "Unescape in place",
    "clear": "Clear",
    "save": "Save…",
    "search_placeholder": "Search the tree…",
    "search_mode_key": "Key",
    "search_mode_value": "Value",
    "search_mode_both": "Key+Value",
    "copy_value": "Copy value",
    "copy_path": "Copy path",
    "expand_nested": "Expand nested JSON",
    "collapse_nested": "Collapse nested JSON",
    "expand_all_n": "Expand all {{n}} items",
    "type_null": "null",
    "type_bool": "bool",
    "type_object_keys": "{{n}} keys",
    "type_array_items": "{{n}} items",
    "copied_toast": "Copied",
    "format_failed": "Format failed: invalid JSON",
    "save_default_title": "JSON snippet"
  }
```

- [ ] **Step 8.5: Build to validate types and JSON**

```bash
npm run build
```

Expected: tsc succeeds, vite emits dist/.

- [ ] **Step 8.6: Commit**

```bash
git add src/types/ipc.ts src/i18n/locales/
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
feat(types,i18n): add JsonTree TS types and json_viewer translation keys

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Frontend api wrapper

**Files:**
- Create: `src/tools/json-viewer/api.ts`

- [ ] **Step 9.1: Create api.ts**

```ts
import { ipc } from "../../lib/ipc";
import type { JsonTree } from "../../types/ipc";

export const jsonApi = {
  parse: (input: string) => ipc<JsonTree>("json_parse", { input }),
  parseNested: (input: string) => ipc<JsonTree>("json_parse_nested", { input }),
  format: (input: string, indent: number) =>
    ipc<string>("json_format", { input, indent }),
  unescape: (input: string) => ipc<string>("json_unescape", { input }),
  escape: (input: string) => ipc<string>("json_escape", { input }),
};
```

- [ ] **Step 9.2: Build to validate**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 9.3: Commit**

```bash
git add src/tools/json-viewer/api.ts
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
feat(json-viewer): add api wrapper for json_parse/format/unescape commands

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Pure helpers — `path.ts`, `nodePreview.ts`

**Files:**
- Create: `src/tools/json-viewer/path.ts`
- Create: `src/tools/json-viewer/nodePreview.ts`
- Create: `src/tools/json-viewer/__tests__/path.test.ts`
- Create: `src/tools/json-viewer/__tests__/nodePreview.test.ts`

- [ ] **Step 10.1: Write path.test.ts**

```ts
import { describe, expect, it } from "vitest";
import { joinObjectKey, joinArrayIndex } from "../path";

describe("joinObjectKey", () => {
  it("safe identifier uses dot", () => {
    expect(joinObjectKey("a", "b")).toBe("a.b");
    expect(joinObjectKey("", "root")).toBe("root");
    expect(joinObjectKey("a", "_field")).toBe("a._field");
  });

  it("weird key uses brackets", () => {
    expect(joinObjectKey("a", "weird-key")).toBe('a["weird-key"]');
    expect(joinObjectKey("a", "key.with.dots")).toBe('a["key.with.dots"]');
  });

  it("empty key uses brackets", () => {
    expect(joinObjectKey("a", "")).toBe('a[""]');
  });

  it("digit-leading key uses brackets", () => {
    expect(joinObjectKey("a", "9lives")).toBe('a["9lives"]');
  });

  it("escapes quotes inside bracketed key", () => {
    expect(joinObjectKey("a", 'say "hi"')).toBe('a["say \\"hi\\""]');
  });
});

describe("joinArrayIndex", () => {
  it("appends bracket index", () => {
    expect(joinArrayIndex("a", 0)).toBe("a[0]");
    expect(joinArrayIndex("a.b", 7)).toBe("a.b[7]");
    expect(joinArrayIndex("", 3)).toBe("[3]");
  });
});
```

- [ ] **Step 10.2: Implement path.ts**

```ts
const FIRST = /[A-Za-z_$]/;
const REST = /[A-Za-z0-9_$]/;

function isSafeIdentifier(key: string): boolean {
  if (key.length === 0) return false;
  if (!FIRST.test(key[0])) return false;
  for (let i = 1; i < key.length; i++) {
    if (!REST.test(key[i])) return false;
  }
  return true;
}

export function joinObjectKey(parent: string, key: string): string {
  if (isSafeIdentifier(key)) {
    return parent ? `${parent}.${key}` : key;
  }
  const escaped = key.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `${parent}["${escaped}"]`;
}

export function joinArrayIndex(parent: string, index: number): string {
  return `${parent}[${index}]`;
}
```

- [ ] **Step 10.3: Run tests**

```bash
npm test -- --run src/tools/json-viewer/__tests__/path.test.ts
```

Expected: 8 tests pass (5 + 3).

- [ ] **Step 10.4: Write nodePreview.test.ts**

```ts
import { describe, expect, it } from "vitest";
import { previewObject, previewArray, valueSummary } from "../nodePreview";
import type { JsonNode } from "../../../types/ipc";

const stringNode = (k: string, v: string): JsonNode => ({
  id: 0,
  key: { kind: "object", name: k },
  path: k,
  value: { type: "string", value: v, nested_hint: null },
});

const numberNode = (k: string, raw: string): JsonNode => ({
  id: 0,
  key: { kind: "object", name: k },
  path: k,
  value: { type: "number", raw },
});

describe("valueSummary", () => {
  it("primitives show their literal", () => {
    expect(valueSummary({ type: "null" })).toBe("null");
    expect(valueSummary({ type: "bool", value: true })).toBe("true");
    expect(valueSummary({ type: "number", raw: "42" })).toBe("42");
  });

  it("string shown quoted, truncated to 30 chars", () => {
    expect(valueSummary({ type: "string", value: "hi", nested_hint: null })).toBe('"hi"');
    const long = "a".repeat(50);
    expect(
      valueSummary({ type: "string", value: long, nested_hint: null }),
    ).toBe('"' + "a".repeat(30) + '…"');
  });

  it("object/array show ellipsis with brackets", () => {
    expect(valueSummary({ type: "object", children: [], key_count: 5 })).toBe("{...}");
    expect(valueSummary({ type: "array", children: [], item_count: 3 })).toBe("[...]");
  });
});

describe("previewObject", () => {
  it("empty object", () => {
    expect(previewObject([])).toBe("{ }");
  });

  it("one key", () => {
    expect(previewObject([stringNode("a", "x")])).toBe('{ "a": "x" }');
  });

  it("two keys", () => {
    expect(previewObject([stringNode("a", "x"), stringNode("b", "y")])).toBe(
      '{ "a": "x", "b": "y" }',
    );
  });

  it("more than two keys shows +N", () => {
    expect(
      previewObject([
        stringNode("a", "x"),
        stringNode("b", "y"),
        stringNode("c", "z"),
        stringNode("d", "w"),
      ]),
    ).toBe('{ "a": "x", "b": "y", +2 }');
  });
});

describe("previewArray", () => {
  it("empty array", () => {
    expect(previewArray([])).toBe("[ ]");
  });

  it("two items", () => {
    expect(previewArray([numberNode("0", "1"), numberNode("1", "2")])).toBe("[ 1, 2 ]");
  });

  it("more than two items shows +N", () => {
    expect(
      previewArray([
        numberNode("0", "1"),
        numberNode("1", "2"),
        numberNode("2", "3"),
      ]),
    ).toBe("[ 1, 2, +1 ]");
  });
});
```

- [ ] **Step 10.5: Implement nodePreview.ts**

```ts
import type { JsonNode, NodeValue } from "../../types/ipc";

const VALUE_TRUNCATE = 30;
const PREVIEW_FIRST_N = 2;

export function valueSummary(value: NodeValue): string {
  switch (value.type) {
    case "null":
      return "null";
    case "bool":
      return value.value ? "true" : "false";
    case "number":
      return value.raw;
    case "string": {
      const v = value.value;
      const trimmed = v.length > VALUE_TRUNCATE ? v.slice(0, VALUE_TRUNCATE) + "…" : v;
      return `"${trimmed}"`;
    }
    case "object":
      return "{...}";
    case "array":
      return "[...]";
  }
}

function nodeKeyLiteral(node: JsonNode): string {
  if (node.key.kind === "object") return JSON.stringify(node.key.name);
  return "";
}

export function previewObject(children: JsonNode[]): string {
  if (children.length === 0) return "{ }";
  const head = children.slice(0, PREVIEW_FIRST_N);
  const tail = children.length - head.length;
  const parts = head.map(
    (c) => `${nodeKeyLiteral(c)}: ${valueSummary(c.value)}`,
  );
  if (tail > 0) parts.push(`+${tail}`);
  return `{ ${parts.join(", ")} }`;
}

export function previewArray(children: JsonNode[]): string {
  if (children.length === 0) return "[ ]";
  const head = children.slice(0, PREVIEW_FIRST_N);
  const tail = children.length - head.length;
  const parts = head.map((c) => valueSummary(c.value));
  if (tail > 0) parts.push(`+${tail}`);
  return `[ ${parts.join(", ")} ]`;
}
```

- [ ] **Step 10.6: Run tests**

```bash
npm test -- --run src/tools/json-viewer/__tests__/
```

Expected: 8 path tests + 11 nodePreview tests = 19 pass.

- [ ] **Step 10.7: Commit**

```bash
git add src/tools/json-viewer/path.ts src/tools/json-viewer/nodePreview.ts src/tools/json-viewer/__tests__/
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
feat(json-viewer): add path joiner and node preview pure helpers

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: `flatten.ts` — tree → visible flat list

**Files:**
- Create: `src/tools/json-viewer/flatten.ts`
- Create: `src/tools/json-viewer/__tests__/flatten.test.ts`

- [ ] **Step 11.1: Write flatten.test.ts**

```ts
import { describe, expect, it } from "vitest";
import { flatten, type FlattenOptions } from "../flatten";
import type { JsonNode } from "../../../types/ipc";

const tree: JsonNode = {
  id: 0,
  key: { kind: "root" },
  path: "",
  value: {
    type: "object",
    key_count: 2,
    children: [
      {
        id: 1,
        key: { kind: "object", name: "a" },
        path: "a",
        value: { type: "number", raw: "1" },
      },
      {
        id: 2,
        key: { kind: "object", name: "b" },
        path: "b",
        value: {
          type: "array",
          item_count: 3,
          children: [
            {
              id: 3,
              key: { kind: "array", index: 0 },
              path: "b[0]",
              value: { type: "number", raw: "10" },
            },
            {
              id: 4,
              key: { kind: "array", index: 1 },
              path: "b[1]",
              value: { type: "number", raw: "20" },
            },
            {
              id: 5,
              key: { kind: "array", index: 2 },
              path: "b[2]",
              value: { type: "number", raw: "30" },
            },
          ],
        },
      },
    ],
  },
};

const defaultOpts: FlattenOptions = {
  collapseSet: new Set(),
  arrayCollapseThreshold: 100,
  nestedExpandedById: new Map(),
};

describe("flatten", () => {
  it("emits all nodes when nothing is collapsed", () => {
    const list = flatten(tree, defaultOpts);
    expect(list.map((v) => v.node.id)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("respects depth", () => {
    const list = flatten(tree, defaultOpts);
    expect(list.find((v) => v.node.id === 0)!.depth).toBe(0);
    expect(list.find((v) => v.node.id === 1)!.depth).toBe(1);
    expect(list.find((v) => v.node.id === 3)!.depth).toBe(2);
  });

  it("skips children of collapsed nodes", () => {
    const list = flatten(tree, {
      ...defaultOpts,
      collapseSet: new Set([2]),
    });
    expect(list.map((v) => v.node.id)).toEqual([0, 1, 2]);
  });

  it("auto-collapses arrays larger than threshold", () => {
    const big: JsonNode = {
      id: 100,
      key: { kind: "object", name: "big" },
      path: "big",
      value: {
        type: "array",
        item_count: 5,
        children: Array.from({ length: 5 }, (_, i) => ({
          id: 200 + i,
          key: { kind: "array", index: i },
          path: `big[${i}]`,
          value: { type: "number", raw: String(i) },
        })),
      },
    };
    const wrapper: JsonNode = {
      id: 99,
      key: { kind: "root" },
      path: "",
      value: { type: "object", key_count: 1, children: [big] },
    };
    const list = flatten(wrapper, {
      ...defaultOpts,
      arrayCollapseThreshold: 3,
    });
    // big should be visible as a row, but its children should NOT.
    const ids = list.map((v) => v.node.id);
    expect(ids).toContain(100);
    expect(ids.some((id) => id >= 200)).toBe(false);
    const bigEntry = list.find((v) => v.node.id === 100)!;
    expect(bigEntry.isCollapsed).toBe(true);
    expect(bigEntry.collapseReason).toBe("auto_array_threshold");
  });

  it("manual expansion of an auto-collapsed array overrides the threshold", () => {
    const big: JsonNode = {
      id: 100,
      key: { kind: "object", name: "big" },
      path: "big",
      value: {
        type: "array",
        item_count: 5,
        children: Array.from({ length: 5 }, (_, i) => ({
          id: 200 + i,
          key: { kind: "array", index: i },
          path: `big[${i}]`,
          value: { type: "number", raw: String(i) },
        })),
      },
    };
    const wrapper: JsonNode = {
      id: 99,
      key: { kind: "root" },
      path: "",
      value: { type: "object", key_count: 1, children: [big] },
    };
    const list = flatten(wrapper, {
      ...defaultOpts,
      arrayCollapseThreshold: 3,
      forceExpandedSet: new Set([100]),
    });
    const ids = list.map((v) => v.node.id);
    expect(ids).toContain(200);
    expect(ids).toContain(204);
  });
});
```

- [ ] **Step 11.2: Implement flatten.ts**

```ts
import type { JsonNode } from "../../types/ipc";

export type CollapseReason = "manual" | "auto_array_threshold";

export interface VisibleNode {
  node: JsonNode;
  depth: number;
  isCollapsed: boolean;
  collapseReason: CollapseReason | null;
  isExpandable: boolean;
}

export interface FlattenOptions {
  /** Node ids the user has explicitly collapsed. */
  collapseSet: Set<number>;
  /** Node ids the user has explicitly expanded (overrides auto-collapse). */
  forceExpandedSet?: Set<number>;
  /** Arrays with more than this many items are auto-collapsed. */
  arrayCollapseThreshold: number;
  /** Per-node parsed nested-JSON subtree (string nodes whose value is JSON). */
  nestedExpandedById: Map<number, JsonNode>;
}

export function flatten(root: JsonNode, opts: FlattenOptions): VisibleNode[] {
  const out: VisibleNode[] = [];
  walk(root, 0, opts, out);
  return out;
}

function walk(
  node: JsonNode,
  depth: number,
  opts: FlattenOptions,
  out: VisibleNode[],
): void {
  const isExpandable = nodeIsExpandable(node, opts);
  const collapsed = computeCollapsed(node, opts);
  out.push({
    node,
    depth,
    isCollapsed: collapsed.collapsed,
    collapseReason: collapsed.reason,
    isExpandable,
  });

  if (collapsed.collapsed) return;

  // Recurse into children based on node type.
  switch (node.value.type) {
    case "object":
    case "array":
      for (const child of node.value.children) {
        walk(child, depth + 1, opts, out);
      }
      break;
    case "string": {
      const sub = opts.nestedExpandedById.get(node.id);
      if (sub) walk(sub, depth + 1, opts, out);
      break;
    }
    default:
      break;
  }
}

function nodeIsExpandable(node: JsonNode, opts: FlattenOptions): boolean {
  if (node.value.type === "object") return node.value.children.length > 0;
  if (node.value.type === "array") return node.value.children.length > 0;
  if (node.value.type === "string") {
    return opts.nestedExpandedById.has(node.id) || node.value.nested_hint !== null;
  }
  return false;
}

function computeCollapsed(
  node: JsonNode,
  opts: FlattenOptions,
): { collapsed: boolean; reason: CollapseReason | null } {
  if (opts.collapseSet.has(node.id)) {
    return { collapsed: true, reason: "manual" };
  }
  if (
    node.value.type === "array" &&
    node.value.item_count > opts.arrayCollapseThreshold &&
    !(opts.forceExpandedSet?.has(node.id) ?? false)
  ) {
    return { collapsed: true, reason: "auto_array_threshold" };
  }
  return { collapsed: false, reason: null };
}
```

- [ ] **Step 11.3: Run tests**

```bash
npm test -- --run src/tools/json-viewer/__tests__/flatten.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 11.4: Commit**

```bash
git add src/tools/json-viewer/flatten.ts src/tools/json-viewer/__tests__/flatten.test.ts
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
feat(json-viewer): add tree-to-visible-list flattener

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: clipboard helper

**Files:**
- Create: `src/lib/clipboard.ts`

- [ ] **Step 12.1: Implement clipboard.ts**

```ts
/** Copy `text` to the system clipboard. Resolves on success, rejects on failure. */
export async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Fallback: detached textarea + execCommand. Used only in environments
  // where the Clipboard API is unavailable (older WebKit, headless).
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.position = "absolute";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } finally {
    document.body.removeChild(ta);
  }
}
```

- [ ] **Step 12.2: Build to validate**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 12.3: Commit**

```bash
git add src/lib/clipboard.ts
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
feat(lib): add clipboard helper with execCommand fallback

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: JSON viewer Zustand store

**Files:**
- Create: `src/tools/json-viewer/store.ts`
- Create: `src/tools/json-viewer/__tests__/store.test.ts`

- [ ] **Step 13.1: Write store.test.ts**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useJsonViewerStore, ARRAY_COLLAPSE_THRESHOLD } from "../store";
import type { JsonTree } from "../../../types/ipc";

vi.mock("../api", () => ({
  jsonApi: {
    parse: vi.fn(),
    parseNested: vi.fn(),
    format: vi.fn(),
    unescape: vi.fn(),
    escape: vi.fn(),
  },
}));

import { jsonApi } from "../api";

const tree: JsonTree = {
  root: {
    id: 0,
    key: { kind: "root" },
    path: "",
    value: { type: "object", key_count: 0, children: [] },
  },
  stats: { total_nodes: 1, max_depth: 0, byte_size: 2 },
  unescape_layers: 0,
};

describe("json viewer store", () => {
  beforeEach(() => {
    useJsonViewerStore.setState(useJsonViewerStore.getInitialState());
    vi.clearAllMocks();
  });

  it("setInput updates input text", () => {
    useJsonViewerStore.getState().setInput("{}");
    expect(useJsonViewerStore.getState().input).toBe("{}");
  });

  it("parse on success stores tree and clears parse error", async () => {
    (jsonApi.parse as ReturnType<typeof vi.fn>).mockResolvedValue(tree);
    await useJsonViewerStore.getState().parse("{}");
    expect(useJsonViewerStore.getState().tree).toEqual(tree);
    expect(useJsonViewerStore.getState().parseError).toBeNull();
  });

  it("parse on Parse error stores diagnostic", async () => {
    (jsonApi.parse as ReturnType<typeof vi.fn>).mockRejectedValue({
      app: { code: "parse", line: 5, col: 12, message: "bad" },
      message: "bad",
    });
    await useJsonViewerStore.getState().parse("{");
    const err = useJsonViewerStore.getState().parseError;
    expect(err).toEqual({ line: 5, col: 12, message: "bad" });
  });

  it("toggleCollapse adds and removes from collapseSet", () => {
    useJsonViewerStore.getState().toggleCollapse(7);
    expect(useJsonViewerStore.getState().collapseSet.has(7)).toBe(true);
    useJsonViewerStore.getState().toggleCollapse(7);
    expect(useJsonViewerStore.getState().collapseSet.has(7)).toBe(false);
  });

  it("setSearch updates query and mode", () => {
    useJsonViewerStore.getState().setSearch("foo", "key");
    expect(useJsonViewerStore.getState().searchQuery).toBe("foo");
    expect(useJsonViewerStore.getState().searchMode).toBe("key");
  });

  it("clear resets the store", () => {
    useJsonViewerStore.setState({ input: "x", tree, parseError: null });
    useJsonViewerStore.getState().clear();
    expect(useJsonViewerStore.getState().input).toBe("");
    expect(useJsonViewerStore.getState().tree).toBeNull();
  });

  it("ARRAY_COLLAPSE_THRESHOLD is 100", () => {
    expect(ARRAY_COLLAPSE_THRESHOLD).toBe(100);
  });
});
```

- [ ] **Step 13.2: Implement store.ts**

```ts
import { create } from "zustand";
import { jsonApi } from "./api";
import { IpcError } from "../../lib/ipc";
import type { JsonNode, JsonTree } from "../../types/ipc";

export const ARRAY_COLLAPSE_THRESHOLD = 100;

export type SearchMode = "key" | "value" | "both";

export interface ParseDiagnostic {
  line: number;
  col: number;
  message: string;
}

interface JsonViewerState {
  input: string;
  tree: JsonTree | null;
  parseError: ParseDiagnostic | null;
  unescapeLayers: number;
  collapseSet: Set<number>;
  forceExpandedSet: Set<number>;
  nestedExpandedById: Map<number, JsonNode>;
  searchQuery: string;
  searchMode: SearchMode;
  loadedHistoryId: number | null;

  setInput(text: string): void;
  parse(text: string): Promise<void>;
  parseNested(nodeId: number, value: string): Promise<void>;
  collapseNested(nodeId: number): void;
  toggleCollapse(nodeId: number): void;
  forceExpandArray(nodeId: number): void;
  setSearch(query: string, mode: SearchMode): void;
  clear(): void;
  setLoadedHistoryId(id: number | null): void;
}

const initial = {
  input: "",
  tree: null as JsonTree | null,
  parseError: null as ParseDiagnostic | null,
  unescapeLayers: 0,
  collapseSet: new Set<number>(),
  forceExpandedSet: new Set<number>(),
  nestedExpandedById: new Map<number, JsonNode>(),
  searchQuery: "",
  searchMode: "both" as SearchMode,
  loadedHistoryId: null as number | null,
};

export const useJsonViewerStore = create<JsonViewerState>((set, get) => ({
  ...initial,

  setInput(text) {
    set({ input: text });
  },

  async parse(text) {
    if (text.trim().length === 0) {
      set({ tree: null, parseError: null, unescapeLayers: 0 });
      return;
    }
    try {
      const tree = await jsonApi.parse(text);
      set({
        tree,
        parseError: null,
        unescapeLayers: tree.unescape_layers,
        collapseSet: new Set(),
        forceExpandedSet: new Set(),
        nestedExpandedById: new Map(),
      });
    } catch (e) {
      if (e instanceof IpcError && e.app.code === "parse") {
        set({
          parseError: {
            line: e.app.line,
            col: e.app.col,
            message: e.app.message,
          },
        });
      } else {
        // unexpected error type — surface as a parse-style diagnostic at 0,0
        const message = e instanceof Error ? e.message : String(e);
        set({ parseError: { line: 0, col: 0, message } });
      }
    }
  },

  async parseNested(nodeId, value) {
    const sub = await jsonApi.parseNested(value);
    const map = new Map(get().nestedExpandedById);
    map.set(nodeId, sub.root);
    set({ nestedExpandedById: map });
  },

  collapseNested(nodeId) {
    const map = new Map(get().nestedExpandedById);
    map.delete(nodeId);
    set({ nestedExpandedById: map });
  },

  toggleCollapse(nodeId) {
    const next = new Set(get().collapseSet);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    set({ collapseSet: next });
  },

  forceExpandArray(nodeId) {
    const next = new Set(get().forceExpandedSet);
    next.add(nodeId);
    set({ forceExpandedSet: next });
  },

  setSearch(query, mode) {
    set({ searchQuery: query, searchMode: mode });
  },

  clear() {
    set({ ...initial, collapseSet: new Set(), forceExpandedSet: new Set(), nestedExpandedById: new Map() });
  },

  setLoadedHistoryId(id) {
    set({ loadedHistoryId: id });
  },
}));
```

Note on initial state: zustand reuses the same `initial` object reference for every reset. We re-create the mutable Sets/Maps in `clear()` so we don't share collection instances across resets.

- [ ] **Step 13.3: Run tests**

```bash
npm test -- --run src/tools/json-viewer/__tests__/store.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 13.4: Commit**

```bash
git add src/tools/json-viewer/store.ts src/tools/json-viewer/__tests__/store.test.ts
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
feat(json-viewer): add store with parse/collapse/search/nested-expand state

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 14: CodeMirror Editor wrapper + linter

**Files:**
- Create: `src/tools/json-viewer/lint.ts`
- Create: `src/tools/json-viewer/Editor.tsx`

- [ ] **Step 14.1: Implement lint.ts**

```ts
import { linter, type Diagnostic } from "@codemirror/lint";
import type { ParseDiagnostic } from "./store";

/**
 * Build a CodeMirror linter that surfaces a single parse diagnostic
 * at the given line/col. Returns a no-op linter when `getDiag()` returns null.
 */
export function parseLinter(getDiag: () => ParseDiagnostic | null) {
  return linter((view) => {
    const diag = getDiag();
    if (!diag) return [];
    const doc = view.state.doc;
    const lineNumber = Math.max(1, Math.min(diag.line, doc.lines));
    const line = doc.line(lineNumber);
    const col = Math.max(0, Math.min(diag.col, line.length));
    const from = line.from + col;
    const to = Math.min(from + 1, line.to);
    const result: Diagnostic[] = [
      {
        from,
        to,
        severity: "error",
        message: diag.message,
      },
    ];
    return result;
  });
}
```

- [ ] **Step 14.2: Implement Editor.tsx**

```tsx
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { parseLinter } from "./lint";
import type { ParseDiagnostic } from "./store";

interface EditorProps {
  value: string;
  onChange(text: string): void;
  diagnostic: ParseDiagnostic | null;
  placeholderKey?: string;
}

export function Editor({ value, onChange, diagnostic }: EditorProps) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const diagRef = useRef(diagnostic);

  // Keep refs current so the EditorView created once below sees fresh closures.
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    diagRef.current = diagnostic;
    viewRef.current?.dispatch({}); // trigger lint refresh
  }, [diagnostic]);

  useEffect(() => {
    if (!hostRef.current) return;

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          json(),
          parseLinter(() => diagRef.current),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          EditorView.theme(
            {
              "&": { height: "100%" },
              ".cm-scroller": { fontFamily: "var(--font-mono, monospace)" },
            },
            { dark: false },
          ),
        ],
      }),
    });
    viewRef.current = view;

    // Surface a placeholder via aria so screen readers know where to type.
    hostRef.current.setAttribute(
      "aria-label",
      t("json_viewer.editor_placeholder"),
    );

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the editor doc in sync when `value` changes externally
  // (e.g. after Format / Unescape in place / loading from history).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={hostRef} className="h-full w-full overflow-hidden" />;
}
```

- [ ] **Step 14.3: Build to validate**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 14.4: Commit**

```bash
git add src/tools/json-viewer/Editor.tsx src/tools/json-viewer/lint.ts
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
feat(json-viewer): add CodeMirror Editor with parse-error linter

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 15: TreeNode + Tree (virtualized)

**Files:**
- Create: `src/tools/json-viewer/TreeNode.tsx`
- Create: `src/tools/json-viewer/Tree.tsx`

- [ ] **Step 15.1: Implement TreeNode.tsx**

```tsx
import { useTranslation } from "react-i18next";
import type { JsonNode } from "../../types/ipc";
import { previewArray, previewObject, valueSummary } from "./nodePreview";
import type { VisibleNode } from "./flatten";
import { copyToClipboard } from "../../lib/clipboard";
import { useToastStore } from "../../shell/toastStore";

interface TreeNodeProps {
  visible: VisibleNode;
  onToggleCollapse(id: number): void;
  onForceExpandArray(id: number): void;
  onExpandNested(node: JsonNode): void;
  onCollapseNested(id: number): void;
  isNestedExpanded(id: number): boolean;
  searchQuery: string;
}

const ROW_HEIGHT = 28;

function keyLabel(node: JsonNode): string {
  if (node.key.kind === "root") return "";
  if (node.key.kind === "array") return `[${node.key.index}]`;
  return JSON.stringify(node.key.name);
}

function highlight(text: string, query: string): React.ReactNode {
  if (!query) return text;
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-[color:var(--accent)] text-white px-0.5 rounded-sm">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function TreeNode({
  visible,
  onToggleCollapse,
  onForceExpandArray,
  onExpandNested,
  onCollapseNested,
  isNestedExpanded,
  searchQuery,
}: TreeNodeProps) {
  const { t } = useTranslation();
  const push = useToastStore((s) => s.push);
  const { node, depth, isCollapsed, collapseReason, isExpandable } = visible;

  const indent = { paddingLeft: `${depth * 16 + 8}px` };

  const renderValue = () => {
    if (isCollapsed) {
      if (node.value.type === "object") {
        return previewObject(node.value.children) +
          ` · ` +
          t("json_viewer.type_object_keys", { n: node.value.key_count });
      }
      if (node.value.type === "array") {
        return previewArray(node.value.children) +
          ` · ` +
          t("json_viewer.type_array_items", { n: node.value.item_count });
      }
      return valueSummary(node.value);
    }
    if (node.value.type === "object" || node.value.type === "array") {
      return ""; // when expanded, the children rows show the content
    }
    return valueSummary(node.value);
  };

  const label = keyLabel(node);

  return (
    <div
      className="flex items-center gap-1 text-sm font-mono leading-7 hover:bg-[color:var(--bg-base)] cursor-default"
      style={{ height: ROW_HEIGHT, ...indent }}
    >
      {isExpandable ? (
        <button
          type="button"
          onClick={() => onToggleCollapse(node.id)}
          className="w-4 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
        >
          {isCollapsed ? "▸" : "▾"}
        </button>
      ) : (
        <span className="w-4" />
      )}

      {label && (
        <span className="text-[color:var(--accent)]">
          {highlight(label, searchQuery)}
          <span className="text-[color:var(--text-muted)]">: </span>
        </span>
      )}

      <span className="text-[color:var(--text-primary)] truncate">
        {highlight(renderValue(), searchQuery)}
      </span>

      {collapseReason === "auto_array_threshold" &&
        node.value.type === "array" && (
          <button
            type="button"
            onClick={() => onForceExpandArray(node.id)}
            className="ml-2 text-xs text-[color:var(--accent)] hover:underline"
          >
            {t("json_viewer.expand_all_n", { n: node.value.item_count })}
          </button>
        )}

      {node.value.type === "string" && node.value.nested_hint && (
        <button
          type="button"
          onClick={() => {
            if (isNestedExpanded(node.id)) onCollapseNested(node.id);
            else onExpandNested(node);
          }}
          className="ml-2 text-xs text-[color:var(--accent)] hover:underline"
          title={
            isNestedExpanded(node.id)
              ? t("json_viewer.collapse_nested")
              : t("json_viewer.expand_nested")
          }
        >
          ⤷ JSON {node.value.nested_hint.kind_summary}
        </button>
      )}

      <div className="ml-auto opacity-0 hover:opacity-100 group-hover:opacity-100 flex gap-2 text-xs text-[color:var(--text-muted)]">
        <button
          type="button"
          onClick={async () => {
            await copyToClipboard(serializeForCopy(node));
            push("success", t("json_viewer.copied_toast"));
          }}
          className="hover:text-[color:var(--text-primary)]"
        >
          {t("json_viewer.copy_value")}
        </button>
        <button
          type="button"
          onClick={async () => {
            await copyToClipboard(node.path);
            push("success", t("json_viewer.copied_toast"));
          }}
          className="hover:text-[color:var(--text-primary)]"
        >
          {t("json_viewer.copy_path")}
        </button>
      </div>
    </div>
  );
}

function serializeForCopy(node: JsonNode): string {
  switch (node.value.type) {
    case "null":
      return "null";
    case "bool":
      return node.value.value ? "true" : "false";
    case "number":
      return node.value.raw;
    case "string":
      return node.value.value;
    case "object":
    case "array":
      return JSON.stringify(rebuildPlain(node), null, 2);
  }
}

function rebuildPlain(node: JsonNode): unknown {
  switch (node.value.type) {
    case "null":
      return null;
    case "bool":
      return node.value.value;
    case "number":
      return Number(node.value.raw);
    case "string":
      return node.value.value;
    case "object": {
      const out: Record<string, unknown> = {};
      for (const c of node.value.children) {
        if (c.key.kind === "object") out[c.key.name] = rebuildPlain(c);
      }
      return out;
    }
    case "array":
      return node.value.children.map(rebuildPlain);
  }
}
```

- [ ] **Step 15.2: Implement Tree.tsx**

```tsx
import { useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { VariableSizeList, type ListChildComponentProps } from "react-window";
import { useJsonViewerStore, ARRAY_COLLAPSE_THRESHOLD } from "./store";
import { flatten, type VisibleNode } from "./flatten";
import { TreeNode } from "./TreeNode";

const ROW_HEIGHT = 28;

export function Tree() {
  const { t } = useTranslation();
  const tree = useJsonViewerStore((s) => s.tree);
  const collapseSet = useJsonViewerStore((s) => s.collapseSet);
  const forceExpandedSet = useJsonViewerStore((s) => s.forceExpandedSet);
  const nestedExpandedById = useJsonViewerStore((s) => s.nestedExpandedById);
  const searchQuery = useJsonViewerStore((s) => s.searchQuery);
  const searchMode = useJsonViewerStore((s) => s.searchMode);

  const toggleCollapse = useJsonViewerStore((s) => s.toggleCollapse);
  const forceExpand = useJsonViewerStore((s) => s.forceExpandArray);
  const parseNested = useJsonViewerStore((s) => s.parseNested);
  const collapseNested = useJsonViewerStore((s) => s.collapseNested);

  const listRef = useRef<VariableSizeList | null>(null);

  const visible: VisibleNode[] = useMemo(() => {
    if (!tree) return [];
    const all = flatten(tree.root, {
      collapseSet,
      forceExpandedSet,
      nestedExpandedById,
      arrayCollapseThreshold: ARRAY_COLLAPSE_THRESHOLD,
    });
    if (!searchQuery) return all;
    return filterBySearch(all, searchQuery, searchMode);
  }, [
    tree,
    collapseSet,
    forceExpandedSet,
    nestedExpandedById,
    searchQuery,
    searchMode,
  ]);

  if (!tree) {
    return (
      <div className="h-full flex items-center justify-center text-[color:var(--text-muted)] text-sm">
        {t("json_viewer.tree_empty")}
      </div>
    );
  }

  const renderRow = ({ index, style }: ListChildComponentProps) => (
    <div style={style}>
      <TreeNode
        visible={visible[index]}
        onToggleCollapse={(id) => {
          toggleCollapse(id);
          listRef.current?.resetAfterIndex(0);
        }}
        onForceExpandArray={(id) => {
          forceExpand(id);
          listRef.current?.resetAfterIndex(0);
        }}
        onExpandNested={(node) => {
          if (node.value.type === "string") {
            void parseNested(node.id, node.value.value);
          }
        }}
        onCollapseNested={collapseNested}
        isNestedExpanded={(id) => nestedExpandedById.has(id)}
        searchQuery={searchQuery}
      />
    </div>
  );

  return (
    <div className="h-full">
      <VariableSizeList
        ref={listRef}
        height={typeof window !== "undefined" ? window.innerHeight - 200 : 600}
        width="100%"
        itemCount={visible.length}
        itemSize={() => ROW_HEIGHT}
        overscanCount={20}
      >
        {renderRow}
      </VariableSizeList>
    </div>
  );
}

function filterBySearch(
  all: VisibleNode[],
  query: string,
  mode: "key" | "value" | "both",
): VisibleNode[] {
  const q = query.toLowerCase();
  // First, find the indices of nodes that match.
  const matches = new Set<number>();
  for (let i = 0; i < all.length; i++) {
    const v = all[i];
    const keyText = keyText_(v);
    const valueText = valueText_(v);
    const hits =
      (mode !== "value" && keyText.toLowerCase().includes(q)) ||
      (mode !== "key" && valueText.toLowerCase().includes(q));
    if (hits) matches.add(i);
  }
  if (matches.size === 0) return [];
  // Build the visible set: for each match, include its ancestor chain (anything with smaller depth, scanning backwards).
  const include = new Set<number>(matches);
  for (const idx of matches) {
    let depth = all[idx].depth;
    for (let j = idx - 1; j >= 0 && depth > 0; j--) {
      if (all[j].depth < depth) {
        include.add(j);
        depth = all[j].depth;
      }
    }
  }
  return all.filter((_, i) => include.has(i));
}

function keyText_(v: VisibleNode): string {
  if (v.node.key.kind === "object") return v.node.key.name;
  if (v.node.key.kind === "array") return String(v.node.key.index);
  return "";
}

function valueText_(v: VisibleNode): string {
  switch (v.node.value.type) {
    case "null":
      return "null";
    case "bool":
      return v.node.value.value ? "true" : "false";
    case "number":
      return v.node.value.raw;
    case "string":
      return v.node.value.value;
    default:
      return "";
  }
}
```

- [ ] **Step 15.3: Build to validate**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 15.4: Commit**

```bash
git add src/tools/json-viewer/TreeNode.tsx src/tools/json-viewer/Tree.tsx
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
feat(json-viewer): add virtualized tree with copy/path/nested-toggle/search

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 16: SearchBar + Toolbar + SaveButton

**Files:**
- Create: `src/tools/json-viewer/SearchBar.tsx`
- Create: `src/tools/json-viewer/Toolbar.tsx`
- Create: `src/tools/json-viewer/SaveButton.tsx`

- [ ] **Step 16.1: Implement SearchBar.tsx**

```tsx
import { useTranslation } from "react-i18next";
import { useJsonViewerStore, type SearchMode } from "./store";

const modes: SearchMode[] = ["both", "key", "value"];

export function SearchBar() {
  const { t } = useTranslation();
  const { searchQuery, searchMode, setSearch } = useJsonViewerStore();
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--border)] bg-[color:var(--bg-panel)]">
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearch(e.target.value, searchMode)}
        placeholder={t("json_viewer.search_placeholder")}
        className="flex-1 px-2 py-1 text-sm rounded border border-[color:var(--border)] bg-[color:var(--bg-base)]"
      />
      <select
        value={searchMode}
        onChange={(e) => setSearch(searchQuery, e.target.value as SearchMode)}
        className="px-2 py-1 text-sm rounded border border-[color:var(--border)] bg-[color:var(--bg-base)]"
      >
        {modes.map((m) => (
          <option key={m} value={m}>
            {t(`json_viewer.search_mode_${m}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
```

- [ ] **Step 16.2: Implement Toolbar.tsx**

```tsx
import { useTranslation } from "react-i18next";
import { useJsonViewerStore } from "./store";
import { jsonApi } from "./api";
import { useToastStore } from "../../shell/toastStore";
import { IpcError } from "../../lib/ipc";

interface ToolbarProps {
  onOpenSave(): void;
}

export function Toolbar({ onOpenSave }: ToolbarProps) {
  const { t } = useTranslation();
  const input = useJsonViewerStore((s) => s.input);
  const setInput = useJsonViewerStore((s) => s.setInput);
  const clear = useJsonViewerStore((s) => s.clear);
  const push = useToastStore((s) => s.push);

  const replaceInput = async (next: string) => {
    setInput(next);
    await useJsonViewerStore.getState().parse(next);
  };

  const onFormat = async (indent: number) => {
    try {
      const out = await jsonApi.format(input, indent);
      await replaceInput(out);
    } catch {
      push("error", t("json_viewer.format_failed"));
    }
  };

  const onUnescape = async () => {
    try {
      const out = await jsonApi.unescape(input);
      await replaceInput(out);
    } catch (e) {
      const msg = e instanceof IpcError ? e.app.message : String(e);
      push("error", msg);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--border)] bg-[color:var(--bg-panel)]">
      <button
        type="button"
        onClick={() => onFormat(2)}
        className="px-3 py-1 text-sm rounded border border-[color:var(--border)] hover:bg-[color:var(--bg-base)]"
      >
        {t("json_viewer.format")}
      </button>
      <button
        type="button"
        onClick={() => onFormat(0)}
        className="px-3 py-1 text-sm rounded border border-[color:var(--border)] hover:bg-[color:var(--bg-base)]"
      >
        {t("json_viewer.minify")}
      </button>
      <button
        type="button"
        onClick={onUnescape}
        className="px-3 py-1 text-sm rounded border border-[color:var(--border)] hover:bg-[color:var(--bg-base)]"
      >
        {t("json_viewer.unescape_in_place")}
      </button>
      <button
        type="button"
        onClick={clear}
        className="px-3 py-1 text-sm rounded border border-[color:var(--border)] hover:bg-[color:var(--bg-base)]"
      >
        {t("json_viewer.clear")}
      </button>
      <button
        type="button"
        onClick={onOpenSave}
        disabled={input.trim().length === 0}
        className="ml-auto px-3 py-1 text-sm rounded bg-[color:var(--accent)] text-white disabled:opacity-50"
      >
        {t("json_viewer.save")}
      </button>
    </div>
  );
}
```

- [ ] **Step 16.3: Implement SaveButton.tsx**

```tsx
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SaveDialog, type SaveResult } from "../../history/SaveDialog";
import { useJsonViewerStore } from "./store";
import { useHistoryStore } from "../../history/store";
import { useToastStore } from "../../shell/toastStore";
import type { SaveRequest } from "../../types/ipc";

export function SaveDialogHost({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const input = useJsonViewerStore((s) => s.input);
  const loadedHistoryId = useJsonViewerStore((s) => s.loadedHistoryId);
  const setLoadedHistoryId = useJsonViewerStore((s) => s.setLoadedHistoryId);
  const save = useHistoryStore((s) => s.save);
  const push = useToastStore((s) => s.push);

  const [defaultTitle] = useState(() =>
    input.slice(0, 50).replace(/\s+/g, " ").trim() ||
    t("json_viewer.save_default_title"),
  );

  const handle = async (result: SaveResult) => {
    const req: SaveRequest =
      result.mode === "new"
        ? {
            mode: "new",
            title: result.title,
            content: { tool: "json_viewer", input },
          }
        : {
            mode: "overwrite",
            id: result.id,
            title: result.title,
            content: { tool: "json_viewer", input },
          };
    try {
      const item = await save(req);
      setLoadedHistoryId(item.id);
      onClose();
    } catch (e) {
      push("error", e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <SaveDialog
      open={open}
      defaultTitle={defaultTitle}
      loadedId={loadedHistoryId}
      onSave={handle}
      onCancel={onClose}
    />
  );
}
```

- [ ] **Step 16.4: Build to validate**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 16.5: Commit**

```bash
git add src/tools/json-viewer/SearchBar.tsx src/tools/json-viewer/Toolbar.tsx src/tools/json-viewer/SaveButton.tsx
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
feat(json-viewer): add SearchBar, Toolbar, and SaveDialogHost

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 17: Wire JsonViewer page

**Files:**
- Modify: `src/tools/json-viewer/index.tsx`
- Modify: `src/App.tsx` (history-load handler routes JSON Viewer content into the store)

- [ ] **Step 17.1: Replace `src/tools/json-viewer/index.tsx`**

```tsx
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Editor } from "./Editor";
import { Tree } from "./Tree";
import { SearchBar } from "./SearchBar";
import { Toolbar } from "./Toolbar";
import { SaveDialogHost } from "./SaveButton";
import { useJsonViewerStore } from "./store";
import { debounce } from "../../lib/debounce";

const PARSE_DEBOUNCE_MS = 200;

export function JsonViewer() {
  const { t } = useTranslation();
  const input = useJsonViewerStore((s) => s.input);
  const setInput = useJsonViewerStore((s) => s.setInput);
  const parse = useJsonViewerStore((s) => s.parse);
  const parseError = useJsonViewerStore((s) => s.parseError);
  const unescapeLayers = useJsonViewerStore((s) => s.unescapeLayers);

  const debouncedParse = useMemo(
    () => debounce((text: string) => void parse(text), PARSE_DEBOUNCE_MS),
    [parse],
  );

  useEffect(() => {
    debouncedParse(input);
    return () => debouncedParse.cancel();
  }, [input, debouncedParse]);

  const [saveOpen, setSaveOpen] = useState(false);

  return (
    <div className="h-full flex flex-col">
      <Toolbar onOpenSave={() => setSaveOpen(true)} />
      {unescapeLayers > 0 && (
        <div className="px-3 py-1 text-xs text-[color:var(--text-muted)] bg-[color:var(--bg-base)] border-b border-[color:var(--border)]">
          {t("json_viewer.auto_unescape_pill", { n: unescapeLayers })}
        </div>
      )}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 border-r border-[color:var(--border)]">
          <Editor
            value={input}
            onChange={setInput}
            diagnostic={parseError}
          />
        </div>
        <div className="flex-1 flex flex-col">
          <SearchBar />
          <div className="flex-1 overflow-hidden">
            <Tree />
          </div>
        </div>
      </div>
      <SaveDialogHost open={saveOpen} onClose={() => setSaveOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 17.2: Modify `src/App.tsx`'s history-load handler**

Find the `handleLoad` function in `src/App.tsx`. Replace it with this implementation that routes JSON-viewer content into the store:

```tsx
  function handleLoad(item: HistoryItem) {
    if (item.content.tool === "json_viewer") {
      const { useJsonViewerStore } = require("./tools/json-viewer/store") as typeof import("./tools/json-viewer/store");
      useJsonViewerStore.getState().setInput(item.content.input);
      useJsonViewerStore.getState().setLoadedHistoryId(item.id);
      void useJsonViewerStore.getState().parse(item.content.input);
      push("success", t("common.loaded_history_toast", { title: item.title }));
      return;
    }
    push("info", t("common.loaded_history_toast", { title: item.title }));
  }
```

Important: Vite/ESM does not support synchronous `require`. Replace the dynamic `require` with a top-level import. Add to the imports at the top of `App.tsx`:

```tsx
import { useJsonViewerStore } from "./tools/json-viewer/store";
```

…and use it directly inside `handleLoad`:

```tsx
  function handleLoad(item: HistoryItem) {
    if (item.content.tool === "json_viewer") {
      useJsonViewerStore.getState().setInput(item.content.input);
      useJsonViewerStore.getState().setLoadedHistoryId(item.id);
      void useJsonViewerStore.getState().parse(item.content.input);
      push("success", t("common.loaded_history_toast", { title: item.title }));
      return;
    }
    push("info", t("common.loaded_history_toast", { title: item.title }));
  }
```

- [ ] **Step 17.3: Build to validate**

```bash
npm run build
```

Expected: succeeds.

- [ ] **Step 17.4: Run all tests**

```bash
npm test -- --run
```

Expected: all prior + new tests pass (22 prior + 8 path + 11 nodePreview + 5 flatten + 7 store = 53). If a test count differs slightly because of test scaffolding, that's fine — just confirm zero failures.

- [ ] **Step 17.5: Commit**

```bash
git add src/tools/json-viewer/index.tsx src/App.tsx
git -c user.email=xl1833877528@gmail.com -c user.name=tristoney commit -m "$(cat <<'EOF'
feat(json-viewer): wire page (editor + tree + toolbar + search + save)

History items with tool=json_viewer now load directly into the viewer
store and trigger an immediate parse.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 18: Smoke verification

**Files:** none modified — manual verification.

- [ ] **Step 18.1: Run dev mode**

```bash
npm run tauri dev
```

- [ ] **Step 18.2: Functional smoke checklist**

In the running app, confirm:

1. JSON Viewer tab is selected by default. Left pane: empty CodeMirror with line numbers. Right pane: "Enter valid JSON to render." (in zh by default, "输入有效 JSON 后将自动渲染。").
2. Paste `test.json` (the escaped fixture in repo root) into the editor. Within ~250ms, the right tree fills with the structure under `content_launch`/`resource_id_to_component_list`. Toolbar pill shows "已自动反转义 1 层" / "Auto-unescaped 1 layer(s)".
3. Click a chevron — the subtree collapses, summary appears (`{ "play_launch_info": ..., +N } K keys`).
4. Find an array with > 100 items. It starts collapsed with an "展开全部 N 项" / "Expand all N items" button. Click it: the array expands.
5. Find a string node with the `⤷ JSON {…}` badge. Click it: the badge text changes and the inner subtree appears with extra indentation.
6. Type a key fragment in the right-pane search box (e.g. `PlayId`). The tree filters to matches + their ancestors.
7. Hover a node — the per-node `Copy value` / `Copy path` controls appear. Click `Copy path`. Paste somewhere — value is the JS dot-path of that node.
8. Type a non-JSON character (e.g. `}{}` at the very start). The editor shows a red squiggle on the offending position.
9. Click `格式化` / `Format` on valid JSON — the editor reformats with indent=2.
10. Click `就地反转义` / `Unescape in place` on the original `test.json` content — the editor content becomes unescaped JSON.
11. Click `保存…` / `Save…` → modal appears with title prefilled. Click `New`. Open the History drawer — the entry is listed. Click it back — the editor restores the saved input. Toolbar pill, tree, etc. all repopulate.
12. Toggle locale (中 ↔ EN). All visible strings in the JSON Viewer tab swap languages immediately.
13. Toggle theme (Light → Dark → System). Editor and tree colors update.

- [ ] **Step 18.3: Stop dev server**

Press Ctrl+C in the terminal. No commit needed.

---

## Self-review (already applied; nothing further to do)

**Spec coverage** — referenced sections of `docs/superpowers/specs/2026-04-30-dev-tool-design.md`:
- §6.1 (JSON Viewer): editor, debounced parse, virtualized tree, default-expand + array auto-collapse, collapsed preview, copy value/path, nested JSON badge with click-toggle, search by key/value/both with ancestor expansion, format/minify/unescape-in-place, save dialog. **Covered by Tasks 9–18.**
- §4.1 JsonNode/JsonTree types — **Task 5.**
- §4.2 auto-unescape (≤3 layers) — **Task 3.**
- §4.3 nested-string detection — **Task 4.**
- §5 commands `json_parse`/`json_parse_nested`/`json_format`/`json_unescape`/`json_escape` — **Task 7.**
- §9.1 error model — Parse diagnostic propagation through ipc layer to CodeMirror linter — **Tasks 13, 14.**

**Type consistency check:** `JsonTree` / `JsonNode` / `NodeValue` shapes match between Rust (`json_tree.rs`) and TypeScript (`types/ipc.ts` updated in Task 8). The `NodeValue::Bool { value }` case is intentionally a struct variant (not a tuple variant) so its serialized shape matches the TS type. Task 8.2 instructs to verify and fix the Rust file if needed before continuing — once that's done, the rest of the plan stays consistent.

**Placeholder scan:** no "TBD" / "TODO" markers; every code step contains complete code.

---

## Done criteria (JSON Viewer)

- All 18 tasks committed.
- All Rust tests pass (49 total expected after Task 7).
- All frontend tests pass (53 total expected after Task 17).
- `npm run build` succeeds.
- `npm run tauri dev` opens the app, JSON Viewer is fully functional per the smoke checklist (Task 18).
- `test.json` parses, auto-unescape pill shows "1 layer", tree renders, search works, copy works, save→reload roundtrips through SQLite.

Next: **Plan 3 — JSON Diff** (semantic diff command + UI).
