import type { MouseEvent as ReactMouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { JsonNode, NodeValue } from "../../types/ipc";
import { previewArray, previewObject } from "./nodePreview";
import type { VisibleNode } from "./flatten";

interface TreeNodeProps {
  visible: VisibleNode;
  /** True if the string value would auto-collapse based on length. */
  stringIsLong: boolean;
  /** True if the string is currently auto-collapsed (long AND not user-expanded). */
  isLongStringCollapsed: boolean;
  onToggleCollapse(id: number): void;
  onForceExpandArray(id: number): void;
  onToggleStringExpand(id: number): void;
  /** Right-click anywhere on the row opens the context menu via this callback. */
  onContextMenu(node: JsonNode, evt: ReactMouseEvent): void;
  searchQuery: string;
}

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

/** Preview head of a long string when auto-collapsed (≤ 1 line). */
const LONG_STRING_PREVIEW_CHARS = 80;

/** Render a primitive (or empty container literal) value with type-specific color. */
function renderTypedValue(
  value: NodeValue,
  searchQuery: string,
  isLongStringCollapsed: boolean,
): React.ReactNode {
  switch (value.type) {
    case "null":
      return (
        <span className="text-[color:var(--json-null)] italic">
          {highlight("null", searchQuery)}
        </span>
      );
    case "bool":
      return (
        <span className="text-[color:var(--json-bool)]">
          {highlight(value.value ? "true" : "false", searchQuery)}
        </span>
      );
    case "number":
      return (
        <span className="text-[color:var(--json-number)]">
          {highlight(value.raw, searchQuery)}
        </span>
      );
    case "string": {
      if (isLongStringCollapsed) {
        const preview = value.value.slice(0, LONG_STRING_PREVIEW_CHARS);
        return (
          <span className="text-[color:var(--json-string)]">
            <span className="text-[color:var(--json-punctuation)]">"</span>
            {highlight(preview, searchQuery)}
            <span className="text-[color:var(--text-muted)]">…</span>
            <span className="text-[color:var(--json-punctuation)]">"</span>
          </span>
        );
      }
      return (
        <span className="text-[color:var(--json-string)]">
          <span className="text-[color:var(--json-punctuation)]">"</span>
          {highlight(value.value, searchQuery)}
          <span className="text-[color:var(--json-punctuation)]">"</span>
        </span>
      );
    }
    case "object":
      return (
        <span className="text-[color:var(--json-punctuation)]">{"{...}"}</span>
      );
    case "array":
      return (
        <span className="text-[color:var(--json-punctuation)]">[...]</span>
      );
  }
}

export function TreeNode({
  visible,
  stringIsLong,
  isLongStringCollapsed,
  onToggleCollapse,
  onForceExpandArray,
  onToggleStringExpand,
  onContextMenu,
  searchQuery,
}: TreeNodeProps) {
  const { t } = useTranslation();
  const { node, depth, isCollapsed, collapseReason, isExpandable } = visible;

  // String values that aren't auto-collapsed flow as block text so they wrap
  // aligned at the indent column. Other values stay on a single line.
  const isWrappingString =
    !isCollapsed &&
    !isLongStringCollapsed &&
    node.value.type === "string" &&
    node.value.value.length > 0;

  const indent = { paddingLeft: `${depth * 16 + 8}px` };

  const renderValueNode = (): React.ReactNode => {
    if (isCollapsed) {
      if (node.value.type === "object") {
        const text =
          previewObject(node.value.children) +
          ` · ` +
          t("json_viewer.type_object_keys", { n: node.value.key_count });
        return (
          <span className="text-[color:var(--text-muted)]">
            {highlight(text, searchQuery)}
          </span>
        );
      }
      if (node.value.type === "array") {
        const text =
          previewArray(node.value.children) +
          ` · ` +
          t("json_viewer.type_array_items", { n: node.value.item_count });
        return (
          <span className="text-[color:var(--text-muted)]">
            {highlight(text, searchQuery)}
          </span>
        );
      }
      return renderTypedValue(node.value, searchQuery, false);
    }
    if (node.value.type === "object" || node.value.type === "array") {
      return (
        <span className="text-[color:var(--json-punctuation)]">
          {node.value.type === "object" ? "{" : "["}
        </span>
      );
    }
    return renderTypedValue(node.value, searchQuery, isLongStringCollapsed);
  };

  const label = keyLabel(node);

  // Expand-all override for auto-collapsed huge arrays.
  const arrayExpandAll =
    collapseReason === "auto_array_threshold" && node.value.type === "array";

  // Inline "collapse" link for an explicitly expanded long string.
  const showCollapseLink =
    !isCollapsed &&
    !isLongStringCollapsed &&
    node.value.type === "string" &&
    stringIsLong;

  if (isWrappingString) {
    // BLOCK layout: text wraps at the row's left content edge so continuation
    // lines align under the chevron column. The chevron column is rendered
    // via padding (no flex shrink games), and the key + value are inline so
    // the wrap context is a single line of text.
    return (
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(node, e);
        }}
        className="text-sm font-mono leading-5 hover:bg-[color:var(--bg-base)] cursor-default break-all whitespace-pre-wrap py-1"
        style={{ paddingLeft: `${depth * 16 + 8 + 16}px` }}
      >
        {label && (
          <span className="text-[color:var(--json-key)]">
            {highlight(label, searchQuery)}
            <span className="text-[color:var(--json-punctuation)]">: </span>
          </span>
        )}
        {renderValueNode()}
        {showCollapseLink && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStringExpand(node.id);
            }}
            className="ml-2 text-xs text-[color:var(--accent)] hover:underline"
          >
            {t("json_viewer.collapse_string")}
          </button>
        )}
      </div>
    );
  }

  // Single-line row layout (default).
  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(node, e);
      }}
      className="flex items-center gap-1 text-sm font-mono leading-7 h-7 hover:bg-[color:var(--bg-base)] cursor-default"
      style={indent}
    >
      {isExpandable ? (
        <button
          type="button"
          onClick={() => onToggleCollapse(node.id)}
          className="w-4 shrink-0 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]"
        >
          {isCollapsed ? "▸" : "▾"}
        </button>
      ) : (
        <span className="w-4 shrink-0" />
      )}

      {label && (
        <span className="shrink-0 text-[color:var(--json-key)]">
          {highlight(label, searchQuery)}
          <span className="text-[color:var(--json-punctuation)]">: </span>
        </span>
      )}

      <span className="truncate min-w-0">{renderValueNode()}</span>

      {isLongStringCollapsed && node.value.type === "string" && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleStringExpand(node.id);
          }}
          className="ml-2 shrink-0 text-xs text-[color:var(--accent)] hover:underline"
        >
          {t("json_viewer.expand_string", { n: node.value.value.length })}
        </button>
      )}

      {arrayExpandAll && node.value.type === "array" && (
        <button
          type="button"
          onClick={() => onForceExpandArray(node.id)}
          className="ml-2 shrink-0 text-xs text-[color:var(--accent)] hover:underline"
        >
          {t("json_viewer.expand_all_n", { n: node.value.item_count })}
        </button>
      )}
    </div>
  );
}
