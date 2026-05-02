import { beforeEach, describe, expect, it, vi } from "vitest";
import { useJsonViewerStore, ARRAY_COLLAPSE_THRESHOLD } from "../store";
import type { JsonTree } from "../../../types/ipc";

vi.mock("../api", () => ({
  jsonApi: {
    parse: vi.fn(),
    parseNested: vi.fn(),
    format: vi.fn(),
    unescape: vi.fn(),
    escape: vi.fn(),
  },
}));

import { jsonApi } from "../api";
import { IpcError } from "../../../lib/ipc";

const tree: JsonTree = {
  root: {
    id: 0,
    key: { kind: "root" },
    path: "",
    value: { type: "object", key_count: 0, children: [] },
  },
  stats: { total_nodes: 1, max_depth: 0, byte_size: 2 },
  unescape_layers: 0,
};

describe("json viewer store", () => {
  beforeEach(() => {
    useJsonViewerStore.setState(useJsonViewerStore.getInitialState());
    vi.clearAllMocks();
  });

  it("setInput updates input text", () => {
    useJsonViewerStore.getState().setInput("{}");
    expect(useJsonViewerStore.getState().input).toBe("{}");
  });

  it("parse on success stores tree and clears parse error", async () => {
    (jsonApi.parse as ReturnType<typeof vi.fn>).mockResolvedValue(tree);
    await useJsonViewerStore.getState().parse("{}");
    expect(useJsonViewerStore.getState().tree).toEqual(tree);
    expect(useJsonViewerStore.getState().parseError).toBeNull();
  });

  it("parse on Parse error stores diagnostic", async () => {
    (jsonApi.parse as ReturnType<typeof vi.fn>).mockRejectedValue(
      new IpcError({ code: "parse", line: 5, col: 12, message: "bad" }),
    );
    await useJsonViewerStore.getState().parse("{");
    const err = useJsonViewerStore.getState().parseError;
    expect(err).toEqual({ line: 5, col: 12, message: "bad" });
  });

  it("toggleCollapse adds and removes from collapseSet", () => {
    useJsonViewerStore.getState().toggleCollapse(7);
    expect(useJsonViewerStore.getState().collapseSet.has(7)).toBe(true);
    useJsonViewerStore.getState().toggleCollapse(7);
    expect(useJsonViewerStore.getState().collapseSet.has(7)).toBe(false);
  });

  it("setSearch updates query and mode", () => {
    useJsonViewerStore.getState().setSearch("foo", "key");
    expect(useJsonViewerStore.getState().searchQuery).toBe("foo");
    expect(useJsonViewerStore.getState().searchMode).toBe("key");
  });

  it("clear resets the store", () => {
    useJsonViewerStore.setState({ input: "x", tree, parseError: null });
    useJsonViewerStore.getState().clear();
    expect(useJsonViewerStore.getState().input).toBe("");
    expect(useJsonViewerStore.getState().tree).toBeNull();
  });

  it("ARRAY_COLLAPSE_THRESHOLD is 100", () => {
    expect(ARRAY_COLLAPSE_THRESHOLD).toBe(100);
  });
});
