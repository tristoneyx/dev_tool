# Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Tauri + React project skeleton with working theming, top-level tool tabs, history subsystem (SQLite + drawer + Save dialog + toast), and the IPC + error contract. End state: a runnable macOS app with five empty tab placeholders and a fully functional history drawer wired to SQLite.

**Architecture:** Tauri 2.x shell with Rust backend hosting `rusqlite`-backed history and a typed IPC error model. React frontend uses Zustand stores per concern, CSS-variable-driven Claude-style theming with light/dark/system modes, and a right-side drawer that all five tools will reuse.

**Tech Stack:** Tauri 2 · Rust 1.75+ · `serde_json` · `rusqlite` · `thiserror` · React 18 + TypeScript · Vite · Zustand · Tailwind CSS · `tauri-plugin-store`.

---

## File Structure

### Created in this plan

```
src-tauri/
├── Cargo.toml
├── tauri.conf.json
├── build.rs
└── src/
    ├── main.rs                       # bootstrap, command registry
    ├── lib.rs                        # module declarations
    ├── error.rs                      # AppError enum
    ├── persistence/
    │   ├── mod.rs
    │   ├── db.rs                     # connection, migration
    │   └── history.rs                # CRUD repo
    ├── domain/
    │   ├── mod.rs
    │   └── history.rs                # HistoryItem, HistoryContent, ToolKind
    └── commands/
        ├── mod.rs
        └── history.rs                # 4 history_* commands
src/
├── main.tsx
├── App.tsx                            # tab routing
├── shell/
│   ├── TitleBar.tsx
│   ├── ToolTabs.tsx
│   ├── ThemeToggle.tsx
│   └── ToastHost.tsx
├── history/
│   ├── HistoryDrawer.tsx
│   ├── SaveDialog.tsx
│   ├── store.ts
│   └── api.ts
├── lib/
│   ├── ipc.ts
│   ├── debounce.ts
│   └── format.ts                      # "2h ago", byte-size
├── styles/
│   ├── tokens.css
│   ├── light.css
│   └── dark.css
└── types/
    └── ipc.ts                         # mirror of Rust types
package.json
tsconfig.json
vite.config.ts
tailwind.config.js
postcss.config.js
index.html
```

Tools subdirectories (`src/tools/<tool>/`) get **empty placeholder** entries in this plan; their internals come in later plans.

### File responsibilities (key boundaries)

- `src-tauri/src/error.rs` — single source of typed errors crossing the IPC boundary. No file outside this module defines an error variant.
- `src-tauri/src/persistence/db.rs` — owns the `Connection` and migration. No SQL outside `persistence/` and the test modules.
- `src-tauri/src/persistence/history.rs` — pure CRUD; takes `&Connection`, returns domain types. No Tauri types here.
- `src-tauri/src/commands/history.rs` — thin Tauri adapter; resolves `Connection` from `State<DbHandle>`, calls repo, maps errors.
- `src/lib/ipc.ts` — every `invoke` call goes through `ipc()`. Components never call `invoke` directly.
- `src/styles/tokens.css` — only place CSS variables are declared; light/dark just reassign them.

---

## Conventions

- **Working directory** is `/Users/tristoney/dev_tool`. All paths in this plan are relative to it.
- **Commit message format**: Conventional Commits — `feat:`, `fix:`, `chore:`, `test:`, `docs:`, `refactor:`. Always include the `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer.
- **Run before each commit**: `cargo test --manifest-path src-tauri/Cargo.toml` (Rust) or `npm test` (frontend) — whichever applies.

---

## Task 1: Scaffold Tauri project + frontend tooling

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `tailwind.config.js`, `postcss.config.js`
- Create: `src-tauri/Cargo.toml`, `src-tauri/tauri.conf.json`, `src-tauri/build.rs`, `src-tauri/src/main.rs`, `src-tauri/src/lib.rs`
- Create: `src/main.tsx`, `src/App.tsx`, `src/styles/tokens.css`

- [ ] **Step 1.1: Create `package.json`**

```json
{
  "name": "dev-tool",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "tauri": "tauri",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@tauri-apps/api": "^2.0.0",
    "@tauri-apps/plugin-store": "^2.0.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2.0.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.5.0",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "autoprefixer": "^10.4.20",
    "jsdom": "^25.0.0",
    "postcss": "^8.4.45",
    "tailwindcss": "^3.4.10",
    "typescript": "^5.6.2",
    "vite": "^5.4.3",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 1.2: Create `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: "esnext",
    minify: "esbuild",
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

- [ ] **Step 1.3: Create `tsconfig.json` and `tsconfig.node.json`**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 1.4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DevTool</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 1.5: Create Tailwind + PostCSS config**

`tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        base: "var(--bg-base)",
        panel: "var(--bg-panel)",
        primary: "var(--text-primary)",
        muted: "var(--text-muted)",
        accent: "var(--accent)",
        border: "var(--border)",
      },
      fontFamily: {
        sans: ["-apple-system", "BlinkMacSystemFont", "Inter", "sans-serif"],
        mono: ["SF Mono", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
```

`postcss.config.js`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 1.6: Create `src-tauri/Cargo.toml`**

```toml
[package]
name = "dev-tool"
version = "0.1.0"
edition = "2021"

[lib]
name = "dev_tool_lib"
crate-type = ["staticlib", "cdylib", "rlib"]

[build-dependencies]
tauri-build = { version = "2.0", features = [] }

[dependencies]
tauri = { version = "2.0", features = [] }
tauri-plugin-store = "2.0"
serde = { version = "1", features = ["derive"] }
serde_json = { version = "1", features = ["arbitrary_precision", "raw_value"] }
rusqlite = { version = "0.32", features = ["bundled"] }
thiserror = "1"
chrono = "0.4"

[dev-dependencies]
tempfile = "3"
```

- [ ] **Step 1.7: Create `src-tauri/build.rs`**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 1.8: Create `src-tauri/tauri.conf.json`**

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "DevTool",
  "version": "0.1.0",
  "identifier": "com.tristoney.devtool",
  "build": {
    "frontendDist": "../dist",
    "devUrl": "http://localhost:1420",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [
      {
        "title": "DevTool",
        "width": 1280,
        "height": 800,
        "minWidth": 960,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": ["dmg", "app"],
    "macOS": {
      "minimumSystemVersion": "11.0"
    }
  }
}
```

- [ ] **Step 1.9: Create `src-tauri/src/lib.rs` and `src-tauri/src/main.rs`**

`src-tauri/src/lib.rs`:
```rust
pub mod commands;
pub mod domain;
pub mod error;
pub mod persistence;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

`src-tauri/src/main.rs`:
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    dev_tool_lib::run();
}
```

Stub the modules so the build succeeds:

`src-tauri/src/error.rs`:
```rust
// Filled in Task 2.
```

`src-tauri/src/commands/mod.rs`, `src-tauri/src/domain/mod.rs`, `src-tauri/src/persistence/mod.rs`:
```rust
// Filled in later tasks.
```

- [ ] **Step 1.10: Create `src/styles/tokens.css`**

```css
:root {
  --bg-base: #faf9f7;
  --bg-panel: #ffffff;
  --text-primary: #1f1e1b;
  --text-muted: #6f6a62;
  --accent: #d97757;
  --border: #e5e2dc;
  --diff-added: #5c8a5a;
  --diff-removed: #c75450;
  --diff-modified: #d4a347;
  --diff-type-changed: #4a7b9d;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

:root.dark {
  --bg-base: #1a1817;
  --bg-panel: #252321;
  --text-primary: #f0eee9;
  --text-muted: #9a948a;
  --accent: #e08866;
  --border: #3a3633;
  --diff-added: #7da97a;
  --diff-removed: #d97470;
  --diff-modified: #e2bb5e;
  --diff-type-changed: #6da4c6;
  --shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

body {
  margin: 0;
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, Inter, sans-serif;
  -webkit-font-smoothing: antialiased;
}
```

- [ ] **Step 1.11: Create `src/main.tsx` and `src/App.tsx`**

`src/main.tsx`:
```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

`src/App.tsx` (placeholder, replaced in Task 9):
```tsx
export default function App() {
  return (
    <div className="p-6 text-primary">
      <h1 className="text-xl font-semibold">DevTool — bootstrapping</h1>
    </div>
  );
}
```

- [ ] **Step 1.12: Install + verify build**

Run:
```bash
npm install
cargo build --manifest-path src-tauri/Cargo.toml
```
Expected: both succeed without errors. (No `tauri dev` yet — we want to keep the loop tight.)

- [ ] **Step 1.13: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore: scaffold Tauri 2 + React 18 + Tailwind project

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Define Rust error model

**Files:**
- Modify: `src-tauri/src/error.rs`
- Modify: `src-tauri/src/lib.rs` (already declares `error` mod)

- [ ] **Step 2.1: Write the failing test**

Create `src-tauri/src/error.rs`:
```rust
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
```

- [ ] **Step 2.2: Run tests to verify they pass**

Run: `cargo test --manifest-path src-tauri/Cargo.toml error::`
Expected: 3 passed.

- [ ] **Step 2.3: Commit**

```bash
git add src-tauri/src/error.rs
git commit -m "$(cat <<'EOF'
feat(error): add AppError enum with serializable IPC contract

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Define history domain types

**Files:**
- Create: `src-tauri/src/domain/history.rs`
- Modify: `src-tauri/src/domain/mod.rs`

- [ ] **Step 3.1: Replace `src-tauri/src/domain/mod.rs`**

```rust
pub mod history;
```

- [ ] **Step 3.2: Write the test + types**

Create `src-tauri/src/domain/history.rs`:
```rust
use serde::{Deserialize, Serialize};

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

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "json_viewer" => Some(Self::JsonViewer),
            "json_diff" => Some(Self::JsonDiff),
            "escape" => Some(Self::Escape),
            "base64" => Some(Self::Base64),
            "url_parser" => Some(Self::UrlParser),
            _ => None,
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
    pub mode: SaveMode,
    pub title: String,
    pub content: HistoryContent,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tool_kind_round_trip() {
        for tool in [
            ToolKind::JsonViewer,
            ToolKind::JsonDiff,
            ToolKind::Escape,
            ToolKind::Base64,
            ToolKind::UrlParser,
        ] {
            assert_eq!(ToolKind::from_str(tool.as_str()), Some(tool));
        }
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
```

- [ ] **Step 3.3: Run tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml domain::`
Expected: 3 passed.

- [ ] **Step 3.4: Commit**

```bash
git add src-tauri/src/domain/
git commit -m "$(cat <<'EOF'
feat(domain): add history domain types (ToolKind, HistoryContent, SaveRequest)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: SQLite connection + migration

**Files:**
- Create: `src-tauri/src/persistence/db.rs`
- Modify: `src-tauri/src/persistence/mod.rs`

- [ ] **Step 4.1: Replace `src-tauri/src/persistence/mod.rs`**

```rust
pub mod db;
pub mod history;
```

- [ ] **Step 4.2: Write the failing tests + implementation**

Create `src-tauri/src/persistence/db.rs`:
```rust
use crate::error::AppError;
use rusqlite::Connection;
use std::path::Path;
use std::sync::Mutex;

pub struct DbHandle {
    pub conn: Mutex<Connection>,
}

impl DbHandle {
    pub fn open(path: &Path) -> Result<Self, AppError> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let conn = Connection::open(path)?;
        let handle = Self { conn: Mutex::new(conn) };
        handle.migrate()?;
        Ok(handle)
    }

    pub fn open_in_memory() -> Result<Self, AppError> {
        let conn = Connection::open_in_memory()?;
        let handle = Self { conn: Mutex::new(conn) };
        handle.migrate()?;
        Ok(handle)
    }

    fn migrate(&self) -> Result<(), AppError> {
        let conn = self.conn.lock().expect("db poisoned");
        conn.execute_batch(
            r#"
            CREATE TABLE IF NOT EXISTS history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                tool        TEXT NOT NULL,
                title       TEXT NOT NULL,
                content     TEXT NOT NULL,
                created_at  INTEGER NOT NULL,
                updated_at  INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_history_tool_updated ON history(tool, updated_at DESC);
            CREATE INDEX IF NOT EXISTS idx_history_title ON history(title);
            "#,
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_in_memory_runs_migration() {
        let db = DbHandle::open_in_memory().unwrap();
        let conn = db.conn.lock().unwrap();
        let table_exists: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name='history'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(table_exists, 1);
    }

    #[test]
    fn open_creates_parent_dir() {
        let tmp = tempfile::tempdir().unwrap();
        let nested = tmp.path().join("does/not/exist/db.sqlite");
        let db = DbHandle::open(&nested).unwrap();
        drop(db);
        assert!(nested.exists());
    }

    #[test]
    fn migration_is_idempotent() {
        let tmp = tempfile::tempdir().unwrap();
        let path = tmp.path().join("db.sqlite");
        let db = DbHandle::open(&path).unwrap();
        drop(db);
        // Reopen — migrate again, no error.
        let _db = DbHandle::open(&path).unwrap();
    }
}
```

- [ ] **Step 4.3: Run tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml persistence::db`
Expected: 3 passed.

- [ ] **Step 4.4: Commit**

```bash
git add src-tauri/src/persistence/
git commit -m "$(cat <<'EOF'
feat(persistence): add DbHandle with SQLite migration

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: History repository CRUD

**Files:**
- Create: `src-tauri/src/persistence/history.rs`

- [ ] **Step 5.1: Write the failing tests**

Create `src-tauri/src/persistence/history.rs`:
```rust
use crate::domain::history::{HistoryContent, HistoryItem, SaveMode, SaveRequest, ToolKind};
use crate::error::AppError;
use rusqlite::{params, Connection};

fn now_millis() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn row_to_item(
    id: i64,
    tool: String,
    title: String,
    content: String,
    created_at: i64,
    updated_at: i64,
) -> Result<HistoryItem, AppError> {
    let tool = ToolKind::from_str(&tool)
        .ok_or_else(|| AppError::Internal(format!("unknown tool kind: {tool}")))?;
    let content: HistoryContent = serde_json::from_str(&content)?;
    Ok(HistoryItem {
        id,
        tool,
        title,
        content,
        created_at,
        updated_at,
    })
}

pub fn save(conn: &Connection, req: SaveRequest) -> Result<HistoryItem, AppError> {
    let tool = req.content.tool();
    let content_json = serde_json::to_string(&req.content)?;
    let now = now_millis();

    let id = match req.mode {
        SaveMode::New => {
            conn.execute(
                "INSERT INTO history (tool, title, content, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?4)",
                params![tool.as_str(), req.title, content_json, now],
            )?;
            conn.last_insert_rowid()
        }
        SaveMode::Overwrite { id } => {
            let updated = conn.execute(
                "UPDATE history SET title = ?1, content = ?2, updated_at = ?3
                 WHERE id = ?4 AND tool = ?5",
                params![req.title, content_json, now, id, tool.as_str()],
            )?;
            if updated == 0 {
                return Err(AppError::Internal(format!(
                    "history item {id} not found for tool {}",
                    tool.as_str()
                )));
            }
            id
        }
    };
    get(conn, id)
}

pub fn get(conn: &Connection, id: i64) -> Result<HistoryItem, AppError> {
    conn.query_row(
        "SELECT id, tool, title, content, created_at, updated_at FROM history WHERE id = ?1",
        params![id],
        |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, i64>(5)?,
            ))
        },
    )
    .map_err(AppError::from)
    .and_then(|(id, tool, title, content, c, u)| row_to_item(id, tool, title, content, c, u))
}

pub fn list(
    conn: &Connection,
    tool: ToolKind,
    search: Option<&str>,
) -> Result<Vec<HistoryItem>, AppError> {
    let mut stmt;
    let rows: Result<Vec<_>, rusqlite::Error> = if let Some(q) = search {
        let pattern = format!("%{q}%");
        stmt = conn.prepare(
            "SELECT id, tool, title, content, created_at, updated_at
             FROM history WHERE tool = ?1 AND title LIKE ?2
             ORDER BY updated_at DESC",
        )?;
        stmt.query_map(params![tool.as_str(), pattern], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, i64>(5)?,
            ))
        })?
        .collect()
    } else {
        stmt = conn.prepare(
            "SELECT id, tool, title, content, created_at, updated_at
             FROM history WHERE tool = ?1
             ORDER BY updated_at DESC",
        )?;
        stmt.query_map(params![tool.as_str()], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, String>(3)?,
                r.get::<_, i64>(4)?,
                r.get::<_, i64>(5)?,
            ))
        })?
        .collect()
    };

    rows?
        .into_iter()
        .map(|(id, tool, title, content, c, u)| row_to_item(id, tool, title, content, c, u))
        .collect()
}

pub fn delete(conn: &Connection, id: i64) -> Result<(), AppError> {
    let n = conn.execute("DELETE FROM history WHERE id = ?1", params![id])?;
    if n == 0 {
        return Err(AppError::Internal(format!("history item {id} not found")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::persistence::db::DbHandle;

    fn db() -> DbHandle {
        DbHandle::open_in_memory().unwrap()
    }

    fn sample_request(input: &str) -> SaveRequest {
        SaveRequest {
            mode: SaveMode::New,
            title: format!("Title for {input}"),
            content: HistoryContent::JsonViewer {
                input: input.into(),
            },
        }
    }

    #[test]
    fn save_new_returns_item_with_id_and_timestamps() {
        let db = db();
        let conn = db.conn.lock().unwrap();
        let item = save(&conn, sample_request("a")).unwrap();
        assert!(item.id > 0);
        assert_eq!(item.created_at, item.updated_at);
        assert_eq!(item.tool, ToolKind::JsonViewer);
    }

    #[test]
    fn list_filters_by_tool_and_orders_by_updated_at_desc() {
        let db = db();
        let conn = db.conn.lock().unwrap();
        let a = save(&conn, sample_request("a")).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(2));
        let b = save(&conn, sample_request("b")).unwrap();
        let mut other = sample_request("c");
        other.content = HistoryContent::Escape {
            input: "x".into(),
            direction: crate::domain::history::EscapeDirection::Escape,
        };
        let _other = save(&conn, other).unwrap();

        let items = list(&conn, ToolKind::JsonViewer, None).unwrap();
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].id, b.id);
        assert_eq!(items[1].id, a.id);
    }

    #[test]
    fn list_search_filters_by_title_substring() {
        let db = db();
        let conn = db.conn.lock().unwrap();
        let _ = save(&conn, sample_request("alpha")).unwrap();
        let _ = save(&conn, sample_request("beta")).unwrap();
        let items = list(&conn, ToolKind::JsonViewer, Some("alp")).unwrap();
        assert_eq!(items.len(), 1);
    }

    #[test]
    fn save_overwrite_preserves_created_at_and_bumps_updated_at() {
        let db = db();
        let conn = db.conn.lock().unwrap();
        let original = save(&conn, sample_request("a")).unwrap();
        std::thread::sleep(std::time::Duration::from_millis(2));

        let req = SaveRequest {
            mode: SaveMode::Overwrite { id: original.id },
            title: "renamed".into(),
            content: HistoryContent::JsonViewer {
                input: "new".into(),
            },
        };
        let updated = save(&conn, req).unwrap();
        assert_eq!(updated.id, original.id);
        assert_eq!(updated.created_at, original.created_at);
        assert!(updated.updated_at > original.updated_at);
        assert_eq!(updated.title, "renamed");
    }

    #[test]
    fn save_overwrite_rejects_unknown_id() {
        let db = db();
        let conn = db.conn.lock().unwrap();
        let req = SaveRequest {
            mode: SaveMode::Overwrite { id: 99999 },
            title: "x".into(),
            content: HistoryContent::JsonViewer { input: "y".into() },
        };
        let err = save(&conn, req).unwrap_err();
        assert!(matches!(err, AppError::Internal(_)));
    }

    #[test]
    fn delete_removes_row() {
        let db = db();
        let conn = db.conn.lock().unwrap();
        let item = save(&conn, sample_request("a")).unwrap();
        delete(&conn, item.id).unwrap();
        let err = get(&conn, item.id).unwrap_err();
        assert!(matches!(err, AppError::Db(_)));
    }
}
```

- [ ] **Step 5.2: Run tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml persistence::history`
Expected: 6 passed.

- [ ] **Step 5.3: Commit**

```bash
git add src-tauri/src/persistence/history.rs
git commit -m "$(cat <<'EOF'
feat(persistence): add history CRUD with new/overwrite/list/delete

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: History Tauri commands

**Files:**
- Create: `src-tauri/src/commands/history.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 6.1: Replace `src-tauri/src/commands/mod.rs`**

```rust
pub mod history;
```

- [ ] **Step 6.2: Create `src-tauri/src/commands/history.rs`**

```rust
use crate::domain::history::{HistoryItem, SaveRequest, ToolKind};
use crate::error::AppError;
use crate::persistence::{db::DbHandle, history as repo};
use tauri::State;

#[tauri::command]
pub async fn history_save(
    db: State<'_, DbHandle>,
    req: SaveRequest,
) -> Result<HistoryItem, AppError> {
    let conn = db.conn.lock().expect("db poisoned");
    repo::save(&conn, req)
}

#[tauri::command]
pub async fn history_list(
    db: State<'_, DbHandle>,
    tool: ToolKind,
    search: Option<String>,
) -> Result<Vec<HistoryItem>, AppError> {
    let conn = db.conn.lock().expect("db poisoned");
    repo::list(&conn, tool, search.as_deref())
}

#[tauri::command]
pub async fn history_get(
    db: State<'_, DbHandle>,
    id: i64,
) -> Result<HistoryItem, AppError> {
    let conn = db.conn.lock().expect("db poisoned");
    repo::get(&conn, id)
}

#[tauri::command]
pub async fn history_delete(
    db: State<'_, DbHandle>,
    id: i64,
) -> Result<(), AppError> {
    let conn = db.conn.lock().expect("db poisoned");
    repo::delete(&conn, id)
}
```

- [ ] **Step 6.3: Wire commands and DbHandle into `src-tauri/src/lib.rs`**

Replace `src-tauri/src/lib.rs`:
```rust
pub mod commands;
pub mod domain;
pub mod error;
pub mod persistence;

use persistence::db::DbHandle;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            let app_data = app
                .path()
                .app_data_dir()
                .expect("resolve app_data_dir");
            let db_path = app_data.join("history.sqlite");
            let db = DbHandle::open(&db_path).expect("open history db");
            app.manage(db);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::history::history_save,
            commands::history::history_list,
            commands::history::history_get,
            commands::history::history_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 6.4: Build to verify**

Run: `cargo build --manifest-path src-tauri/Cargo.toml`
Expected: success.

- [ ] **Step 6.5: Commit**

```bash
git add src-tauri/src/commands/ src-tauri/src/lib.rs
git commit -m "$(cat <<'EOF'
feat(commands): wire history_save/list/get/delete with DbHandle state

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Frontend IPC layer + shared types

**Files:**
- Create: `src/types/ipc.ts`
- Create: `src/lib/ipc.ts`
- Create: `src/lib/debounce.ts`
- Create: `src/lib/format.ts`
- Create: `src/test-setup.ts`
- Create: `src/lib/__tests__/debounce.test.ts`
- Create: `src/lib/__tests__/format.test.ts`

- [ ] **Step 7.1: Create `src/test-setup.ts`**

```ts
import "@testing-library/jest-dom";
```

- [ ] **Step 7.2: Create `src/types/ipc.ts`**

```ts
// Mirror of Rust types in src-tauri/src/domain/history.rs and src-tauri/src/error.rs.
// Keep in sync manually.

export type ToolKind =
  | "json_viewer"
  | "json_diff"
  | "escape"
  | "base64"
  | "url_parser";

export type EscapeDirection = "escape" | "unescape";
export type CodecDirection = "encode" | "decode";

export type HistoryContent =
  | { tool: "json_viewer"; input: string }
  | { tool: "json_diff"; left: string; right: string }
  | { tool: "escape"; input: string; direction: EscapeDirection }
  | {
      tool: "base64";
      input: string;
      direction: CodecDirection;
      url_safe: boolean;
    }
  | { tool: "url_parser"; url: string };

export interface HistoryItem {
  id: number;
  tool: ToolKind;
  title: string;
  content: HistoryContent;
  created_at: number;
  updated_at: number;
}

export type SaveMode = { mode: "new" } | { mode: "overwrite"; id: number };

export type SaveRequest = SaveMode & {
  title: string;
  content: HistoryContent;
};

export type AppError =
  | { code: "parse"; line: number; col: number; message: string }
  | {
      code: "codec" | "url_parse" | "db" | "io" | "internal";
      message: string;
    };
```

- [ ] **Step 7.3: Create `src/lib/ipc.ts`**

```ts
import { invoke } from "@tauri-apps/api/core";
import type { AppError } from "../types/ipc";

export class IpcError extends Error {
  constructor(public readonly app: AppError) {
    super(app.message);
    this.name = "IpcError";
  }
}

function isAppError(e: unknown): e is AppError {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    typeof (e as { code: unknown }).code === "string"
  );
}

export async function ipc<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (raw) {
    if (isAppError(raw)) {
      throw new IpcError(raw);
    }
    throw new IpcError({
      code: "internal",
      message: typeof raw === "string" ? raw : JSON.stringify(raw),
    });
  }
}
```

- [ ] **Step 7.4: Write the failing test for `debounce`**

`src/lib/__tests__/debounce.test.ts`:
```ts
import { describe, expect, it, vi } from "vitest";
import { debounce } from "../debounce";

describe("debounce", () => {
  it("delays call until the wait window passes", async () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d("a");
    d("b");
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(99);
    expect(fn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("b");
    vi.useRealTimers();
  });

  it("cancel() prevents pending invocation", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const d = debounce(fn, 100);
    d("x");
    d.cancel();
    vi.advanceTimersByTime(200);
    expect(fn).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 7.5: Implement `src/lib/debounce.ts`**

```ts
export interface Debounced<F extends (...args: unknown[]) => void> {
  (...args: Parameters<F>): void;
  cancel(): void;
}

export function debounce<F extends (...args: never[]) => void>(
  fn: F,
  waitMs: number,
): Debounced<F> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<F> | null = null;

  const debounced = ((...args: Parameters<F>) => {
    lastArgs = args;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (lastArgs) fn(...lastArgs);
    }, waitMs);
  }) as Debounced<F>;

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = null;
  };

  return debounced;
}
```

- [ ] **Step 7.6: Write the failing test for `format`**

`src/lib/__tests__/format.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { formatRelativeTime, formatBytes } from "../format";

describe("formatRelativeTime", () => {
  it("returns 'just now' for less than a minute ago", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 30_000, now)).toBe("just now");
  });

  it("returns minutes for under an hour", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe("5m ago");
  });

  it("returns hours for under a day", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 3 * 3_600_000, now)).toBe("3h ago");
  });

  it("returns days otherwise", () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 4 * 86_400_000, now)).toBe("4d ago");
  });
});

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(512)).toBe("512 B");
  });
  it("formats kilobytes", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });
  it("formats megabytes", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});
```

- [ ] **Step 7.7: Implement `src/lib/format.ts`**

```ts
export function formatRelativeTime(ts: number, now = Date.now()): string {
  const diffMs = Math.max(0, now - ts);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

- [ ] **Step 7.8: Run tests**

Run: `npm test`
Expected: all `debounce` and `format` tests pass.

- [ ] **Step 7.9: Commit**

```bash
git add src/types/ src/lib/ src/test-setup.ts
git commit -m "$(cat <<'EOF'
feat(frontend): add ipc wrapper, IPC types, debounce, format helpers

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: History store + API wrapper

**Files:**
- Create: `src/history/api.ts`
- Create: `src/history/store.ts`
- Create: `src/history/__tests__/store.test.ts`

- [ ] **Step 8.1: Create `src/history/api.ts`**

```ts
import { ipc } from "../lib/ipc";
import type { HistoryItem, SaveRequest, ToolKind } from "../types/ipc";

export const historyApi = {
  list: (tool: ToolKind, search?: string) =>
    ipc<HistoryItem[]>("history_list", { tool, search: search ?? null }),
  get: (id: number) => ipc<HistoryItem>("history_get", { id }),
  save: (req: SaveRequest) => ipc<HistoryItem>("history_save", { req }),
  delete: (id: number) => ipc<void>("history_delete", { id }),
};
```

- [ ] **Step 8.2: Write the failing test for `store`**

`src/history/__tests__/store.test.ts`:
```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryStore } from "../store";
import type { HistoryItem } from "../../types/ipc";

vi.mock("../api", () => ({
  historyApi: {
    list: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
}));

import { historyApi } from "../api";

const sample: HistoryItem = {
  id: 1,
  tool: "json_viewer",
  title: "t",
  content: { tool: "json_viewer", input: "{}" },
  created_at: 0,
  updated_at: 0,
};

describe("history store", () => {
  beforeEach(() => {
    useHistoryStore.setState({ itemsByTool: {}, loadedIdByTool: {} });
    vi.clearAllMocks();
  });

  it("refresh populates itemsByTool[tool]", async () => {
    (historyApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([sample]);
    await useHistoryStore.getState().refresh("json_viewer");
    expect(useHistoryStore.getState().itemsByTool.json_viewer).toEqual([sample]);
  });

  it("setLoadedId sets and clears per tool", () => {
    useHistoryStore.getState().setLoadedId("json_viewer", 7);
    expect(useHistoryStore.getState().loadedIdByTool.json_viewer).toBe(7);
    useHistoryStore.getState().setLoadedId("json_viewer", null);
    expect(useHistoryStore.getState().loadedIdByTool.json_viewer).toBeNull();
  });

  it("save with mode=new prepends the returned item to the list", async () => {
    useHistoryStore.setState({
      itemsByTool: { json_viewer: [] },
      loadedIdByTool: {},
    });
    (historyApi.save as ReturnType<typeof vi.fn>).mockResolvedValue(sample);
    const item = await useHistoryStore
      .getState()
      .save({ mode: "new", title: "t", content: sample.content });
    expect(item).toEqual(sample);
    expect(useHistoryStore.getState().itemsByTool.json_viewer).toEqual([sample]);
    expect(useHistoryStore.getState().loadedIdByTool.json_viewer).toBe(1);
  });

  it("save with mode=overwrite replaces matching item in the list", async () => {
    useHistoryStore.setState({
      itemsByTool: {
        json_viewer: [
          { ...sample, id: 1, title: "old" },
          { ...sample, id: 2, title: "other" },
        ],
      },
      loadedIdByTool: { json_viewer: 1 },
    });
    const updated = { ...sample, id: 1, title: "renamed", updated_at: 5 };
    (historyApi.save as ReturnType<typeof vi.fn>).mockResolvedValue(updated);
    await useHistoryStore.getState().save({
      mode: "overwrite",
      id: 1,
      title: "renamed",
      content: sample.content,
    });
    const items = useHistoryStore.getState().itemsByTool.json_viewer;
    expect(items?.[0]).toEqual(updated);
    expect(items).toHaveLength(2);
  });

  it("delete removes item and clears loaded id if matched", async () => {
    useHistoryStore.setState({
      itemsByTool: { json_viewer: [sample] },
      loadedIdByTool: { json_viewer: 1 },
    });
    (historyApi.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    await useHistoryStore.getState().remove("json_viewer", 1);
    expect(useHistoryStore.getState().itemsByTool.json_viewer).toEqual([]);
    expect(useHistoryStore.getState().loadedIdByTool.json_viewer).toBeNull();
  });
});
```

- [ ] **Step 8.3: Implement `src/history/store.ts`**

```ts
import { create } from "zustand";
import { historyApi } from "./api";
import type { HistoryItem, SaveRequest, ToolKind } from "../types/ipc";

interface HistoryState {
  itemsByTool: Partial<Record<ToolKind, HistoryItem[]>>;
  loadedIdByTool: Partial<Record<ToolKind, number | null>>;
  refresh(tool: ToolKind, search?: string): Promise<void>;
  setLoadedId(tool: ToolKind, id: number | null): void;
  save(req: SaveRequest): Promise<HistoryItem>;
  remove(tool: ToolKind, id: number): Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  itemsByTool: {},
  loadedIdByTool: {},

  async refresh(tool, search) {
    const items = await historyApi.list(tool, search);
    set((s) => ({ itemsByTool: { ...s.itemsByTool, [tool]: items } }));
  },

  setLoadedId(tool, id) {
    set((s) => ({ loadedIdByTool: { ...s.loadedIdByTool, [tool]: id } }));
  },

  async save(req) {
    const saved = await historyApi.save(req);
    const tool = saved.tool;
    set((s) => {
      const current = s.itemsByTool[tool] ?? [];
      const next =
        req.mode === "new"
          ? [saved, ...current]
          : current.map((it) => (it.id === saved.id ? saved : it));
      return {
        itemsByTool: { ...s.itemsByTool, [tool]: next },
        loadedIdByTool: { ...s.loadedIdByTool, [tool]: saved.id },
      };
    });
    return saved;
  },

  async remove(tool, id) {
    await historyApi.delete(id);
    set((s) => {
      const next = (s.itemsByTool[tool] ?? []).filter((it) => it.id !== id);
      const loaded =
        s.loadedIdByTool[tool] === id ? null : s.loadedIdByTool[tool] ?? null;
      return {
        itemsByTool: { ...s.itemsByTool, [tool]: next },
        loadedIdByTool: { ...s.loadedIdByTool, [tool]: loaded },
      };
    });
  },
}));
```

- [ ] **Step 8.4: Run tests**

Run: `npm test`
Expected: all 5 store tests pass.

- [ ] **Step 8.5: Commit**

```bash
git add src/history/
git commit -m "$(cat <<'EOF'
feat(history): add zustand store with refresh/save/delete and loaded-id tracking

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Theme store + ThemeToggle

**Files:**
- Create: `src/shell/themeStore.ts`
- Create: `src/shell/ThemeToggle.tsx`
- Create: `src/shell/__tests__/themeStore.test.ts`

- [ ] **Step 9.1: Write the failing test**

`src/shell/__tests__/themeStore.test.ts`:
```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "../themeStore";

describe("theme store", () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: "light" });
    document.documentElement.classList.remove("dark");
  });

  it("light mode removes the dark class", () => {
    useThemeStore.getState().setMode("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("dark mode adds the dark class", () => {
    useThemeStore.getState().setMode("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("cycle goes light -> dark -> system -> light", () => {
    useThemeStore.setState({ mode: "light" });
    useThemeStore.getState().cycle();
    expect(useThemeStore.getState().mode).toBe("dark");
    useThemeStore.getState().cycle();
    expect(useThemeStore.getState().mode).toBe("system");
    useThemeStore.getState().cycle();
    expect(useThemeStore.getState().mode).toBe("light");
  });
});
```

- [ ] **Step 9.2: Implement `src/shell/themeStore.ts`**

```ts
import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  setMode(mode: ThemeMode): void;
  cycle(): void;
}

function applyMode(mode: ThemeMode) {
  const root = document.documentElement;
  const effective =
    mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;
  root.classList.toggle("dark", effective === "dark");
}

const order: ThemeMode[] = ["light", "dark", "system"];

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "light",
  setMode(mode) {
    applyMode(mode);
    set({ mode });
  },
  cycle() {
    const current = get().mode;
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    get().setMode(next);
  },
}));

if (typeof window !== "undefined") {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (useThemeStore.getState().mode === "system") {
        applyMode("system");
      }
    });
}
```

- [ ] **Step 9.3: Create `src/shell/ThemeToggle.tsx`**

```tsx
import { useThemeStore } from "./themeStore";

const labels: Record<string, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeToggle() {
  const { mode, cycle } = useThemeStore();
  return (
    <button
      type="button"
      onClick={cycle}
      className="px-3 py-1 text-sm rounded-md border border-[color:var(--border)] hover:bg-[color:var(--bg-panel)] transition-colors"
      title="Cycle theme: light → dark → system"
    >
      {labels[mode]}
    </button>
  );
}
```

- [ ] **Step 9.4: Run tests**

Run: `npm test`
Expected: 3 theme store tests pass.

- [ ] **Step 9.5: Commit**

```bash
git add src/shell/themeStore.ts src/shell/ThemeToggle.tsx src/shell/__tests__/
git commit -m "$(cat <<'EOF'
feat(shell): add theme store cycling light/dark/system with class toggle

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: ToolTabs + TitleBar + ToastHost

**Files:**
- Create: `src/shell/ToolTabs.tsx`
- Create: `src/shell/TitleBar.tsx`
- Create: `src/shell/ToastHost.tsx`
- Create: `src/shell/toastStore.ts`
- Create: `src/shell/activeToolStore.ts`

- [ ] **Step 10.1: Create `src/shell/activeToolStore.ts`**

```ts
import { create } from "zustand";
import type { ToolKind } from "../types/ipc";

interface ActiveToolState {
  active: ToolKind;
  setActive(tool: ToolKind): void;
}

export const useActiveToolStore = create<ActiveToolState>((set) => ({
  active: "json_viewer",
  setActive: (tool) => set({ active: tool }),
}));
```

- [ ] **Step 10.2: Create `src/shell/ToolTabs.tsx`**

```tsx
import { useActiveToolStore } from "./activeToolStore";
import type { ToolKind } from "../types/ipc";

const tabs: Array<{ id: ToolKind; label: string }> = [
  { id: "json_viewer", label: "JSON Viewer" },
  { id: "json_diff", label: "JSON Diff" },
  { id: "escape", label: "Escape" },
  { id: "base64", label: "Base64" },
  { id: "url_parser", label: "URL Parser" },
];

export function ToolTabs() {
  const { active, setActive } = useActiveToolStore();
  return (
    <nav className="flex gap-1" aria-label="Tools">
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={[
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              isActive
                ? "bg-[color:var(--accent)] text-white"
                : "text-[color:var(--text-primary)] hover:bg-[color:var(--bg-panel)]",
            ].join(" ")}
            aria-current={isActive ? "page" : undefined}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 10.3: Create `src/shell/toastStore.ts`**

```ts
import { create } from "zustand";

export type ToastKind = "info" | "error" | "success";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastState {
  toasts: Toast[];
  push(kind: ToastKind, message: string): void;
  dismiss(id: number): void;
}

let counter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push(kind, message) {
    const id = ++counter;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => get().dismiss(id), 4000);
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));
```

- [ ] **Step 10.4: Create `src/shell/ToastHost.tsx`**

```tsx
import { useToastStore } from "./toastStore";

const kindClass: Record<string, string> = {
  info: "border-[color:var(--border)]",
  success: "border-[color:var(--diff-added)]",
  error: "border-[color:var(--diff-removed)]",
};

export function ToastHost() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="fixed top-3 right-3 flex flex-col gap-2 z-50">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`max-w-sm text-left text-sm bg-[color:var(--bg-panel)] border rounded-md px-3 py-2 shadow ${kindClass[t.kind]}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 10.5: Create `src/shell/TitleBar.tsx`**

```tsx
import { ThemeToggle } from "./ThemeToggle";
import { ToolTabs } from "./ToolTabs";

interface TitleBarProps {
  onToggleHistory: () => void;
}

export function TitleBar({ onToggleHistory }: TitleBarProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-[color:var(--border)] bg-[color:var(--bg-base)]">
      <div className="text-sm font-semibold text-[color:var(--text-primary)]">
        DevTool
      </div>
      <ToolTabs />
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <button
          type="button"
          onClick={onToggleHistory}
          className="px-3 py-1 text-sm rounded-md border border-[color:var(--border)] hover:bg-[color:var(--bg-panel)] transition-colors"
        >
          History
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 10.6: Verify build**

Run: `npm run build`
Expected: TypeScript compiles, vite produces dist.

- [ ] **Step 10.7: Commit**

```bash
git add src/shell/
git commit -m "$(cat <<'EOF'
feat(shell): add ToolTabs, TitleBar, ToastHost, active-tool + toast stores

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: HistoryDrawer + SaveDialog

**Files:**
- Create: `src/history/HistoryDrawer.tsx`
- Create: `src/history/SaveDialog.tsx`
- Create: `src/history/__tests__/SaveDialog.test.tsx`

- [ ] **Step 11.1: Create `src/history/HistoryDrawer.tsx`**

```tsx
import { useEffect, useState } from "react";
import { useHistoryStore } from "./store";
import { formatBytes, formatRelativeTime } from "../lib/format";
import type { HistoryContent, HistoryItem, ToolKind } from "../types/ipc";

interface HistoryDrawerProps {
  open: boolean;
  tool: ToolKind;
  onLoad(item: HistoryItem): void;
}

function contentSize(c: HistoryContent): number {
  switch (c.tool) {
    case "json_viewer":
      return c.input.length;
    case "json_diff":
      return c.left.length + c.right.length;
    case "escape":
    case "base64":
      return c.input.length;
    case "url_parser":
      return c.url.length;
  }
}

export function HistoryDrawer({ open, tool, onLoad }: HistoryDrawerProps) {
  const items = useHistoryStore((s) => s.itemsByTool[tool] ?? []);
  const refresh = useHistoryStore((s) => s.refresh);
  const remove = useHistoryStore((s) => s.remove);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) refresh(tool, search.trim() || undefined);
  }, [open, tool, search, refresh]);

  if (!open) return null;

  return (
    <aside className="w-80 border-l border-[color:var(--border)] bg-[color:var(--bg-panel)] flex flex-col">
      <div className="p-3 border-b border-[color:var(--border)]">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search history…"
          className="w-full px-2 py-1 text-sm rounded border border-[color:var(--border)] bg-[color:var(--bg-base)]"
        />
      </div>
      <ul className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <li className="p-4 text-sm text-[color:var(--text-muted)]">
            No saved items yet.
          </li>
        ) : (
          items.map((item) => (
            <li
              key={item.id}
              className="border-b border-[color:var(--border)] flex items-stretch hover:bg-[color:var(--bg-base)]"
            >
              <button
                type="button"
                onClick={() => onLoad(item)}
                className="flex-1 text-left px-3 py-2"
              >
                <div className="text-sm font-medium truncate">{item.title}</div>
                <div className="text-xs text-[color:var(--text-muted)] mt-0.5">
                  {formatRelativeTime(item.updated_at)} ·{" "}
                  {formatBytes(contentSize(item.content))}
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete "${item.title}"?`)) {
                    remove(tool, item.id);
                  }
                }}
                className="px-2 text-[color:var(--text-muted)] hover:text-[color:var(--diff-removed)]"
                title="Delete"
              >
                ×
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 11.2: Write the failing test for SaveDialog**

`src/history/__tests__/SaveDialog.test.tsx`:
```tsx
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SaveDialog } from "../SaveDialog";

describe("SaveDialog", () => {
  it("disables Overwrite when loadedId is null", () => {
    render(
      <SaveDialog
        open
        defaultTitle="t"
        loadedId={null}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /overwrite/i })).toBeDisabled();
  });

  it("enables Overwrite when loadedId is set and emits overwrite mode", () => {
    const onSave = vi.fn();
    render(
      <SaveDialog
        open
        defaultTitle="t"
        loadedId={42}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /overwrite/i }));
    expect(onSave).toHaveBeenCalledWith({ mode: "overwrite", id: 42, title: "t" });
  });

  it("calls onSave with mode=new when New clicked", () => {
    const onSave = vi.fn();
    render(
      <SaveDialog
        open
        defaultTitle="t"
        loadedId={null}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^new$/i }));
    expect(onSave).toHaveBeenCalledWith({ mode: "new", title: "t" });
  });
});
```

- [ ] **Step 11.3: Implement `src/history/SaveDialog.tsx`**

```tsx
import { useState } from "react";

export type SaveResult =
  | { mode: "new"; title: string }
  | { mode: "overwrite"; id: number; title: string };

interface SaveDialogProps {
  open: boolean;
  defaultTitle: string;
  loadedId: number | null;
  onSave(result: SaveResult): void;
  onCancel(): void;
}

export function SaveDialog({
  open,
  defaultTitle,
  loadedId,
  onSave,
  onCancel,
}: SaveDialogProps) {
  const [title, setTitle] = useState(defaultTitle);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center">
      <div className="bg-[color:var(--bg-panel)] border border-[color:var(--border)] rounded-lg shadow w-96 p-4">
        <h2 className="text-sm font-semibold mb-3">Save to history</h2>
        <label className="block text-xs text-[color:var(--text-muted)] mb-1">
          Title
        </label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-2 py-1 mb-4 text-sm rounded border border-[color:var(--border)] bg-[color:var(--bg-base)]"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-sm rounded border border-[color:var(--border)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loadedId === null}
            onClick={() =>
              loadedId !== null &&
              onSave({ mode: "overwrite", id: loadedId, title })
            }
            className="px-3 py-1 text-sm rounded border border-[color:var(--border)] disabled:opacity-50"
          >
            Overwrite
          </button>
          <button
            type="button"
            onClick={() => onSave({ mode: "new", title })}
            className="px-3 py-1 text-sm rounded bg-[color:var(--accent)] text-white"
          >
            New
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 11.4: Run tests**

Run: `npm test`
Expected: SaveDialog tests pass.

- [ ] **Step 11.5: Commit**

```bash
git add src/history/HistoryDrawer.tsx src/history/SaveDialog.tsx src/history/__tests__/
git commit -m "$(cat <<'EOF'
feat(history): add HistoryDrawer with search/delete and SaveDialog with new/overwrite

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: Tool placeholder shells + App.tsx wiring

**Files:**
- Create: `src/tools/json-viewer/index.tsx`, `src/tools/json-diff/index.tsx`, `src/tools/escape/index.tsx`, `src/tools/base64/index.tsx`, `src/tools/url-parser/index.tsx`
- Replace: `src/App.tsx`

- [ ] **Step 12.1: Create the five placeholder tool entries**

For each path below, create a file with the matching content. (Each is a placeholder that later plans replace.)

`src/tools/json-viewer/index.tsx`:
```tsx
export function JsonViewer() {
  return (
    <div className="h-full flex items-center justify-center text-[color:var(--text-muted)]">
      JSON Viewer — coming next plan.
    </div>
  );
}
```

`src/tools/json-diff/index.tsx`:
```tsx
export function JsonDiff() {
  return (
    <div className="h-full flex items-center justify-center text-[color:var(--text-muted)]">
      JSON Diff — coming next plan.
    </div>
  );
}
```

`src/tools/escape/index.tsx`:
```tsx
export function Escape() {
  return (
    <div className="h-full flex items-center justify-center text-[color:var(--text-muted)]">
      Escape — coming next plan.
    </div>
  );
}
```

`src/tools/base64/index.tsx`:
```tsx
export function Base64() {
  return (
    <div className="h-full flex items-center justify-center text-[color:var(--text-muted)]">
      Base64 — coming next plan.
    </div>
  );
}
```

`src/tools/url-parser/index.tsx`:
```tsx
export function UrlParser() {
  return (
    <div className="h-full flex items-center justify-center text-[color:var(--text-muted)]">
      URL Parser — coming next plan.
    </div>
  );
}
```

- [ ] **Step 12.2: Replace `src/App.tsx`**

```tsx
import { useState } from "react";
import { TitleBar } from "./shell/TitleBar";
import { ToastHost } from "./shell/ToastHost";
import { HistoryDrawer } from "./history/HistoryDrawer";
import { useActiveToolStore } from "./shell/activeToolStore";
import { JsonViewer } from "./tools/json-viewer";
import { JsonDiff } from "./tools/json-diff";
import { Escape } from "./tools/escape";
import { Base64 } from "./tools/base64";
import { UrlParser } from "./tools/url-parser";
import type { HistoryItem, ToolKind } from "./types/ipc";
import { useToastStore } from "./shell/toastStore";

const tools: Record<ToolKind, () => JSX.Element> = {
  json_viewer: JsonViewer,
  json_diff: JsonDiff,
  escape: Escape,
  base64: Base64,
  url_parser: UrlParser,
};

export default function App() {
  const active = useActiveToolStore((s) => s.active);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const push = useToastStore((s) => s.push);

  const ActiveTool = tools[active];

  function handleLoad(item: HistoryItem) {
    push("info", `Loaded "${item.title}".`);
  }

  return (
    <div className="h-screen flex flex-col bg-[color:var(--bg-base)] text-[color:var(--text-primary)]">
      <TitleBar onToggleHistory={() => setDrawerOpen((v) => !v)} />
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden">
          <ActiveTool />
        </main>
        <HistoryDrawer open={drawerOpen} tool={active} onLoad={handleLoad} />
      </div>
      <ToastHost />
    </div>
  );
}
```

- [ ] **Step 12.3: Verify build**

Run: `npm run build`
Expected: TypeScript and Vite both succeed.

- [ ] **Step 12.4: Commit**

```bash
git add src/tools/ src/App.tsx
git commit -m "$(cat <<'EOF'
feat(shell): wire App with tabs, drawer, toast and tool placeholders

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 13: End-to-end smoke verification

**Files:** None modified — this is a manual verification task.

- [ ] **Step 13.1: Start the dev server**

Run: `npm run tauri dev`

Expected: Tauri spins up the macOS window, loads `http://localhost:1420`. Window size 1280×800. Title "DevTool".

- [ ] **Step 13.2: Visual smoke checks**

Confirm in the running app:
- The five tabs (JSON Viewer / JSON Diff / Escape / Base64 / URL Parser) are visible in the title bar.
- Clicking each tab shows its placeholder text.
- "Light" theme button cycles to "Dark", then "System". Background and text colors update accordingly.
- "History" button toggles a right-side drawer with search input and "No saved items yet." message.
- The drawer closes when "History" is clicked again.

- [ ] **Step 13.3: SQLite file exists after launch**

Run: `ls "$HOME/Library/Application Support/com.tristoney.devtool/"`
Expected: directory contains `history.sqlite`.

- [ ] **Step 13.4: Programmatic save/list smoke (optional, via devtools)**

In devtools console:
```js
const { invoke } = await import("@tauri-apps/api/core");
const item = await invoke("history_save", {
  req: {
    mode: "new",
    title: "Smoke",
    content: { tool: "json_viewer", input: "{\"a\":1}" },
  },
});
console.log(item);
const items = await invoke("history_list", { tool: "json_viewer", search: null });
console.log(items);
```
Expected: returned `item` has a numeric id and matches the `req`. `items` array contains it. After this, opening the JSON Viewer tab and clicking History should show "Smoke" as a saved entry.

- [ ] **Step 13.5: Stop dev server, no commit needed**

Press Ctrl+C in the terminal running `npm run tauri dev`. No git changes from this task.

---

## Self-review notes (already applied)

- **Spec coverage:** §2 (tech), §3 (project structure for the shared parts), §7 (history end-to-end), §8 (shell + theming), §9 (error model + IPC contract). Per-tool sections (§6) intentionally deferred to follow-up plans. §10 testing strategy has Rust unit tests and a frontend test setup; tool-level tests come with each tool's plan.
- **Type consistency:** `SaveRequest` shape matches between Rust (`SaveRequest { mode, title, content }` where `mode = SaveMode::{New, Overwrite { id }}`) and TS (`SaveMode = { mode: "new" } | { mode: "overwrite"; id }; SaveRequest = SaveMode & { title; content }`). Both flatten the discriminator at the top level — the TS API call sends `{ req: ... }` which the Rust command receives via `req: SaveRequest`. Verified the JSON shapes line up: `{"mode":"new","title":"…","content":{…}}` and `{"mode":"overwrite","id":1,"title":"…","content":{…}}`.
- **No placeholders:** every code step shows the full content. Tool entry files are explicit placeholders by design (later plans replace them) and contain real, compilable TSX.

---

## Done criteria (Foundation)

- All 13 tasks committed with passing tests at each commit.
- `cargo test --manifest-path src-tauri/Cargo.toml` reports green for all `error::`, `domain::`, `persistence::` modules.
- `npm test` passes for `debounce`, `format`, `history/store`, `themeStore`, `SaveDialog`.
- `npm run tauri dev` opens the macOS app, all five tabs render their placeholders, theme cycle works, history drawer opens against a real SQLite file at `~/Library/Application Support/com.tristoney.devtool/history.sqlite`.

Next: **Plan 2 — JSON Viewer** (editor, parse pipeline, virtualized tree, search, copy, nested expansion, history wiring).
