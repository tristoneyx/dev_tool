import { describe, expect, it } from "vitest";
import { flattenDiff } from "../flatten";
import type { DiffNode } from "../../../types/ipc";

const root: DiffNode = {
  id: 0,
  key: { kind: "root" },
  path: "",
  status: "equal",
  value: { type: "object", key_count: 2 },
  has_difference: true,
  children: [
    {
      id: 1,
      key: { kind: "object", name: "a" },
      path: "a",
      status: "equal",
      value: { type: "number", raw: "1" },
      has_difference: false,
      children: [],
    },
    {
      id: 2,
      key: { kind: "object", name: "b" },
      path: "b",
      status: "modified",
      left: { type: "number", raw: "1" },
      right: { type: "number", raw: "2" },
      has_difference: true,
      children: [],
    },
  ],
};

describe("flattenDiff", () => {
  it("emits opener, both children, and a closer when nothing is filtered", () => {
    const list = flattenDiff(root, {
      collapseSet: new Set(),
      showOnlyDiffs: false,
      searchQuery: "",
    });
    expect(list).toHaveLength(4);
    expect(list[0].node.id).toBe(0);
    expect(list[0].closer).toBeUndefined();
    expect(list[1].node.id).toBe(1);
    expect(list[2].node.id).toBe(2);
    expect(list[3].node.id).toBe(0);
    expect(list[3].closer).toBe("}");
  });

  it("showOnlyDiffs prunes branches with has_difference === false", () => {
    const list = flattenDiff(root, {
      collapseSet: new Set(),
      showOnlyDiffs: true,
      searchQuery: "",
    });
    expect(list).toHaveLength(3);
    expect(list[0].node.id).toBe(0);
    expect(list[1].node.id).toBe(2);
    expect(list[2].node.id).toBe(0);
    expect(list[2].closer).toBe("}");
  });

  it("collapsing root drops children and closer", () => {
    const list = flattenDiff(root, {
      collapseSet: new Set([0]),
      showOnlyDiffs: false,
      searchQuery: "",
    });
    expect(list).toHaveLength(1);
    expect(list[0].node.id).toBe(0);
    expect(list[0].isCollapsed).toBe(true);
    expect(list[0].closer).toBeUndefined();
  });

  it("searchQuery 'b' keeps root opener, b, and root closer", () => {
    const list = flattenDiff(root, {
      collapseSet: new Set(),
      showOnlyDiffs: false,
      searchQuery: "b",
    });
    expect(list).toHaveLength(3);
    expect(list[0].node.id).toBe(0);
    expect(list[0].closer).toBeUndefined();
    expect(list[1].node.id).toBe(2);
    expect(list[2].node.id).toBe(0);
    expect(list[2].closer).toBe("}");
  });

  it("emits closer for an added-container subtree (uses node.right.type)", () => {
    // A whole-subtree-added scenario: container present only on the right.
    const addedTree: DiffNode = {
      id: 0,
      key: { kind: "root" },
      path: "",
      status: "added",
      right: { type: "object", key_count: 1 },
      has_difference: true,
      children: [
        {
          id: 1,
          key: { kind: "object", name: "x" },
          path: "x",
          status: "added",
          right: { type: "number", raw: "1" },
          has_difference: true,
          children: [],
        },
      ],
    };
    const list = flattenDiff(addedTree, {
      collapseSet: new Set(),
      showOnlyDiffs: false,
      searchQuery: "",
    });
    expect(list).toHaveLength(3);
    expect(list[2].closer).toBe("}");
    expect(list[2].node.id).toBe(0);
  });

  it("emits closer for a removed-array-container subtree (uses node.left.type)", () => {
    const removedTree: DiffNode = {
      id: 0,
      key: { kind: "root" },
      path: "",
      status: "removed",
      left: { type: "array", item_count: 1 },
      has_difference: true,
      children: [
        {
          id: 1,
          key: { kind: "array", index: 0 },
          path: "[0]",
          status: "removed",
          left: { type: "number", raw: "9" },
          has_difference: true,
          children: [],
        },
      ],
    };
    const list = flattenDiff(removedTree, {
      collapseSet: new Set(),
      showOnlyDiffs: false,
      searchQuery: "",
    });
    expect(list).toHaveLength(3);
    expect(list[2].closer).toBe("]");
  });
});
