import { useTranslation } from "react-i18next";
import type { JsonNode, NodeValue } from "../../types/ipc";
import { previewArray, previewObject } from "./nodePreview";
import type { VisibleNode } from "./flatten";
import { copyToClipboard } from "../../lib/clipboard";
import { useToastStore } from "../../shell/toastStore";

interface TreeNodeProps {
  visible: VisibleNode;
  onToggleCollapse(id: number): void;
  onForceExpandArray(id: number): void;
  /**
   * User clicked the ⤷ JSON badge on a string-as-JSON node. Caller is
   * responsible for any "save current first?" confirmation flow before
   * actually drilling into the new record.
   */
  onDrillIntoNested(stringValue: string): void;
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

/** Render a primitive (or empty container literal) value with type-specific color. */
function renderTypedValue(
  value: NodeValue,
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
    case "string": {
      // Show the full string content. CSS `truncate` on the parent span
      // handles overflow naturally based on viewport width.
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
  onToggleCollapse,
  onForceExpandArray,
  onDrillIntoNested,
  searchQuery,
}: TreeNodeProps) {
  const { t } = useTranslation();
  const push = useToastStore((s) => s.push);
  const { node, depth, isCollapsed, collapseReason, isExpandable } = visible;

  const indent = { paddingLeft: `${depth * 16 + 8}px` };
  // String values wrap to multiple lines so the user sees the whole content
  // in place. Other value types stay on one line.
  const isWrappingString =
    !isCollapsed && node.value.type === "string" && node.value.value.length > 0;

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
      return renderTypedValue(node.value, searchQuery);
    }
    if (node.value.type === "object" || node.value.type === "array") {
      // Show an opening brace/bracket so structure is still visible while expanded.
      return (
        <span className="text-[color:var(--json-punctuation)]">
          {node.value.type === "object" ? "{" : "["}
        </span>
      );
    }
    return renderTypedValue(node.value, searchQuery);
  };

  const label = keyLabel(node);

  return (
    <div
      className={`group flex gap-1 text-sm font-mono hover:bg-[color:var(--bg-base)] cursor-default ${isWrappingString ? "items-start py-1" : "items-center leading-7 h-7"}`}
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

      <span
        className={
          isWrappingString
            ? "min-w-0 flex-1 break-all whitespace-pre-wrap leading-5"
            : "truncate"
        }
      >
        {renderValueNode()}
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
            if (node.value.type === "string") {
              onDrillIntoNested(node.value.value);
            }
          }}
          className="ml-2 shrink-0 text-xs text-[color:var(--accent)] hover:underline"
          title={t("json_viewer.open_nested_as_new")}
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
