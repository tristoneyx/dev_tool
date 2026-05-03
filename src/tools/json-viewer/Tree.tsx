import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { VariableSizeList, type ListChildComponentProps } from "react-window";
import { useJsonViewerStore, ARRAY_COLLAPSE_THRESHOLD } from "./store";
import { flatten, type VisibleNode } from "./flatten";
import { TreeNode } from "./TreeNode";

interface TreeProps {
  /**
   * Called when user clicks the ⤷ JSON badge on a string-as-JSON node.
   * Parent decides whether to prompt for save before drilling.
   */
  onRequestDrill(stringValue: string): void;
}

const ROW_HEIGHT = 28;
/** Approximate width of one monospace character at the row's font-size. */
const APPROX_CHAR_PX = 7.2;
/** Pixels per wrapped line of string content. */
const STRING_LINE_HEIGHT = 20;
/** Vertical padding (top + bottom) reserved on a wrapped string row. */
const STRING_ROW_PADDING_PX = 10;
/** Hard cap so a single huge string doesn't push the row past one screen. */
const MAX_STRING_ROW_HEIGHT_PX = 600;

/**
 * Estimate how tall a row needs to be. String values wrap to as many lines
 * as needed (capped) so the user sees the full content in place; everything
 * else uses the fixed ROW_HEIGHT.
 */
function estimateRowHeight(v: VisibleNode, widthPx: number): number {
  if (v.closer) return ROW_HEIGHT;
  if (v.isCollapsed) return ROW_HEIGHT;
  if (v.node.value.type !== "string") return ROW_HEIGHT;
  const text = v.node.value.value;
  if (text.length === 0) return ROW_HEIGHT;

  // Reserve horizontal space for indent (depth*16+8), chevron column (~16),
  // key label, and the right-side "JSON … keys" badge / copy buttons.
  const keyName =
    v.node.key.kind === "object"
      ? v.node.key.name
      : v.node.key.kind === "array"
        ? String(v.node.key.index)
        : "";
  const keyPx = (keyName.length + 4) * APPROX_CHAR_PX; // "key": ≈ keyName + 4
  const reservedPx =
    v.depth * 16 + 8 + // indent
    16 + // chevron column
    keyPx +
    180; // badge + buttons + scrollbar safety

  const availPx = Math.max(80, widthPx - reservedPx);
  const charsPerLine = Math.max(20, Math.floor(availPx / APPROX_CHAR_PX));
  // +2 for the surrounding quotes we always render around the string value.
  const lines = Math.max(1, Math.ceil((text.length + 2) / charsPerLine));
  if (lines === 1) return ROW_HEIGHT;
  return Math.min(
    lines * STRING_LINE_HEIGHT + STRING_ROW_PADDING_PX,
    MAX_STRING_ROW_HEIGHT_PX,
  );
}

/** Measure the bounding box of a parent so react-window gets explicit dims. */
function useElementSize(): [
  React.RefObject<HTMLDivElement>,
  { width: number; height: number },
] {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

export function Tree({ onRequestDrill }: TreeProps) {
  const { t } = useTranslation();
  const tree = useJsonViewerStore((s) => s.tree);
  const collapseSet = useJsonViewerStore((s) => s.collapseSet);
  const forceExpandedSet = useJsonViewerStore((s) => s.forceExpandedSet);
  const searchQuery = useJsonViewerStore((s) => s.searchQuery);
  const searchMode = useJsonViewerStore((s) => s.searchMode);

  const toggleCollapse = useJsonViewerStore((s) => s.toggleCollapse);
  const forceExpand = useJsonViewerStore((s) => s.forceExpandArray);

  const listRef = useRef<VariableSizeList | null>(null);
  const [hostRef, size] = useElementSize();

  const visible: VisibleNode[] = useMemo(() => {
    if (!tree) return [];
    const all = flatten(tree.root, {
      collapseSet,
      forceExpandedSet,
      arrayCollapseThreshold: ARRAY_COLLAPSE_THRESHOLD,
    });
    if (!searchQuery) return all;
    return filterBySearch(all, searchQuery, searchMode);
  }, [
    tree,
    collapseSet,
    forceExpandedSet,
    searchQuery,
    searchMode,
  ]);

  const itemSize = useCallback(
    (index: number) => estimateRowHeight(visible[index], size.width),
    [visible, size.width],
  );

  // Reset cached heights whenever the visible set or container width changes —
  // both can change estimateRowHeight's output.
  useEffect(() => {
    listRef.current?.resetAfterIndex(0);
  }, [visible, size.width]);

  const renderRow = ({ index, style }: ListChildComponentProps) => {
    const v = visible[index];
    if (v.closer) {
      // Synthetic closer row: just the matching brace, indented under the
      // opener's key column (chevron column + key column = depth*16 + 8 + 16).
      return (
        <div style={style}>
          <div
            className="text-sm font-mono leading-7 text-[color:var(--json-punctuation)] cursor-default"
            style={{ height: ROW_HEIGHT, paddingLeft: `${v.depth * 16 + 8 + 16}px` }}
          >
            {v.closer}
          </div>
        </div>
      );
    }
    return (
      <div style={style}>
        <TreeNode
          visible={v}
          onToggleCollapse={(id) => {
            toggleCollapse(id);
            listRef.current?.resetAfterIndex(0);
          }}
          onForceExpandArray={(id) => {
            forceExpand(id);
            listRef.current?.resetAfterIndex(0);
          }}
          onDrillIntoNested={onRequestDrill}
          searchQuery={searchQuery}
        />
      </div>
    );
  };

  return (
    <div ref={hostRef} className="h-full w-full overflow-hidden relative">
      {!tree && (
        <div className="absolute inset-0 flex items-center justify-center text-[color:var(--text-muted)] text-sm pointer-events-none">
          {t("json_viewer.tree_empty")}
        </div>
      )}
      {tree && size.width > 0 && size.height > 0 && (
        <VariableSizeList
          ref={listRef}
          height={size.height}
          width={size.width}
          itemCount={visible.length}
          itemSize={itemSize}
          overscanCount={20}
        >
          {renderRow}
        </VariableSizeList>
      )}
    </div>
  );
}

function filterBySearch(
  all: VisibleNode[],
  query: string,
  mode: "key" | "value" | "both",
): VisibleNode[] {
  const q = query.toLowerCase();
  // First, find the indices of nodes that match. Skip closer rows — they
  // share their opener's `node`, so checking them would double-count.
  const matches = new Set<number>();
  for (let i = 0; i < all.length; i++) {
    if (all[i].closer) continue;
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
      if (all[j].depth < depth && !all[j].closer) {
        include.add(j);
        depth = all[j].depth;
      }
    }
  }
  // Re-include closers whose opener (same node.id) ended up in the include set.
  const includedNodeIds = new Set<number>();
  for (const idx of include) includedNodeIds.add(all[idx].node.id);
  for (let i = 0; i < all.length; i++) {
    if (all[i].closer && includedNodeIds.has(all[i].node.id)) {
      include.add(i);
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
