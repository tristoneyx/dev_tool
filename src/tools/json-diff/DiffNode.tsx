import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import type { DiffNode as DiffNodeT, DiffValue } from "../../types/ipc";
import type { VisibleDiffNode } from "./flatten";

const ROW_HEIGHT = 28;
const SUMMARY_STRING_PREVIEW_CHARS = 30;

interface DiffNodeProps {
  visible: VisibleDiffNode;
  onToggleCollapse(id: number): void;
  searchQuery: string;
}

function keyLabel(node: DiffNodeT): string {
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

/**
 * Render a one-line text summary of a DiffValue. Used by added / removed /
 * modified / type_changed rows so the user sees a quick representation of
 * the value without inflating row height.
 */
function summarize(value: DiffValue, t: TFunction): string {
  switch (value.type) {
    case "null":
      return "null";
    case "bool":
      return value.value ? "true" : "false";
    case "number":
      return value.raw;
    case "string": {
      const text = value.value;
      if (text.length <= SUMMARY_STRING_PREVIEW_CHARS) {
        return `"${text}"`;
      }
      return `"${text.slice(0, SUMMARY_STRING_PREVIEW_CHARS)}…"`;
    }
    case "object":
      return t("json_diff.preview_object_keys", { n: value.key_count });
    case "array":
      return t("json_diff.preview_array_items", { n: value.item_count });
  }
}

function rowBgClass(status: DiffNodeT["status"]): string {
  switch (status) {
    case "equal":
      return "";
    case "added":
      return "bg-[color:var(--diff-bg-added)] border-l-2 border-[color:var(--diff-added)]";
    case "removed":
      return "bg-[color:var(--diff-bg-removed)] border-l-2 border-[color:var(--diff-removed)]";
    case "modified":
      return "bg-[color:var(--diff-bg-modified)] border-l-2 border-[color:var(--diff-modified)]";
    case "type_changed":
      return "bg-[color:var(--diff-bg-type-changed)] border-l-2 border-[color:var(--diff-type-changed)]";
  }
}

/** Render a primitive (or empty container literal) value with type-specific color. */
function renderEqualPrimitive(
  value: DiffValue,
  searchQuery: string,
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
    case "string":
      return (
        <span className="text-[color:var(--json-string)]">
          <span className="text-[color:var(--json-punctuation)]">"</span>
          {highlight(value.value, searchQuery)}
          <span className="text-[color:var(--json-punctuation)]">"</span>
        </span>
      );
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

export function DiffNode({
  visible,
  onToggleCollapse,
  searchQuery,
}: DiffNodeProps): JSX.Element {
  const { t } = useTranslation();
  const { node, depth, isCollapsed, isExpandable } = visible;

  const label = keyLabel(node);
  const isRemoved = node.status === "removed";

  const indent = { paddingLeft: `${depth * 16 + 8}px` };

  // Switch on status to render the value column. Each branch can safely
  // access the fields that the discriminated union narrows to.
  const renderValueNode = (): React.ReactNode => {
    switch (node.status) {
      case "equal": {
        const value = node.value;
        if (value.type === "object") {
          if (isCollapsed) {
            return (
              <span className="text-[color:var(--text-muted)]">
                {t("json_diff.preview_object_keys", { n: value.key_count })}
              </span>
            );
          }
          return (
            <span className="text-[color:var(--json-punctuation)]">{"{"}</span>
          );
        }
        if (value.type === "array") {
          if (isCollapsed) {
            return (
              <span className="text-[color:var(--text-muted)]">
                {t("json_diff.preview_array_items", { n: value.item_count })}
              </span>
            );
          }
          return (
            <span className="text-[color:var(--json-punctuation)]">[</span>
          );
        }
        return renderEqualPrimitive(value, searchQuery);
      }
      case "added": {
        return (
          <span className="text-[color:var(--diff-added)]">
            {highlight(summarize(node.right, t), searchQuery)}
          </span>
        );
      }
      case "removed": {
        return (
          <span className="text-[color:var(--diff-removed)] line-through">
            {highlight(summarize(node.left, t), searchQuery)}
          </span>
        );
      }
      case "modified": {
        return (
          <span>
            <span className="text-[color:var(--diff-removed)] line-through">
              {highlight(summarize(node.left, t), searchQuery)}
            </span>
            <span className="text-[color:var(--text-muted)]"> → </span>
            <span className="text-[color:var(--diff-modified)]">
              {highlight(summarize(node.right, t), searchQuery)}
            </span>
          </span>
        );
      }
      case "type_changed": {
        return (
          <span className="text-[color:var(--diff-type-changed)]">
            {highlight(node.left.type, searchQuery)}
            <span className="text-[color:var(--text-muted)]"> → </span>
            {highlight(node.right.type, searchQuery)}
          </span>
        );
      }
    }
  };

  const bg = rowBgClass(node.status);

  return (
    <div
      className={`flex items-center gap-1 text-sm font-mono leading-7 hover:bg-[color:var(--bg-base)] cursor-default ${bg}`}
      style={{ ...indent, height: ROW_HEIGHT }}
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
        <span
          className={`shrink-0 text-[color:var(--json-key)] ${
            isRemoved ? "line-through" : ""
          }`}
        >
          {highlight(label, searchQuery)}
          <span className="text-[color:var(--json-punctuation)]">: </span>
        </span>
      )}

      <span className="truncate min-w-0">{renderValueNode()}</span>
    </div>
  );
}
