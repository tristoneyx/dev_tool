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
