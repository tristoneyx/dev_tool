import type { JsonNode } from "../../types/ipc";

export type CollapseReason = "manual" | "auto_array_threshold";

export interface VisibleNode {
  node: JsonNode;
  depth: number;
  isCollapsed: boolean;
  collapseReason: CollapseReason | null;
  isExpandable: boolean;
  /**
   * When set, this row is a synthetic closer for an expanded object/array.
   * `node` references the OPENER node (so we can correlate during search).
   */
  closer?: "}" | "]";
}

export interface FlattenOptions {
  /** Node ids the user has explicitly collapsed. */
  collapseSet: Set<number>;
  /** Node ids the user has explicitly expanded (overrides auto-collapse). */
  forceExpandedSet?: Set<number>;
  /** Arrays with more than this many items are auto-collapsed. */
  arrayCollapseThreshold: number;
}

export function flatten(root: JsonNode, opts: FlattenOptions): VisibleNode[] {
  const out: VisibleNode[] = [];
  walk(root, 0, opts, out);
  return out;
}

function walk(
  node: JsonNode,
  depth: number,
  opts: FlattenOptions,
  out: VisibleNode[],
): void {
  const isExpandable = nodeIsExpandable(node);
  const collapsed = computeCollapsed(node, opts);
  out.push({
    node,
    depth,
    isCollapsed: collapsed.collapsed,
    collapseReason: collapsed.reason,
    isExpandable,
  });

  if (collapsed.collapsed) return;

  // Recurse into children based on node type.
  switch (node.value.type) {
    case "object":
    case "array": {
      // Skip closer rows for empty containers — the opener already shows {} or [].
      if (node.value.children.length === 0) break;
      for (const child of node.value.children) {
        walk(child, depth + 1, opts, out);
      }
      // Emit a synthetic closer row at the parent's depth.
      out.push({
        node,
        depth,
        isCollapsed: false,
        collapseReason: null,
        isExpandable: false,
        closer: node.value.type === "object" ? "}" : "]",
      });
      break;
    }
    default:
      break;
  }
}

function nodeIsExpandable(node: JsonNode): boolean {
  if (node.value.type === "object") return node.value.children.length > 0;
  if (node.value.type === "array") return node.value.children.length > 0;
  return false;
}

function computeCollapsed(
  node: JsonNode,
  opts: FlattenOptions,
): { collapsed: boolean; reason: CollapseReason | null } {
  if (opts.collapseSet.has(node.id)) {
    return { collapsed: true, reason: "manual" };
  }
  if (
    node.value.type === "array" &&
    node.value.item_count > opts.arrayCollapseThreshold &&
    !(opts.forceExpandedSet?.has(node.id) ?? false)
  ) {
    return { collapsed: true, reason: "auto_array_threshold" };
  }
  return { collapsed: false, reason: null };
}
