import type { DiffNode, DiffValue } from "../../types/ipc";

export interface DiffFlattenOptions {
  /** Node ids the user has explicitly collapsed. */
  collapseSet: Set<number>;
  /** When true, prune subtrees with `has_difference === false`. */
  showOnlyDiffs: boolean;
  /** Empty disables search. Path-substring match (case-insensitive). */
  searchQuery: string;
}

export interface VisibleDiffNode {
  node: DiffNode;
  depth: number;
  isCollapsed: boolean;
  isExpandable: boolean;
  /** Synthetic closer row for an expanded container. node references the OPENER. */
  closer?: "}" | "]";
}

export function flattenDiff(
  root: DiffNode,
  opts: DiffFlattenOptions,
): VisibleDiffNode[] {
  const out: VisibleDiffNode[] = [];
  walk(root, 0, opts, out);
  if (opts.searchQuery.length === 0) {
    return out;
  }
  return filterByPath(out, opts.searchQuery);
}

function walk(
  node: DiffNode,
  depth: number,
  opts: DiffFlattenOptions,
  out: VisibleDiffNode[],
): void {
  if (opts.showOnlyDiffs && !node.has_difference) {
    return;
  }

  const isExpandable = node.children.length > 0;
  const isCollapsed = opts.collapseSet.has(node.id);

  out.push({
    node,
    depth,
    isCollapsed,
    isExpandable,
  });

  if (isCollapsed) return;
  if (node.children.length === 0) return;

  for (const child of node.children) {
    walk(child, depth + 1, opts, out);
  }

  const closerChar = closerCharFor(node);
  if (closerChar !== null) {
    out.push({
      node,
      depth,
      isCollapsed: false,
      isExpandable: false,
      closer: closerChar,
    });
  }
}

function closerCharFor(node: DiffNode): "}" | "]" | null {
  let value: DiffValue | null = null;
  switch (node.status) {
    case "equal":
      value = node.value;
      break;
    case "added":
      value = node.right;
      break;
    case "removed":
      value = node.left;
      break;
    case "modified":
    case "type_changed":
      return null;
  }
  if (value === null) return null;
  if (value.type === "object") return "}";
  if (value.type === "array") return "]";
  return null;
}

function filterByPath(
  all: VisibleDiffNode[],
  query: string,
): VisibleDiffNode[] {
  const q = query.toLowerCase();
  const matches = new Set<number>();
  for (let i = 0; i < all.length; i++) {
    if (all[i].closer) continue;
    if (all[i].node.path.toLowerCase().includes(q)) {
      matches.add(i);
    }
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
