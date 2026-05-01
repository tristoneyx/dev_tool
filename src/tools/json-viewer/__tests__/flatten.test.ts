import { describe, expect, it } from "vitest";
import { flatten, type FlattenOptions } from "../flatten";
import type { JsonNode } from "../../../types/ipc";

const tree: JsonNode = {
  id: 0,
  key: { kind: "root" },
  path: "",
  value: {
    type: "object",
    key_count: 2,
    children: [
      {
        id: 1,
        key: { kind: "object", name: "a" },
        path: "a",
        value: { type: "number", raw: "1" },
      },
      {
        id: 2,
        key: { kind: "object", name: "b" },
        path: "b",
        value: {
          type: "array",
          item_count: 3,
          children: [
            {
              id: 3,
              key: { kind: "array", index: 0 },
              path: "b[0]",
              value: { type: "number", raw: "10" },
            },
            {
              id: 4,
              key: { kind: "array", index: 1 },
              path: "b[1]",
              value: { type: "number", raw: "20" },
            },
            {
              id: 5,
              key: { kind: "array", index: 2 },
              path: "b[2]",
              value: { type: "number", raw: "30" },
            },
          ],
        },
      },
    ],
  },
};

const defaultOpts: FlattenOptions = {
  collapseSet: new Set(),
  arrayCollapseThreshold: 100,
  nestedExpandedById: new Map(),
};

describe("flatten", () => {
  it("emits all nodes when nothing is collapsed", () => {
    const list = flatten(tree, defaultOpts);
    expect(list.map((v) => v.node.id)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it("respects depth", () => {
    const list = flatten(tree, defaultOpts);
    expect(list.find((v) => v.node.id === 0)!.depth).toBe(0);
    expect(list.find((v) => v.node.id === 1)!.depth).toBe(1);
    expect(list.find((v) => v.node.id === 3)!.depth).toBe(2);
  });

  it("skips children of collapsed nodes", () => {
    const list = flatten(tree, {
      ...defaultOpts,
      collapseSet: new Set([2]),
    });
    expect(list.map((v) => v.node.id)).toEqual([0, 1, 2]);
  });

  it("auto-collapses arrays larger than threshold", () => {
    const big: JsonNode = {
      id: 100,
      key: { kind: "object", name: "big" },
      path: "big",
      value: {
        type: "array",
        item_count: 5,
        children: Array.from({ length: 5 }, (_, i) => ({
          id: 200 + i,
          key: { kind: "array", index: i },
          path: `big[${i}]`,
          value: { type: "number", raw: String(i) },
        })),
      },
    };
    const wrapper: JsonNode = {
      id: 99,
      key: { kind: "root" },
      path: "",
      value: { type: "object", key_count: 1, children: [big] },
    };
    const list = flatten(wrapper, {
      ...defaultOpts,
      arrayCollapseThreshold: 3,
    });
    // big should be visible as a row, but its children should NOT.
    const ids = list.map((v) => v.node.id);
    expect(ids).toContain(100);
    expect(ids.some((id) => id >= 200)).toBe(false);
    const bigEntry = list.find((v) => v.node.id === 100)!;
    expect(bigEntry.isCollapsed).toBe(true);
    expect(bigEntry.collapseReason).toBe("auto_array_threshold");
  });

  it("manual expansion of an auto-collapsed array overrides the threshold", () => {
    const big: JsonNode = {
      id: 100,
      key: { kind: "object", name: "big" },
      path: "big",
      value: {
        type: "array",
        item_count: 5,
        children: Array.from({ length: 5 }, (_, i) => ({
          id: 200 + i,
          key: { kind: "array", index: i },
          path: `big[${i}]`,
          value: { type: "number", raw: String(i) },
        })),
      },
    };
    const wrapper: JsonNode = {
      id: 99,
      key: { kind: "root" },
      path: "",
      value: { type: "object", key_count: 1, children: [big] },
    };
    const list = flatten(wrapper, {
      ...defaultOpts,
      arrayCollapseThreshold: 3,
      forceExpandedSet: new Set([100]),
    });
    const ids = list.map((v) => v.node.id);
    expect(ids).toContain(200);
    expect(ids).toContain(204);
  });
});
