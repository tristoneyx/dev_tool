import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { VariableSizeList, type ListChildComponentProps } from "react-window";
import { useJsonViewerStore, ARRAY_COLLAPSE_THRESHOLD } from "./store";
import { flatten, type VisibleNode } from "./flatten";
import { TreeNode } from "./TreeNode";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { copyToClipboard } from "../../lib/clipboard";
import { useToastStore } from "../../shell/toastStore";
import type { JsonNode } from "../../types/ipc";

interface TreeProps {
  /**
   * Called when user picks "Open nested JSON as new record" in the row's
   * context menu. Parent decides whether to prompt for save before drilling.
   */
  onRequestDrill(stringValue: string): void;
}

const ROW_HEIGHT = 28;
/**
 * Conservative width estimate for one monospace character at text-sm in
 * Menlo/Monaco. Browsers actually render glyphs at ~8.4px so we round up
 * with a safety margin to avoid ever underestimating wrap height.
 */
const APPROX_CHAR_PX = 9;
/** Pixel height of one wrapped line for an expanded string. */
const STRING_LINE_HEIGHT = 20;
/** Vertical padding (top + bottom) on a wrapped string row. */
const STRING_ROW_PADDING_PX = 10;
/**
 * If a string would wrap into more than this many lines we auto-collapse
 * to a single-line preview with a manual "[展开]" toggle.
 */
const STRING_AUTO_COLLAPSE_LINES = 30;
/** Hard cap on row height even when the user has manually expanded. */
const MAX_STRING_ROW_HEIGHT_PX = 1200;
/** Extra buffer line added to every estimate as an overflow safety net. */
const HEIGHT_SAFETY_LINES = 1;

interface StringDisplay {
  isLong: boolean;
  isCollapsed: boolean;
  /** Estimated height in pixels when this string is expanded. */
  expandedHeightPx: number;
}

function stringDisplayFor(
  v: VisibleNode,
  widthPx: number,
  expandedStringSet: Set<number>,
): StringDisplay | null {
  if (v.closer || v.isCollapsed) return null;
  if (v.node.value.type !== "string") return null;
  const text = v.node.value.value;
  if (text.length === 0) {
    return { isLong: false, isCollapsed: false, expandedHeightPx: ROW_HEIGHT };
  }
  // Indent + chevron column form the wrap padding for block layout. Add a
  // generous right-side reserve for scrollbar / cell padding so we never
  // overestimate available width.
  const padPx = v.depth * 16 + 8 + 16;
  const availPx = Math.max(80, widthPx - padPx - 32);
  const charsPerLine = Math.max(20, Math.floor(availPx / APPROX_CHAR_PX));
  // +2 for the surrounding quotes always rendered around string values.
  const rawLines = Math.max(1, Math.ceil((text.length + 2) / charsPerLine));
  // Extra safety line so the slot is always >= rendered DOM height.
  const lines = rawLines + HEIGHT_SAFETY_LINES;
  const isLong = rawLines > STRING_AUTO_COLLAPSE_LINES;
  const isCollapsed = isLong && !expandedStringSet.has(v.node.id);
  const expandedHeightPx = Math.min(
    lines * STRING_LINE_HEIGHT + STRING_ROW_PADDING_PX,
    MAX_STRING_ROW_HEIGHT_PX,
  );
  return { isLong, isCollapsed, expandedHeightPx };
}

/**
 * Estimate how tall a row needs to be. Strings that aren't auto-collapsed
 * wrap to as many lines as needed; everything else uses ROW_HEIGHT.
 */
function estimateRowHeight(display: StringDisplay | null): number {
  if (!display) return ROW_HEIGHT;
  if (display.isCollapsed) return ROW_HEIGHT;
  if (!display.isLong && display.expandedHeightPx <= ROW_HEIGHT) {
    return display.expandedHeightPx;
  }
  // Short multi-line strings still get their wrap height; long expanded
  // strings get the capped expandedHeightPx.
  return display.expandedHeightPx > ROW_HEIGHT
    ? display.expandedHeightPx
    : ROW_HEIGHT;
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

interface MenuState {
  x: number;
  y: number;
  node: JsonNode;
}

export function Tree({ onRequestDrill }: TreeProps) {
  const { t } = useTranslation();
  const tree = useJsonViewerStore((s) => s.tree);
  const collapseSet = useJsonViewerStore((s) => s.collapseSet);
  const forceExpandedSet = useJsonViewerStore((s) => s.forceExpandedSet);
  const expandedStringSet = useJsonViewerStore((s) => s.expandedStringSet);
  const searchQuery = useJsonViewerStore((s) => s.searchQuery);
  const searchMode = useJsonViewerStore((s) => s.searchMode);

  const toggleCollapse = useJsonViewerStore((s) => s.toggleCollapse);
  const forceExpand = useJsonViewerStore((s) => s.forceExpandArray);
  const toggleStringExpand = useJsonViewerStore((s) => s.toggleStringExpand);

  const push = useToastStore((s) => s.push);

  const listRef = useRef<VariableSizeList | null>(null);
  const [hostRef, size] = useElementSize();
  const [menu, setMenu] = useState<MenuState | null>(null);

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

  // Pre-compute string-display state per visible row so renderRow + itemSize
  // both see the same answer.
  const stringDisplays = useMemo(
    () => visible.map((v) => stringDisplayFor(v, size.width, expandedStringSet)),
    [visible, size.width, expandedStringSet],
  );

  const itemSize = useCallback(
    (index: number) => estimateRowHeight(stringDisplays[index]),
    [stringDisplays],
  );

  // Reset cached heights whenever inputs to estimateRowHeight change.
  useEffect(() => {
    listRef.current?.resetAfterIndex(0);
  }, [visible, size.width, expandedStringSet]);

  const openMenu = useCallback(
    (node: JsonNode, evt: ReactMouseEvent) => {
      setMenu({ x: evt.clientX, y: evt.clientY, node });
    },
    [],
  );

  const renderRow = ({ index, style }: ListChildComponentProps) => {
    const v = visible[index];
    if (v.closer) {
      return (
        <div style={{ ...style, overflow: "hidden" }}>
          <div
            className="text-sm font-mono leading-7 text-[color:var(--json-punctuation)] cursor-default"
            style={{ height: ROW_HEIGHT, paddingLeft: `${v.depth * 16 + 8 + 16}px` }}
          >
            {v.closer}
          </div>
        </div>
      );
    }
    const display = stringDisplays[index];
    return (
      <div style={{ ...style, overflow: "hidden" }}>
        <TreeNode
          visible={v}
          stringIsLong={display?.isLong ?? false}
          isLongStringCollapsed={display?.isCollapsed ?? false}
          onToggleCollapse={(id) => {
            toggleCollapse(id);
            listRef.current?.resetAfterIndex(0);
          }}
          onForceExpandArray={(id) => {
            forceExpand(id);
            listRef.current?.resetAfterIndex(0);
          }}
          onToggleStringExpand={(id) => {
            toggleStringExpand(id);
            listRef.current?.resetAfterIndex(0);
          }}
          onContextMenu={openMenu}
          searchQuery={searchQuery}
        />
      </div>
    );
  };

  const menuItems: ContextMenuItem[] = useMemo(() => {
    if (!menu) return [];
    const node = menu.node;
    const items: ContextMenuItem[] = [];
    if (node.value.type === "string" && node.value.nested_hint) {
      items.push({
        label: t("json_viewer.open_nested_as_new"),
        emphasis: true,
        onClick: () => {
          if (node.value.type === "string") {
            onRequestDrill(node.value.value);
          }
        },
      });
    }
    items.push({
      label: t("json_viewer.copy_value"),
      onClick: async () => {
        await copyToClipboard(serializeForCopy(node));
        push("success", t("json_viewer.copied_toast"));
      },
    });
    items.push({
      label: t("json_viewer.copy_path"),
      onClick: async () => {
        await copyToClipboard(node.path);
        push("success", t("json_viewer.copied_toast"));
      },
    });
    return items;
  }, [menu, t, onRequestDrill, push]);

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
      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
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
