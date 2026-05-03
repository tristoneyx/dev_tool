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

// ----- JSON Diff types (mirror src-tauri/src/domain/json_diff.rs) -----

export type DiffKey =
  | { kind: "root" }
  | { kind: "object"; name: string }
  | { kind: "array"; index: number };

export type DiffValue =
  | { type: "null" }
  | { type: "bool"; value: boolean }
  | { type: "number"; raw: string }
  | { type: "string"; value: string }
  | { type: "object"; key_count: number }
  | { type: "array"; item_count: number };

export type DiffStatus =
  | { status: "equal"; value: DiffValue }
  | { status: "added"; right: DiffValue }
  | { status: "removed"; left: DiffValue }
  | { status: "modified"; left: DiffValue; right: DiffValue }
  | { status: "type_changed"; left: DiffValue; right: DiffValue };

// Status fields are flattened onto DiffNode (matches #[serde(flatten)] in Rust).
export type DiffNode = {
  id: number;
  key: DiffKey;
  path: string;
  children: DiffNode[];
  has_difference: boolean;
} & DiffStatus;

export interface DiffStats {
  total_nodes: number;
  differences: number;
}

export interface DiffTree {
  root: DiffNode;
  stats: DiffStats;
}
