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
      className="group flex items-center gap-1 text-sm font-mono leading-7 hover:bg-[color:var(--bg-base)] cursor-default"
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
