import type { JsonNode } from "../../types/ipc";

export type CollapseReason = "manual" | "auto_array_threshold";

export interface VisibleNode {
  node: JsonNode;
  depth: number;
  isCollapsed: boolean;
  collapseReason: CollapseReason | null;
  isExpandable: boolean;
}

export interface FlattenOptions {
  /** Node ids the user has explicitly collapsed. */
  collapseSet: Set<number>;
  /** Node ids the user has explicitly expanded (overrides auto-collapse). */
  forceExpandedSet?: Set<number>;
  /** Arrays with more than this many items are auto-collapsed. */
  arrayCollapseThreshold: number;
  /** Per-node parsed nested-JSON subtree (string nodes whose value is JSON). */
  nestedExpandedById: Map<number, JsonNode>;
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
  const isExpandable = nodeIsExpandable(node, opts);
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
    case "array":
      for (const child of node.value.children) {
        walk(child, depth + 1, opts, out);
      }
      break;
    case "string": {
      const sub = opts.nestedExpandedById.get(node.id);
      if (sub) walk(sub, depth + 1, opts, out);
      break;
    }
    default:
      break;
  }
}

function nodeIsExpandable(node: JsonNode, opts: FlattenOptions): boolean {
  if (node.value.type === "object") return node.value.children.length > 0;
  if (node.value.type === "array") return node.value.children.length > 0;
  if (node.value.type === "string") {
    return opts.nestedExpandedById.has(node.id) || node.value.nested_hint !== null;
  }
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
