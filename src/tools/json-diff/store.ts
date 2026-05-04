import { create } from "zustand";
import { diffApi } from "./api";
import { IpcError } from "../../lib/ipc";
import type { DiffTree } from "../../types/ipc";

export interface DiffDiagnostic {
  line: number;
  col: number;
  message: string;
}

interface JsonDiffState {
  left: string;
  right: string;
  tree: DiffTree | null;
  diffError: DiffDiagnostic | null;
  showOnlyDiffs: boolean;
  collapseSet: Set<number>;
  searchQuery: string;
  loadedHistoryId: number | null;
  savedLeft: string | null;
  savedRight: string | null;

  setLeft(text: string): void;
  setRight(text: string): void;
  setShowOnlyDiffs(v: boolean): void;
  setSearchQuery(q: string): void;
  toggleCollapse(nodeId: number): void;
  swap(): void;
  clear(): void;
  compare(): Promise<void>;
  setLoadedHistoryId(id: number | null): void;
  setSaved(left: string | null, right: string | null): void;
  isDirty(): boolean;
}

const initial = {
  left: "",
  right: "",
  tree: null as DiffTree | null,
  diffError: null as DiffDiagnostic | null,
  showOnlyDiffs: true,
  collapseSet: new Set<number>(),
  searchQuery: "",
  loadedHistoryId: null as number | null,
  savedLeft: null as string | null,
  savedRight: null as string | null,
};

export const useJsonDiffStore = create<JsonDiffState>((set, get) => ({
  ...initial,

  setLeft(text) {
    set({ left: text });
  },

  setRight(text) {
    set({ right: text });
  },

  setShowOnlyDiffs(v) {
    set({ showOnlyDiffs: v });
  },

  setSearchQuery(q) {
    set({ searchQuery: q });
  },

  toggleCollapse(nodeId) {
    const next = new Set(get().collapseSet);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    set({ collapseSet: next });
  },

  swap() {
    const { left, right } = get();
    set({ left: right, right: left, tree: null, diffError: null });
  },

  clear() {
    set({ ...initial, collapseSet: new Set() });
  },

  async compare() {
    const { left, right } = get();
    if (left.trim().length === 0 && right.trim().length === 0) {
      return;
    }
    try {
      const tree = await diffApi.diff(left, right);
      set({ tree, diffError: null, collapseSet: new Set() });
    } catch (e) {
      if (e instanceof IpcError && e.app.code === "parse") {
        set({
          tree: null,
          diffError: {
            line: e.app.line,
            col: e.app.col,
            message: e.app.message,
          },
        });
      } else {
        const message = e instanceof Error ? e.message : String(e);
        set({
          tree: null,
          diffError: { line: 0, col: 0, message },
        });
      }
    }
  },

  setLoadedHistoryId(id) {
    set({ loadedHistoryId: id });
  },

  setSaved(left, right) {
    set({ savedLeft: left, savedRight: right });
  },

  isDirty() {
    const { left, right, savedLeft, savedRight } = get();
    const leftDirty =
      left.trim().length > 0 && (savedLeft === null || left !== savedLeft);
    const rightDirty =
      right.trim().length > 0 && (savedRight === null || right !== savedRight);
    return leftDirty || rightDirty;
  },
}));
