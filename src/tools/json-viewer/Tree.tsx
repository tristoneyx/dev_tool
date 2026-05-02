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
