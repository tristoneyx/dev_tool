# DevTool — JSON & Codec Toolkit Design

**Date:** 2026-04-30
**Status:** Draft for user review
**Owner:** tristoney

## 1. Overview

A macOS desktop application providing a curated set of developer-oriented tools for working with JSON and adjacent encodings. Single window, top-level tabs, Claude-official visual style.

### 1.1 Goals

- One-stop tool for the common "I just pasted something from logs, help me understand it" workflow.
- First-class handling of escaped / nested JSON (the dominant pain point in the user's day-to-day).
- Per-tool history with explicit save/overwrite semantics, persisted across launches.
- Smooth interaction on JSON inputs up to ~10 MB.

### 1.2 Non-goals

- Cross-platform support beyond macOS in v1 (Tauri allows it later, but UI is tuned for macOS).
- Multi-document editing within a single tool tab (use history switching instead).
- Cloud sync / multi-device history.
- Authoring / validation against JSON Schema.
- Auto-fix of malformed JSON (single quotes, trailing commas) in v1.

### 1.3 Tools (5 top-level tabs)

| Tab | Function |
|---|---|
| **JSON Viewer** | Visualize JSON as collapsible tree with search, node copy, nested-JSON drill-in |
| **JSON Diff** | Semantic diff between two JSONs (ignores key order) |
| **Escape** | JSON string escape ↔ unescape |
| **Base64** | Encode ↔ decode (UTF-8 + URL-safe variant) |
| **URL Parser** | Parse URL into components + editable query table + reverse-build |

## 2. Tech Stack

### 2.1 Frontend
- React 18 + TypeScript + Vite
- **Zustand** for state (per-tool slice)
- **CodeMirror 6** for all text editors (lightweight, custom lint integration with Rust parser)
- **Tailwind CSS** + CSS variables for Claude-style theming + dark mode
- **react-window** for virtualized JSON tree rendering (custom flat-list strategy described in §6.1)

### 2.2 Backend (Rust 1.75+)
- `serde_json` — primary JSON parser, preserves number precision via `arbitrary_precision` feature
- `rusqlite` (bundled) — history persistence (no async runtime needed)
- `base64` — encode/decode, URL-safe variant
- `urlencoding` + `url` — URL parsing/building
- `thiserror` — typed error hierarchy

### 2.3 Build
- Tauri 2.x; targets `aarch64-apple-darwin` and `x86_64-apple-darwin`
- DMG installer; signed + notarized in CI (deferred — not in v1 scope, dev builds only)

## 3. Project Structure

```
dev_tool/
├── src-tauri/
│   ├── src/
│   │   ├── main.rs                  # App bootstrap, builder, command registry
│   │   ├── commands/                # Tauri command surface (§5)
│   │   │   ├── mod.rs
│   │   │   ├── json.rs              # parse / parse_nested
│   │   │   ├── diff.rs              # json_diff
│   │   │   ├── codec.rs             # base64 / url / escape
│   │   │   └── history.rs           # CRUD
│   │   ├── domain/
│   │   │   ├── mod.rs
│   │   │   ├── json_tree.rs         # JsonNode, NodeValue, build/flatten
│   │   │   ├── unescape.rs          # multi-layer auto-unescape
│   │   │   ├── nested_detect.rs     # detect string-as-JSON
│   │   │   ├── diff.rs              # semantic diff algorithm
│   │   │   ├── escape.rs            # JSON escape rules
│   │   │   └── url_parts.rs         # split/build URL
│   │   ├── persistence/
│   │   │   ├── mod.rs
│   │   │   ├── db.rs                # connection, migrations
│   │   │   └── history.rs           # repo for history rows
│   │   ├── error.rs                 # AppError enum
│   │   └── lib.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── src/
│   ├── main.tsx
│   ├── App.tsx                      # top-level shell, tab routing
│   ├── shell/
│   │   ├── TitleBar.tsx
│   │   ├── ToolTabs.tsx
│   │   ├── ThemeToggle.tsx
│   │   └── ToastHost.tsx
│   ├── tools/
│   │   ├── json-viewer/
│   │   │   ├── index.tsx
│   │   │   ├── store.ts
│   │   │   ├── Editor.tsx           # left pane (CodeMirror)
│   │   │   ├── Tree.tsx             # right pane (virtualized)
│   │   │   ├── TreeNode.tsx
│   │   │   ├── SearchBar.tsx
│   │   │   ├── NestedToggle.tsx
│   │   │   └── flatten.ts           # tree -> visible flat list
│   │   ├── json-diff/
│   │   │   ├── index.tsx
│   │   │   ├── store.ts
│   │   │   ├── DiffPane.tsx
│   │   │   └── DiffNode.tsx
│   │   ├── escape/
│   │   │   ├── index.tsx
│   │   │   └── store.ts
│   │   ├── base64/
│   │   │   ├── index.tsx
│   │   │   └── store.ts
│   │   └── url-parser/
│   │       ├── index.tsx
│   │       ├── store.ts
│   │       └── QueryTable.tsx
│   ├── history/
│   │   ├── HistoryDrawer.tsx        # right-side drawer, reused by all tools
│   │   ├── SaveDialog.tsx           # New / Overwrite
│   │   ├── store.ts
│   │   └── api.ts                   # invoke wrappers
│   ├── lib/
│   │   ├── ipc.ts                   # invoke + error normalization
│   │   ├── debounce.ts
│   │   ├── clipboard.ts
│   │   └── path.ts                  # build JS dot-path with bracket fallback
│   ├── styles/
│   │   ├── tokens.css               # Claude-style color tokens
│   │   ├── light.css
│   │   └── dark.css
│   └── types/
│       └── ipc.d.ts                 # shared types mirroring Rust
├── docs/
│   └── superpowers/specs/2026-04-30-dev-tool-design.md
├── test.json
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── vite.config.ts
```

## 4. Domain Model (Rust)

### 4.1 JSON tree

```rust
// src-tauri/src/domain/json_tree.rs

pub type NodeId = u32;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct JsonTree {
    pub root: JsonNode,
    pub stats: TreeStats,
    pub unescape_layers: u8,         // how many layers of escaping the parser peeled off
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
    pub path: String,                // canonical JS dot-path
    pub value: NodeValue,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum NodeKey {
    Root,
    Object { name: String },
    Array  { index: u32 },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum NodeValue {
    Null,
    Bool(bool),
    Number {
        // raw textual form, preserves precision; UI displays as-is
        raw: String,
    },
    String {
        value: String,
        nested_hint: Option<NestedHint>,
    },
    Object {
        children: Vec<JsonNode>,
        key_count: u32,
        preview: String,             // see §6.1.5
    },
    Array {
        children: Vec<JsonNode>,
        item_count: u32,
        preview: String,
    },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct NestedHint {
    /// What the inner value looks like once parsed:
    /// "{ 8 keys }" or "[ 12 items ]". Used in the ⤷ JSON badge tooltip.
    pub kind_summary: String,
}
```

**Invariants**
- `id` is monotonically assigned during a single parse (sequence resets each parse).
- `path` is the canonical JS dot-path: `a.b[0].c`. Keys with non-identifier characters use bracket notation: `a["weird-key"][0]`. Keys containing `"` are escaped.
- `Number.raw` preserves the original lexeme (so `1234567890123456789` doesn't lose precision through `f64`).
- `nested_hint` is set **only** when `value` parses to a JSON object or array (string-as-number / string-as-bool excluded).

### 4.2 Auto-unescape

```rust
// src-tauri/src/domain/unescape.rs

const MAX_UNESCAPE_LAYERS: u8 = 3;

pub fn parse_with_auto_unescape(input: &str) -> Result<(serde_json::Value, u8), ParseError>;
```

Algorithm:
1. Try `serde_json::from_str(input)`. On success, return `(value, 0)`.
2. Else, treat the input as a JSON string literal: try `serde_json::from_str(&format!("\"{escaped}\""))` where `escaped` is the input wrapped (with internal `"` escaping handled if not already).
3. If step 2 yields a string, recurse on that string with `layers + 1` until success or `layers == MAX_UNESCAPE_LAYERS`.
4. If all attempts fail, return the **original** parser error (so the user sees the most helpful message).

Performance: typical case (well-formed JSON) is one call; pathological cases bounded by 3 attempts.

### 4.3 Nested JSON detection

For each `String` node during tree construction, attempt `serde_json::from_str(&value)`. If it succeeds **and** the result is `Value::Object` or `Value::Array`, populate `nested_hint` with a summary string. The full nested subtree is **not** built eagerly — it's built on demand when the user clicks the ⤷ JSON badge (see §5 `json_parse_nested`).

### 4.4 Semantic diff

```rust
// src-tauri/src/domain/diff.rs

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiffTree {
    pub root: DiffNode,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum DiffStatus {
    Equal,
    Added,                                    // present in right, absent in left
    Removed,                                  // present in left, absent in right
    Modified { left: Value, right: Value },   // primitive value changed
    TypeChanged { left_type: String, right_type: String },
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct DiffNode {
    pub key: NodeKey,
    pub path: String,
    pub status: DiffStatus,
    pub children: Vec<DiffNode>,
    pub has_difference: bool,                 // true if self or any descendant differs
}
```

Algorithm:
- Objects compared by key set: `union(left.keys, right.keys)`, recurse on each.
- Arrays compared **positionally** (`left[i]` vs `right[i]`); length mismatch → trailing items marked Added/Removed. (Heuristic LCS over arrays of objects-by-id is out of scope for v1.)
- Primitives compared by typed equality. Type difference produces `TypeChanged`.
- `has_difference` computed bottom-up; UI uses it to collapse identical subtrees by default.

## 5. Tauri Command Surface

All commands return `Result<T, AppError>` (§9.1).

```rust
// src-tauri/src/commands/json.rs
#[tauri::command]
async fn json_parse(input: String) -> Result<JsonTree, AppError>;

#[tauri::command]
async fn json_parse_nested(input: String) -> Result<JsonTree, AppError>;
// Used when expanding a "nested JSON string" node — input is the string value,
// returns a fresh subtree.

#[tauri::command]
fn json_format(input: String, indent: u8) -> Result<String, AppError>;
// Pretty-print or minify (indent=0 = minify).

// src-tauri/src/commands/diff.rs
#[tauri::command]
async fn json_diff(left: String, right: String) -> Result<DiffTree, AppError>;

// src-tauri/src/commands/codec.rs
#[tauri::command]
fn json_escape(input: String) -> Result<String, AppError>;

#[tauri::command]
fn json_unescape(input: String) -> Result<String, AppError>;

#[tauri::command]
fn base64_encode(input: String, url_safe: bool) -> Result<String, AppError>;

#[tauri::command]
fn base64_decode(input: String, url_safe: bool) -> Result<String, AppError>;

#[tauri::command]
fn url_parse(input: String) -> Result<UrlParts, AppError>;

#[tauri::command]
fn url_build(parts: UrlParts) -> Result<String, AppError>;

// src-tauri/src/commands/history.rs
#[tauri::command]
async fn history_list(tool: ToolKind, search: Option<String>) -> Result<Vec<HistoryItem>, AppError>;

#[tauri::command]
async fn history_get(id: i64) -> Result<HistoryItem, AppError>;

#[tauri::command]
async fn history_save(req: SaveRequest) -> Result<HistoryItem, AppError>;
// SaveRequest { tool, mode: "new"|"overwrite", overwrite_id?, title, content }

#[tauri::command]
async fn history_delete(id: i64) -> Result<(), AppError>;
```

**Async vs sync**: parse / diff / history use `async` and run on Tauri's blocking pool via `tauri::async_runtime::spawn_blocking` internally. Pure-CPU light commands (escape, base64, url_parse) are sync — they finish faster than IPC overhead anyway.

### 5.1 Shared types

```rust
pub struct UrlParts {
    pub scheme: String,
    pub host: String,
    pub port: Option<u16>,
    pub path: String,
    pub query: Vec<QueryParam>,        // ordered, decoded
    pub fragment: Option<String>,
}

pub struct QueryParam {
    pub key: String,
    pub value: String,                 // URL-decoded (UI shows decoded)
}

pub enum ToolKind { JsonViewer, JsonDiff, Escape, Base64, UrlParser }

pub struct HistoryItem {
    pub id: i64,
    pub tool: ToolKind,
    pub title: String,
    pub content: HistoryContent,       // shape varies by tool (§7)
    pub created_at: i64,               // unix millis
    pub updated_at: i64,
}
```

## 6. Per-Tool Specs

### 6.1 JSON Viewer

**Layout**: split horizontally — left pane CodeMirror editor, right pane virtualized tree. Top toolbar: [Format] [Minify] [Unescape in place] [Clear] [Save…]. Right edge: history drawer toggle.

**Pipeline** (debounced 200 ms after last keystroke):
1. Frontend: `invoke('json_parse', { input: editorText })`.
2. Backend: auto-unescape (§4.2) → build tree (§4.1) → return `JsonTree`.
3. Frontend: replace tree state, lint diagnostics cleared, header pill `Auto-unescaped 2 layers` shown if `unescape_layers > 0`.
4. On parse error: tree pane shows empty state; CodeMirror lint plugin draws red squiggle at `(line, col)` with hover tooltip = error message.

**Tree rendering** (the central technical piece):
- Internal representation: a flat array `visible: VisibleNode[]` where `VisibleNode = { node: JsonNode, depth: number, isCollapsed: boolean, isNestedExpanded: boolean }`.
- Computed by `flatten(root, collapseSet, nestedExpansionSet)` — single pass, only emits nodes that should be on screen.
- Rendered via `react-window` `VariableSizeList` with `itemSize=28` (fixed; multi-line previews truncate to one line).
- Recompute `visible` when collapse/expand happens (one set add/delete, then re-flatten — O(N) but N is bounded by what's actually shown anyway).

**Default state**:
- All nodes expanded except: array nodes with `item_count > 100` start collapsed.
- Collapsed object preview format: `{ "first_key": <value-summary>, +N } 8 keys`
- Collapsed array preview format: `[ <item0-summary>, <item1-summary>, +N ] 12 items`
- `<value-summary>` is the type abbreviation: `{...}`, `[...]`, the literal value for primitives (truncated to 30 chars).

**Per-node interactions**:
- Click chevron: toggle collapse for this node.
- Hover: show ⌃ (copy menu) icon in node row.
- Right-click / click ⌃: context menu `[Copy value] [Copy path]`.
  - Copy value: object/array → indented JSON of the subtree; primitives → raw value (string without quotes, number as raw, bool/null lowercase).
  - Copy path: JS dot-path with bracket fallback (§4.1 invariants).
- For string nodes with `nested_hint`: a small `⤷ JSON` badge to the right of the value. Click it → call `json_parse_nested` → render the returned subtree inline, indented under this node, with a dashed left border to distinguish it. Click badge again → collapse back to string display. Nested expansion state stored in `nestedExpansionSet: Set<NodeId>` on the store.

**Search bar** (above tree):
- Mode selector: `key | value | both` (default `both`).
- As-you-type filter (debounced 100 ms).
- A node "matches" if (mode=key & node.key matches), (mode=value & node primitive value matches as string), or (mode=both & either).
- Visible set = matching nodes ∪ all their ancestor chains (so you see context).
- Matched substring highlighted with `<mark>` styling.
- Empty query → revert to normal flatten (respect collapse set).

**"Unescape in place" button**: replaces editor content with `await invoke('json_unescape', { input: editorText })` — applied **once** (not iteratively). User can click multiple times if needed.

**Format / Minify**: replace editor content with `invoke('json_format', { input, indent: 2 | 0 })`. Format only works if input parses; otherwise toast error.

### 6.2 JSON Diff

**Layout**: split horizontally — left input pane, right input pane, single bottom result pane (or three rows: left | right | result). Toolbar: [Compare] [Swap] [Clear].

**Pipeline**:
- User pastes both sides, clicks **Compare** (no debounce — explicit trigger to avoid surprise on partial input).
- `invoke('json_diff', { left, right })` → `DiffTree`.
- Result pane renders a unified tree: each node shows its key/value with status-driven styling.

**Status colors** (Claude-style palette):
- Equal: muted gray
- Added: green left border + light green bg
- Removed: red left border + light red bg, strikethrough on key
- Modified: amber bg, render `oldVal → newVal` inline
- TypeChanged: blue bg, badge `string → object`

**Default behavior**: subtrees with `has_difference: false` collapsed by default, click to expand. Toggle `[Show only differences]` (default on) hides `Equal` nodes entirely.

**Path search**: same search bar pattern as Viewer, scoped to diff tree.

### 6.3 Escape

Two textareas (top: input, bottom: output), direction toggle [Escape ⇄ Unescape]. As-you-type, no button. Failure (e.g., unescape on text that isn't valid escape sequence) → output pane shows error message inline, doesn't clear input.

Output area has [Copy] button.

### 6.4 Base64

Same two-textarea layout. Direction toggle, plus a sub-toggle `[Standard | URL-safe]`. UTF-8 assumed for text; binary input not supported in v1 (would need file picker). Errors handled like §6.3.

### 6.5 URL Parser

**Layout**: top: full URL input. Below: collapsible card showing `Scheme | Host | Port | Path | Fragment` (read-only fields, populated from parse). Below that: Query Params table (key | value | actions).

**Behavior**:
- Edit URL → debounced `url_parse` → populate fields and table.
- Edit any table cell, add/remove row, edit non-query field → debounced `url_build` → update URL field at top.
- Two-way binding via a single source of truth: `UrlParts` in store. Either side's edit dispatches a "rebuild" cycle.
- Empty / invalid URL: show inline error; table empty.

## 7. History Subsystem

### 7.1 SQLite schema

Database location: `~/Library/Application Support/dev-tool/history.sqlite` (resolved via `tauri::api::path::app_data_dir`).

```sql
CREATE TABLE history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tool        TEXT NOT NULL,                 -- json_viewer | json_diff | escape | base64 | url_parser
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,                 -- JSON-serialized HistoryContent
    created_at  INTEGER NOT NULL,              -- unix millis
    updated_at  INTEGER NOT NULL
);
CREATE INDEX idx_history_tool_updated ON history(tool, updated_at DESC);
CREATE INDEX idx_history_title ON history(title);
```

### 7.2 `HistoryContent` (per-tool payload)

Stored as JSON in `content`. Tagged union, deserialized on load:

```rust
#[serde(tag = "tool", rename_all = "snake_case")]
pub enum HistoryContent {
    JsonViewer { input: String },
    JsonDiff   { left: String, right: String },
    Escape     { input: String, direction: EscapeDirection },
    Base64     { input: String, direction: CodecDirection, url_safe: bool },
    UrlParser  { url: String },
}
```

### 7.3 Save flow

- Each tool has a [Save…] button. Disabled when current input is empty.
- Click → `SaveDialog` modal:
  - Title field (default = first 50 chars of input, single line)
  - Two buttons: **New** | **Overwrite current** (latter disabled if no history item is currently loaded)
- On submit → `history_save` → on success, drawer list updates; the new/overwritten item becomes "currently loaded".

### 7.4 History drawer

- Right-side drawer, toggle button in toolbar.
- Search box at top (LIKE on title; client-side filter on small lists is fine, server-side LIKE for large).
- List items: title (1 line, ellipsis), timestamp ("2h ago"), size badge.
- Click item: confirm-discard if current input is dirty (has unsaved changes vs "currently loaded" item), then load content into the tool.
- Hover item: trash icon for delete (with confirm).

### 7.5 "Currently loaded" tracking

Per-tool store holds `loadedHistoryId: number | null`. Cleared on `Clear` button or manual edit *that diverges from loaded snapshot* — actually, simpler: `loadedHistoryId` stays set; "Overwrite current" uses it as target. When user clicks "New" instead, `loadedHistoryId` is updated to the new id.

## 8. UI Shell & Theming

### 8.1 Window
- Single window, default size 1280×800, min 960×600. Position/size persisted via `tauri-plugin-store`.
- Native macOS title bar (no custom decorations in v1).

### 8.2 Layout
- Title bar (native).
- Below: toolbar row with [tool tabs (centered)] [theme toggle] [history drawer toggle (right)].
- Below: tool content area (full remaining space).
- Drawer slides in from right (320px), pushes content.

### 8.3 Theming (Claude-official aesthetic)

CSS variables in `tokens.css`. Light mode:
- `--bg-base`: warm off-white (`#FAF9F7`)
- `--bg-panel`: `#FFFFFF`
- `--text-primary`: near-black (`#1F1E1B`)
- `--accent`: Claude orange (`#D97757`)
- `--border`: warm gray (`#E5E2DC`)
- Diff: green `#5C8A5A`, red `#C75450`, amber `#D4A347`, blue `#4A7B9D`

Dark mode:
- `--bg-base`: deep slate (`#1A1817`)
- `--bg-panel`: `#252321`
- `--text-primary`: `#F0EEE9`
- `--accent`: `#E08866` (slightly brightened orange)
- `--border`: `#3A3633`

Theme toggle: cycles `light → dark → system`. Persisted in `tauri-plugin-store`.

The detailed component-level visual design is delegated to the `frontend-design` plugin during implementation; this spec defines the structural layout and the token palette only.

## 9. Cross-Cutting Concerns

### 9.1 Error model

```rust
// src-tauri/src/error.rs

#[derive(thiserror::Error, Debug, Serialize)]
#[serde(tag = "code", rename_all = "snake_case")]
pub enum AppError {
    #[error("JSON parse error: {message} at line {line}, col {col}")]
    Parse { line: u32, col: u32, message: String },

    #[error("Codec error: {0}")]
    Codec(String),

    #[error("URL parse error: {0}")]
    UrlParse(String),

    #[error("Database error: {0}")]
    Db(String),

    #[error("IO error: {0}")]
    Io(String),

    #[error("Internal: {0}")]
    Internal(String),
}
```

Frontend `ipc.ts` exposes:
```ts
type AppError =
  | { code: 'parse'; line: number; col: number; message: string }
  | { code: 'codec' | 'url_parse' | 'db' | 'io' | 'internal'; message: string };

async function ipc<T>(cmd: string, args?: unknown): Promise<T> // throws AppError
```

UI handling:
- `parse` errors in JSON Viewer → CodeMirror lint diagnostic only (no toast).
- All other errors → toast top-right, auto-dismiss 4 s, dismissible.

### 9.2 Performance constraints

| Scenario | Target |
|---|---|
| `test.json` (116 KB escaped → ~100 KB unescaped) parse | < 50 ms |
| 1 MB JSON parse | < 200 ms |
| 10 MB JSON parse | < 2 s, UI remains responsive |
| Tree first paint after parse | < 100 ms |
| Collapse/expand a node (10 K node tree) | < 50 ms (re-flatten) |
| Search input → results visible | < 150 ms |

Realized via:
- Backend parse on `spawn_blocking`.
- Debounced editor input (200 ms).
- Virtualized tree (only visible rows rendered).
- Search on backend-built tree (in-memory traversal in Rust if it becomes a bottleneck — v1 does it client-side).

### 9.3 IPC contract discipline

- Shared types defined once in Rust, mirrored in `src/types/ipc.d.ts` by hand (small enough).
- All commands must return `Result<T, AppError>` — never panic-on-bad-input; use `?` with `AppError::from`.

## 10. Testing Strategy

### 10.1 Rust (`cargo test`)
- **Unit**: `json_tree::flatten`, `unescape::parse_with_auto_unescape` (incl. layered cases), `nested_detect`, `diff` (added/removed/modified/type-changed/positional-array), `escape` round-trips, `url_parts` round-trips.
- **Fixture**: `test.json` checked into `src-tauri/tests/fixtures/` — used in integration tests asserting (a) parse succeeds, (b) `unescape_layers == 1`, (c) tree depth matches expectation.
- **Integration**: SQLite history CRUD against an in-memory DB; verify `history_save` overwrite semantics preserve `created_at` but bump `updated_at`.

### 10.2 Frontend (`vitest`)
- `flatten.ts` correctness against synthetic trees.
- `path.ts` JS-dot-path generation including special-key cases (`weird-key`, `key.with.dots`, `123` numeric-looking key).
- Search filter logic.
- `ipc.ts` error normalization.
- Component snapshot tests for `TreeNode` rendering states (collapsed, expanded, nested-expanded, search-matched).

### 10.3 Manual smoke checklist (no Playwright in v1)
- Paste `test.json` → tree renders with `Auto-unescaped 1 layer` pill, all top-level keys visible.
- Click `⤷ JSON` on a string-as-JSON node → subtree appears with dashed border.
- Save current input as new history item → reopen app → drawer shows it → load → editor restored.
- Compare two JSONs differing in array order vs key order — verify only true value differences flagged.
- Toggle dark mode → all panels and diff colors remain readable.

## 11. Out of Scope (v1) / Future Work

- Auto-fix malformed JSON (single quotes, trailing commas) — could become an "Try fix" button in the Escape tab later.
- JSON Schema validation panel.
- Search/replace in editor (CodeMirror provides this for free; just need a key binding).
- Export history to file.
- LCS-based smart array diff (id-aware).
- Multi-document tabs within a tool.
- File-based input (drag a `.json` onto the window) — easy to add post-v1 via Tauri's file-drop event.
- Code signing / notarization for distribution.

## 12. Open Risks

- **CodeMirror 6 lint integration**: must wire `linter()` to a function that calls `ipc('json_parse', …)` and returns diagnostics. The async pattern is supported but needs careful debounce to avoid pile-ups.
- **Number precision**: `serde_json` with `arbitrary_precision` returns `Number` whose `Display` preserves the lexeme — verify in tests that `1234567890123456789` round-trips through tree → format → editor.
- **Nested JSON detection cost**: every string node attempts a parse. For a JSON with thousands of long string values this could add up. Mitigation: only attempt parse if string starts with `{` or `[` (after trim). Add this fast-path filter in `nested_detect`.
- **History DB migrations**: future schema changes need a versioning strategy. v1: single hardcoded `CREATE TABLE IF NOT EXISTS` is enough; introduce migration table when v2 schema arrives.
