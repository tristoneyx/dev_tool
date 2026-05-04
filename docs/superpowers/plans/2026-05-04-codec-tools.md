# Codec Tools Implementation Plan (Escape · Base64 · URL Parser)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Escape, Base64, and URL Parser placeholders with three fully-functional codec tools, each with history save/load support. The escape command pair already exists from Plan 2; this plan adds Base64 + URL Parser to the Rust side and ships all three frontends.

**Architecture:** Per-tool Zustand store + per-tool React component. All transformations go through Rust IPC commands (no frontend codec libs). The three tools are deliberately distinct components — no premature abstraction over their layouts.

**Tech Stack:**
- Rust backend: existing serde / thiserror / spawn_blocking pattern + new `base64` (≥0.22) and `url` (≥2.5) dependencies.
- Frontend: existing Zustand + i18next + history infrastructure. New per-tool components, no new shared components.

**Granularity:** **4 coarse tasks**. Each task is one subagent dispatch with internal TDD/typecheck loops; reviewers run once at the end of the task.

---

## Conventions

- **Working directory:** `/Users/tristoney/dev_tool`. All paths relative.
- **Branch:** create `plan-4-codec-tools` off `main` at the start of Task 1.
- **Tests:** Rust via `cargo test --manifest-path src-tauri/Cargo.toml`. Frontend via `npx vitest run`.
- **Commit format:** Conventional Commits with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` trailer. **One commit per task** (squash sub-step fix-ups into a single coherent commit at the end).
- **i18n:** All new user-facing strings go into BOTH `src/i18n/locales/zh-CN.json` and `src/i18n/locales/en.json`. Use `t()` everywhere — no hardcoded user-visible strings.
- **Reuse over duplicate:** the existing `JsonEditor` component is JSON-specific (CodeMirror + lang-json + lint). For these codec tools we use plain `<textarea>` — they're free-form text, not JSON.

---

## File Structure

### Backend (Rust)

```
src-tauri/
├── Cargo.toml                              # MODIFY — add base64 + url deps
└── src/
    ├── domain/
    │   ├── base64_codec.rs                 # NEW — encode/decode + url-safe variants
    │   ├── url_parts.rs                    # NEW — UrlParts type + parse/build
    │   └── mod.rs                          # MODIFY — declare new modules
    ├── commands/
    │   ├── codec.rs                        # NEW — base64_encode/base64_decode/url_parse/url_build
    │   └── mod.rs                          # MODIFY — declare codec module
    └── lib.rs                              # MODIFY — register the four new commands
```

(Note: `json_escape` / `json_unescape` already exist from Plan 2 in `commands/json.rs`. The Escape **frontend** in Task 3 just wraps those — no new Rust code for escape.)

### Frontend (TypeScript)

```
src/
├── types/ipc.ts                            # MODIFY — append UrlParts + QueryParam types
├── tools/
│   ├── escape/
│   │   ├── index.tsx                       # MODIFY — replace placeholder
│   │   ├── store.ts                        # NEW
│   │   ├── api.ts                          # NEW (wraps json_escape / json_unescape)
│   │   ├── SaveDialogHost.tsx              # NEW
│   │   └── __tests__/store.test.ts         # NEW
│   ├── base64/
│   │   ├── index.tsx                       # MODIFY — replace placeholder
│   │   ├── store.ts                        # NEW
│   │   ├── api.ts                          # NEW
│   │   ├── SaveDialogHost.tsx              # NEW
│   │   └── __tests__/store.test.ts         # NEW
│   └── url-parser/
│       ├── index.tsx                       # MODIFY — replace placeholder
│       ├── store.ts                        # NEW
│       ├── api.ts                          # NEW
│       ├── QueryTable.tsx                  # NEW
│       ├── SaveDialogHost.tsx              # NEW
│       └── __tests__/store.test.ts         # NEW
├── App.tsx                                 # MODIFY — handleLoad branches for the three new tools
└── i18n/locales/{zh-CN,en}.json            # MODIFY — add escape.* / base64.* / url_parser.* namespaces
```

---

## Task 1 — Rust codec backend (Base64 + URL)

**Files:** `src-tauri/Cargo.toml`, `src-tauri/src/domain/{base64_codec.rs,url_parts.rs,mod.rs}`, `src-tauri/src/commands/{codec.rs,mod.rs}`, `src-tauri/src/lib.rs`

**What this task delivers:** Branch + four new Tauri commands (`base64_encode`, `base64_decode`, `url_parse`, `url_build`) with full unit-test coverage. The Escape commands already exist from Plan 2 — no Rust changes needed for the Escape tool.

### Required behaviors (acceptance)

- Branch `plan-4-codec-tools` exists, branched from `main`.
- `cargo test --manifest-path src-tauri/Cargo.toml` overall passes (no regressions).
- `cargo test domain::base64_codec` passes ≥6 tests:
  1. `encode_standard` — `"hello"` → `"aGVsbG8="`.
  2. `encode_url_safe` — input that produces `+` and `/` in standard → uses `-` and `_`; pad-stripped or pad-preserved consistent with chosen variant.
  3. `decode_standard` — round-trip `"aGVsbG8="` → `"hello"`.
  4. `decode_url_safe` — round-trip a URL-safe encoded string with `-`/`_`.
  5. `decode_invalid` — non-base64 input → `AppError::Codec(...)`.
  6. `decode_non_utf8` — bytes that decode but aren't valid UTF-8 → `AppError::Codec(...)`.
- `cargo test domain::url_parts` passes ≥6 tests:
  1. `parse_full_url` — `"https://example.com:8080/path?a=1&b=2#frag"` → all fields populated; query has 2 ordered params.
  2. `parse_minimal` — `"https://example.com"` → port None, path "/", query empty, fragment None.
  3. `parse_invalid` — `"not a url"` → `AppError::UrlParse(...)`.
  4. `query_values_are_url_decoded` — `"https://x.com?q=hello%20world"` → params[0].value == `"hello world"`.
  5. `build_round_trip` — parse → build → parse again yields equal `UrlParts`.
  6. `build_with_special_chars_url_encodes` — value containing space + `&` round-trips via build encoding.

### Type surface

```rust
// src-tauri/src/domain/url_parts.rs
use serde::{Deserialize, Serialize};
use crate::error::AppError;

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct UrlParts {
    pub scheme: String,
    pub host: String,
    pub port: Option<u16>,
    pub path: String,         // always starts with "/" when present; may be "/" for empty
    pub query: Vec<QueryParam>,
    pub fragment: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct QueryParam {
    pub key: String,          // URL-decoded
    pub value: String,        // URL-decoded
}

pub fn parse_url(input: &str) -> Result<UrlParts, AppError>;
pub fn build_url(parts: &UrlParts) -> Result<String, AppError>;
```

```rust
// src-tauri/src/domain/base64_codec.rs
use crate::error::AppError;

pub fn encode(input: &str, url_safe: bool) -> String;
pub fn decode(input: &str, url_safe: bool) -> Result<String, AppError>;
// Use base64::engine::general_purpose::{STANDARD, URL_SAFE_NO_PAD or URL_SAFE} consistently.
// Decode trims surrounding whitespace, accepts both padded + unpadded forms in the URL-safe path
// (use the loose-decode variant or fall back across both engines on failure).
```

### Tauri commands

```rust
// src-tauri/src/commands/codec.rs
use crate::domain::base64_codec;
use crate::domain::url_parts::{self, UrlParts};
use crate::error::AppError;

#[tauri::command]
pub fn base64_encode(input: String, url_safe: bool) -> Result<String, AppError> {
    Ok(base64_codec::encode(&input, url_safe))
}

#[tauri::command]
pub fn base64_decode(input: String, url_safe: bool) -> Result<String, AppError> {
    base64_codec::decode(&input, url_safe)
}

#[tauri::command]
pub fn url_parse(input: String) -> Result<UrlParts, AppError> {
    url_parts::parse_url(&input)
}

#[tauri::command]
pub fn url_build(parts: UrlParts) -> Result<String, AppError> {
    url_parts::build_url(&parts)
}
```

These are pure-CPU, fast operations — keep them sync (no spawn_blocking). Register all four in `src-tauri/src/lib.rs` `tauri::generate_handler![...]` after the existing entries.

### Cargo.toml additions

```toml
base64 = "0.22"
url = "2.5"
```

### Procedure

1. `git checkout main && git checkout -b plan-4-codec-tools`. Verify clean tree.
2. Run baseline tests (Rust + frontend) to confirm green.
3. Add deps to `Cargo.toml`. `cargo build` to fetch.
4. Add `pub mod base64_codec;` and `pub mod url_parts;` to `src-tauri/src/domain/mod.rs`. Add `pub mod codec;` to `src-tauri/src/commands/mod.rs`.
5. Create `domain/base64_codec.rs` and TDD-drive 6 tests.
6. Create `domain/url_parts.rs` and TDD-drive 6 tests. Use the `url` crate's `Url` parser; decode query params via `url::form_urlencoded::parse`; rebuild via `url::form_urlencoded::Serializer`.
7. Create `commands/codec.rs` with the four thin adapters.
8. Register in `lib.rs`.
9. `cargo test` + `cargo build` clean. Frontend tests still green.
10. Single commit: `feat(codec): Rust backend (base64 + url commands)`.

---

## Task 2 — Escape tool (frontend)

**Files:** `src/tools/escape/{index.tsx,store.ts,api.ts,SaveDialogHost.tsx,__tests__/store.test.ts}`, `src/i18n/locales/{en,zh-CN}.json`

**What this task delivers:** Replace the Escape placeholder with a working tool. Two textareas (top: input, bottom: output), direction toggle (`Escape ⇄ Unescape`), as-you-type recompute. Output has a Copy button. History save/load + dirty detection.

### Required behaviors (acceptance)

- `npx tsc --noEmit` clean.
- `npx vitest run` passes ≥80 tests (current 78 + ≥2 new for the escape store).
- `npm run build` clean.
- The Escape tab in `npm run tauri dev` is functional (smoke confirmation deferred to Task 4).

### Store contract (`src/tools/escape/store.ts`)

```ts
export type EscapeDirection = "escape" | "unescape";

interface EscapeState {
  input: string;
  output: string;          // last successful transform output ("" before any input)
  error: string | null;    // inline error from the last unescape failure
  direction: EscapeDirection;  // default "escape"
  loadedHistoryId: number | null;
  savedInput: string | null;
  savedDirection: EscapeDirection | null;

  setInput(text: string): void;
  setDirection(d: EscapeDirection): void;
  recompute(): Promise<void>;   // called automatically when input/direction changes
  clear(): void;
  setLoadedHistoryId(id: number | null): void;
  setSaved(input: string | null, direction: EscapeDirection | null): void;
  isDirty(): boolean;
}
```

`recompute` calls `escapeApi.escape(input)` or `escapeApi.unescape(input)` based on direction. On success: `set({ output, error: null })`. On `IpcError` with `code: "codec"`: `set({ error: e.app.message, output: "" })`. On other errors: same fallback as the diff store. **If input is empty, set output empty and error null without calling the API.**

The component wires a `useEffect` on `[input, direction]` to call `recompute()` (debounced 100ms via `lib/debounce` is fine but not required — the API is fast).

### Tests (≥2)

1. `recompute` with `direction: "escape"` and a non-empty input populates output via mocked `escapeApi.escape`.
2. `recompute` with `direction: "unescape"` and a malformed input stores `error` and clears output.

(More cases welcome but two is the minimum.)

### Page layout (`src/tools/escape/index.tsx`)

```tsx
<div className="h-full flex flex-col">
  <div className="px-3 py-2 border-b border-[color:var(--border)] bg-[color:var(--bg-panel)] flex items-center gap-2">
    <select value={direction} onChange={...}>
      <option value="escape">{t("escape.direction_escape")}</option>
      <option value="unescape">{t("escape.direction_unescape")}</option>
    </select>
    <button onClick={clear}>{t("escape.clear")}</button>
    <button className="ml-auto bg-accent text-white" onClick={() => setSaveOpen(true)}>{t("escape.save")}</button>
  </div>
  <div className="flex-1 grid grid-rows-2 min-h-0">
    <div className="border-b border-[color:var(--border)] flex flex-col min-h-0">
      <div className="px-3 py-1 text-xs text-muted">{t("escape.input_label")}</div>
      <textarea value={input} onChange={...setInput} className="flex-1 p-3 font-mono text-sm bg-[color:var(--bg-base)] outline-none resize-none" placeholder={t("escape.input_placeholder")} />
    </div>
    <div className="flex flex-col min-h-0 relative">
      <div className="px-3 py-1 text-xs text-muted flex items-center">
        {t("escape.output_label")}
        <button className="ml-auto" onClick={() => copyToClipboard(output)}>{t("escape.copy")}</button>
      </div>
      {error
        ? <div className="flex-1 p-3 text-sm text-[color:var(--diff-removed)]">{error}</div>
        : <textarea readOnly value={output} className="flex-1 p-3 font-mono text-sm bg-[color:var(--bg-panel)] outline-none resize-none" />
      }
    </div>
  </div>
  <SaveDialogHost open={saveOpen} onClose={() => setSaveOpen(false)} />
</div>
```

### `SaveDialogHost`

Mirrors the JSON Diff host. Save payload: `{ tool: "escape", input, direction }`. On save success: `setLoadedHistoryId(item.id)` + `setSaved(input, direction)`.

### App.tsx routing

In `handleLoad`, add:
```tsx
if (item.content.tool === "escape") {
  useEscapeStore.getState().setInput(item.content.input);
  useEscapeStore.getState().setDirection(item.content.direction);
  useEscapeStore.getState().setLoadedHistoryId(item.id);
  useEscapeStore.getState().setSaved(item.content.input, item.content.direction);
  push("success", t("common.loaded_history_toast", { title: item.title }));
  return;
}
```

(The `useEffect`-driven recompute will fire automatically once input/direction land in the store.)

### i18n keys (BOTH locales)

`escape.{direction_escape, direction_unescape, clear, save, input_label, output_label, input_placeholder, copy, save_default_title}`. Pick natural translations.

---

## Task 3 — Base64 + URL Parser tools (frontend)

**Files:** `src/tools/base64/{index.tsx,store.ts,api.ts,SaveDialogHost.tsx,__tests__/store.test.ts}`, `src/tools/url-parser/{index.tsx,store.ts,api.ts,QueryTable.tsx,SaveDialogHost.tsx,__tests__/store.test.ts}`, `src/types/ipc.ts`, `src/App.tsx`, `src/i18n/locales/{en,zh-CN}.json`

**What this task delivers:** The remaining two codec tools. Two distinct components — Base64 mirrors Escape's two-textarea shape with one extra toggle (`Standard | URL-safe`); URL Parser is a different shape (URL field + parts card + query table with two-way binding).

### Required behaviors (acceptance)

- `npx tsc --noEmit` clean.
- `npx vitest run` passes ≥84 tests (≥2 new for base64, ≥4 new for url-parser).
- `npm run build` clean.

### Type surface (TS — append to `src/types/ipc.ts`)

```ts
export interface QueryParam {
  key: string;
  value: string;
}

export interface UrlParts {
  scheme: string;
  host: string;
  port: number | null;
  path: string;
  query: QueryParam[];
  fragment: string | null;
}
```

### Base64 store (`src/tools/base64/store.ts`)

```ts
export type CodecDirection = "encode" | "decode";

interface Base64State {
  input: string;
  output: string;
  error: string | null;
  direction: CodecDirection;     // default "encode"
  urlSafe: boolean;              // default false
  loadedHistoryId: number | null;
  savedInput, savedDirection, savedUrlSafe...;
  setInput / setDirection / setUrlSafe / clear / setLoadedHistoryId / setSaved / isDirty;
  recompute(): Promise<void>;
}
```

Same recompute pattern as Escape — calls `base64Api.encode` or `base64Api.decode` with `urlSafe`. Empty input → empty output, no API call.

### Base64 page layout

Same shape as Escape but with TWO toggles in the toolbar:
```tsx
<select value={direction}>encode/decode</select>
<label><input type="checkbox" checked={urlSafe} onChange={...}/> {t("base64.url_safe")}</label>
<button>clear</button>
<button>save</button>
```

`SaveDialogHost` payload: `{ tool: "base64", input, direction, url_safe: urlSafe }`. App.tsx handleLoad branch loads all three fields (input, direction, url_safe) and re-saves.

### Base64 tests (≥2)

1. `recompute` encode success with `urlSafe: false`.
2. `recompute` decode failure on invalid base64 → stores error.

### URL Parser store (`src/tools/url-parser/store.ts`)

```ts
interface UrlParserState {
  url: string;                   // the canonical URL field
  parts: UrlParts | null;        // last successful parse
  error: string | null;
  loadedHistoryId: number | null;
  savedUrl: string | null;
  // editing flags so we don't re-parse what we just built (avoid infinite ping-pong)
  source: "url" | "parts";       // who edited last; debounced effect dispatches accordingly
  setUrl(text: string): void;             // marks source "url"
  setParts(parts: UrlParts): void;        // marks source "parts"
  setQueryParam(index: number, patch: Partial<QueryParam>): void;
  addQueryParam(): void;
  removeQueryParam(index: number): void;
  reparse(): Promise<void>;               // calls url_parse(url)
  rebuild(): Promise<void>;               // calls url_build(parts) and writes back to `url`
  clear / setLoadedHistoryId / setSaved / isDirty;
}
```

The component runs **two debounced effects**:
- `[url, source]` watching: if `source === "url"`, call `reparse()`.
- `[parts, source]` watching: if `source === "parts"`, call `rebuild()`.

When `reparse` succeeds it stores `parts` AND clears the `source` to a sentinel so the parts-effect won't immediately rebuild. Same for `rebuild` — it stores the new url and clears `source`.

If you find the source/effect coordination too fragile, use a single `mutating: boolean` flag on the store that's set true during a programmatic write and checked at the start of each debounced effect.

### URL Parser page layout

```tsx
<div className="h-full flex flex-col">
  <div className="px-3 py-2 flex items-center gap-2 border-b">
    <input
      className="flex-1 px-2 py-1 text-sm rounded border font-mono"
      placeholder={t("url_parser.url_placeholder")}
      value={url}
      onChange={(e) => setUrl(e.target.value)}
    />
    <button onClick={clear}>clear</button>
    <button className="ml-auto bg-accent" onClick={openSave}>save</button>
  </div>
  {error && <div className="px-3 py-2 text-xs text-[color:var(--diff-removed)] border-b">{error}</div>}
  <div className="flex-1 overflow-auto p-3 grid gap-3">
    <PartsCard parts={parts} onChange={(patch) => setParts({ ...parts!, ...patch })} />
    <QueryTable
      params={parts?.query ?? []}
      onChange={setQueryParam}
      onAdd={addQueryParam}
      onRemove={removeQueryParam}
    />
  </div>
  <SaveDialogHost ... />
</div>
```

`PartsCard` is a small inline component (define in `index.tsx`, no separate file) showing read-only-ish inputs for scheme/host/port/path/fragment. Edits flow back through `setParts(... updated parts ...)`.

`QueryTable.tsx` is a separate file (it's the most interactive part):
- Header row: Key | Value | Actions
- Per-row: editable inputs for key + value + a "remove" button
- Footer: a single "+ Add row" button

### URL Parser tests (≥4)

1. `setUrl` + `reparse` mock returns `parts` → state populated correctly.
2. `setUrl` + `reparse` mock rejects with parse error → `error` populated, `parts` cleared.
3. `setParts` + `rebuild` mock returns string → `url` populated.
4. `addQueryParam` + `removeQueryParam` mutate `parts.query` immutably (length changes correctly).

### App.tsx routing

For `base64`: load input + direction + url_safe; setSaved with all three.
For `url_parser`: load url; setSaved(url); fire-and-forget `reparse()` to populate parts.

### i18n keys

`base64.{direction_encode, direction_decode, url_safe, clear, save, input_label, output_label, copy, save_default_title}`.
`url_parser.{url_placeholder, parts_card_title, scheme, host, port, path, fragment, query_table_title, key, value, add_row, remove_row, save, save_default_title}`.

---

## Task 4 — Smoke + merge

**What this task delivers:** End-to-end confirmation, then merge `plan-4-codec-tools` into `main`.

### Required behaviors (acceptance — manual smoke via `npm run tauri dev`)

- **Escape tab:**
  - Paste `Hello "world"\n` (with literal escapes user types as `\n`) → toggle Unescape → output shows the actual newline.
  - Paste raw text with quotes/newlines → Escape direction → output is a valid JSON string body.
  - Save → reload from drawer → input + direction restored, output recomputed.
- **Base64 tab:**
  - Paste `hello` → Encode → `aGVsbG8=`. Toggle URL-safe and verify output uses `-`/`_` for inputs that produce `+`/`/` in standard.
  - Paste `aGVsbG8=` → Decode → `hello`. Invalid base64 → inline error message.
  - Save / reload restores all three fields.
- **URL Parser tab:**
  - Paste `https://example.com:8080/api?q=hello%20world&n=1#section` → fields populate (scheme, host, port=8080, path=/api, fragment=section), query table has 2 rows with decoded values.
  - Edit a query value → URL field updates after debounce, with proper URL encoding.
  - Add row, remove row → URL updates accordingly.
  - Invalid URL → inline error, fields stay populated from the last successful parse.
  - Save / reload restores URL + parts.
- **All three tabs respect dark mode** — backgrounds and text remain readable.
- **No regressions in JSON Viewer or JSON Diff** — sanity-check both still work.

### Static checks

- `cargo test` overall passes (49 prior + Plan 3's 18 + Plan 4's ≥12 = ≥79 Rust tests).
- `npx vitest run` overall ≥84 frontend tests passing.
- `npm run build` clean.

### Merge procedure

1. `git status` clean on `plan-4-codec-tools`; all tests + build green.
2. `git checkout main`
3. `git merge --no-ff plan-4-codec-tools -m "Merge plan-4-codec-tools: Escape + Base64 + URL Parser"` with body listing deliverables.
4. `git branch -d plan-4-codec-tools` after the merge commit lands.
5. Confirm with the user that all five tools are shipped — Plan 4 closes the original spec.

---

## Self-Review Notes

**Spec coverage of original `2026-04-30-dev-tool-design.md`:**
- §6.3 Escape: two textareas, direction toggle, as-you-type, output Copy button, inline error. — Task 2. ✓
- §6.4 Base64: same shape + URL-safe sub-toggle. — Task 3. ✓
- §6.5 URL Parser: URL field, parts card, query table, two-way binding, debounced. — Task 3. ✓
- All three tools support history save/load via the existing `HistoryContent` variants (`Escape`, `Base64`, `UrlParser`). — Tasks 2 + 3. ✓
- Errors handled: codec failures show inline; URL parse errors show inline; non-codec errors fall back to a generic message — Tasks 2 + 3. ✓

**Type consistency:** `CodecDirection` and `EscapeDirection` already exist in `src/types/ipc.ts` from Plan 1; the new tools' stores use them directly. `UrlParts` and `QueryParam` are added in Task 3 mirroring the Rust types from Task 1.

**Reuse:** No new shared component is extracted — Escape and Base64 have similar layouts but different toggle sets and i18n; premature abstraction avoided. URL Parser is structurally distinct. The existing `SaveDialog`, `useHistoryStore`, `useToastStore`, `IpcError`, `copyToClipboard` are reused without copying.

**Out of scope (per spec §11):** binary/file input for Base64; auto-fix malformed JSON in Escape; live URL validation hints. None needed for v1.
