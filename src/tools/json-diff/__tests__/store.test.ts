import { beforeEach, describe, expect, it, vi } from "vitest";
import { useJsonDiffStore } from "../store";
import type { DiffTree } from "../../../types/ipc";

vi.mock("../api", () => ({
  diffApi: { diff: vi.fn() },
}));

import { diffApi } from "../api";
import { IpcError } from "../../../lib/ipc";

const sampleTree: DiffTree = {
  root: {
    id: 0,
    key: { kind: "root" },
    path: "",
    children: [],
    has_difference: true,
    status: "modified",
    left: { type: "number", raw: "1" },
    right: { type: "number", raw: "2" },
  },
  stats: { total_nodes: 1, differences: 1 },
};

describe("json diff store", () => {
  beforeEach(() => {
    useJsonDiffStore.setState(useJsonDiffStore.getInitialState());
    vi.clearAllMocks();
  });

  it("initial state matches contract", () => {
    const s = useJsonDiffStore.getState();
    expect(s.left).toBe("");
    expect(s.right).toBe("");
    expect(s.tree).toBeNull();
    expect(s.diffError).toBeNull();
    expect(s.showOnlyDiffs).toBe(true);
    expect(s.collapseSet.size).toBe(0);
    expect(s.searchQuery).toBe("");
    expect(s.loadedHistoryId).toBeNull();
    expect(s.savedLeft).toBeNull();
    expect(s.savedRight).toBeNull();
  });

  it("setLeft and setRight update independently", () => {
    useJsonDiffStore.getState().setLeft("a");
    expect(useJsonDiffStore.getState().left).toBe("a");
    expect(useJsonDiffStore.getState().right).toBe("");
    useJsonDiffStore.getState().setRight("b");
    expect(useJsonDiffStore.getState().left).toBe("a");
    expect(useJsonDiffStore.getState().right).toBe("b");
  });

  it("compare with both sides empty does not call diffApi", async () => {
    useJsonDiffStore.getState().setLeft("   ");
    useJsonDiffStore.getState().setRight("");
    await useJsonDiffStore.getState().compare();
    expect(diffApi.diff).not.toHaveBeenCalled();
    expect(useJsonDiffStore.getState().tree).toBeNull();
    expect(useJsonDiffStore.getState().diffError).toBeNull();
  });

  it("compare success stores tree, clears diffError, resets collapseSet", async () => {
    (diffApi.diff as ReturnType<typeof vi.fn>).mockResolvedValue(sampleTree);
    useJsonDiffStore.getState().setLeft("1");
    useJsonDiffStore.getState().setRight("2");
    useJsonDiffStore.getState().toggleCollapse(99);
    expect(useJsonDiffStore.getState().collapseSet.has(99)).toBe(true);
    await useJsonDiffStore.getState().compare();
    const s = useJsonDiffStore.getState();
    expect(s.tree).toEqual(sampleTree);
    expect(s.diffError).toBeNull();
    expect(s.collapseSet.size).toBe(0);
  });

  it("compare parse error stores diagnostic and nulls tree", async () => {
    (diffApi.diff as ReturnType<typeof vi.fn>).mockRejectedValue(
      new IpcError({ code: "parse", line: 1, col: 5, message: "unexpected token" }),
    );
    useJsonDiffStore.getState().setLeft("{");
    useJsonDiffStore.getState().setRight("{}");
    await useJsonDiffStore.getState().compare();
    const s = useJsonDiffStore.getState();
    expect(s.tree).toBeNull();
    expect(s.diffError).toEqual({ line: 1, col: 5, message: "unexpected token" });
  });

  it("compare non-parse error falls back with line/col 0", async () => {
    (diffApi.diff as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("boom"));
    useJsonDiffStore.getState().setLeft("1");
    useJsonDiffStore.getState().setRight("2");
    await useJsonDiffStore.getState().compare();
    const s = useJsonDiffStore.getState();
    expect(s.tree).toBeNull();
    expect(s.diffError?.line).toBe(0);
    expect(s.diffError?.col).toBe(0);
    expect(s.diffError?.message).toBe("boom");
  });

  it("swap exchanges left/right and clears tree + diffError", () => {
    useJsonDiffStore.setState({
      left: "L",
      right: "R",
      tree: sampleTree,
      diffError: { line: 1, col: 1, message: "x" },
    });
    useJsonDiffStore.getState().swap();
    const s = useJsonDiffStore.getState();
    expect(s.left).toBe("R");
    expect(s.right).toBe("L");
    expect(s.tree).toBeNull();
    expect(s.diffError).toBeNull();
  });

  it("clear resets to initial", () => {
    useJsonDiffStore.setState({
      left: "L",
      right: "R",
      tree: sampleTree,
      diffError: { line: 1, col: 1, message: "x" },
      showOnlyDiffs: false,
      searchQuery: "abc",
      loadedHistoryId: 5,
      savedLeft: "L",
      savedRight: "R",
    });
    useJsonDiffStore.getState().toggleCollapse(7);
    useJsonDiffStore.getState().clear();
    const s = useJsonDiffStore.getState();
    expect(s.left).toBe("");
    expect(s.right).toBe("");
    expect(s.tree).toBeNull();
    expect(s.diffError).toBeNull();
    expect(s.showOnlyDiffs).toBe(true);
    expect(s.collapseSet.size).toBe(0);
    expect(s.searchQuery).toBe("");
    expect(s.loadedHistoryId).toBeNull();
    expect(s.savedLeft).toBeNull();
    expect(s.savedRight).toBeNull();
  });

  it("toggleCollapse adds and removes node ids immutably", () => {
    const before = useJsonDiffStore.getState().collapseSet;
    useJsonDiffStore.getState().toggleCollapse(7);
    const afterAdd = useJsonDiffStore.getState().collapseSet;
    expect(afterAdd.has(7)).toBe(true);
    expect(afterAdd).not.toBe(before);
    useJsonDiffStore.getState().toggleCollapse(7);
    const afterRemove = useJsonDiffStore.getState().collapseSet;
    expect(afterRemove.has(7)).toBe(false);
    expect(afterRemove).not.toBe(afterAdd);
  });

  describe("isDirty", () => {
    it("both sides empty returns false", () => {
      expect(useJsonDiffStore.getState().isDirty()).toBe(false);
    });

    it("left non-empty + savedLeft null returns true", () => {
      useJsonDiffStore.getState().setLeft("{}");
      expect(useJsonDiffStore.getState().isDirty()).toBe(true);
    });

    it("matched saved baselines returns false", () => {
      useJsonDiffStore.getState().setLeft("{}");
      useJsonDiffStore.getState().setRight("[]");
      useJsonDiffStore.getState().setSaved("{}", "[]");
      expect(useJsonDiffStore.getState().isDirty()).toBe(false);
    });

    it("left differs from savedLeft returns true regardless of right", () => {
      useJsonDiffStore.getState().setLeft("{\"a\":1}");
      useJsonDiffStore.getState().setRight("[]");
      useJsonDiffStore.getState().setSaved("{}", "[]");
      expect(useJsonDiffStore.getState().isDirty()).toBe(true);
    });
  });
});
