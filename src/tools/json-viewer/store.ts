import { create } from "zustand";
import { jsonApi } from "./api";
import { IpcError } from "../../lib/ipc";
import type { JsonTree } from "../../types/ipc";

export const ARRAY_COLLAPSE_THRESHOLD = 100;

export type SearchMode = "key" | "value" | "both";

export interface ParseDiagnostic {
  line: number;
  col: number;
  message: string;
}

interface JsonViewerState {
  input: string;
  tree: JsonTree | null;
  parseError: ParseDiagnostic | null;
  unescapeLayers: number;
  collapseSet: Set<number>;
  forceExpandedSet: Set<number>;
  /** Per-string-node "show full content" overrides for auto-collapsed long strings. */
  expandedStringSet: Set<number>;
  searchQuery: string;
  searchMode: SearchMode;
  loadedHistoryId: number | null;
  /**
   * The text that was last saved to or loaded from history. Used for
   * dirty detection — `input !== savedInput` means there are unsaved changes.
   * `null` means there is no baseline (a fresh, never-loaded buffer).
   */
  savedInput: string | null;
  /**
   * When set, a "drill into nested string" action is queued and waiting
   * for the user to confirm via the dirty-state dialog.
   */
  pendingDrillInto: string | null;

  setInput(text: string): void;
  parse(text: string): Promise<void>;
  toggleCollapse(nodeId: number): void;
  forceExpandArray(nodeId: number): void;
  /** Toggle "show full content" for an auto-collapsed long string. */
  toggleStringExpand(nodeId: number): void;
  setSearch(query: string, mode: SearchMode): void;
  clear(): void;
  setLoadedHistoryId(id: number | null): void;
  setSavedInput(text: string | null): void;
  setPendingDrillInto(value: string | null): void;
  /**
   * True when the buffer has a non-empty input that diverges from the
   * last saved/loaded snapshot. A brand-new (never-saved) buffer with
   * any non-whitespace content also counts as dirty.
   */
  isDirty(): boolean;
  /**
   * Replace the editor with the given JSON-string content, treat it as
   * a brand-new unsaved record, and parse it. Caller is responsible for
   * confirming the dirty state first (if any).
   */
  drillIntoNested(value: string): Promise<void>;
}

const initial = {
  input: "",
  tree: null as JsonTree | null,
  parseError: null as ParseDiagnostic | null,
  unescapeLayers: 0,
  collapseSet: new Set<number>(),
  forceExpandedSet: new Set<number>(),
  expandedStringSet: new Set<number>(),
  searchQuery: "",
  searchMode: "both" as SearchMode,
  loadedHistoryId: null as number | null,
  savedInput: null as string | null,
  pendingDrillInto: null as string | null,
};

export const useJsonViewerStore = create<JsonViewerState>((set, get) => ({
  ...initial,

  setInput(text) {
    set({ input: text });
  },

  async parse(text) {
    if (text.trim().length === 0) {
      set({ tree: null, parseError: null, unescapeLayers: 0 });
      return;
    }
    try {
      const tree = await jsonApi.parse(text);
      set({
        tree,
        parseError: null,
        unescapeLayers: tree.unescape_layers,
        collapseSet: new Set(),
        forceExpandedSet: new Set(),
        expandedStringSet: new Set(),
      });
    } catch (e) {
      if (e instanceof IpcError && e.app.code === "parse") {
        set({
          parseError: {
            line: e.app.line,
            col: e.app.col,
            message: e.app.message,
          },
        });
      } else {
        // unexpected error type — surface as a parse-style diagnostic at 0,0
        const message = e instanceof Error ? e.message : String(e);
        set({ parseError: { line: 0, col: 0, message } });
      }
    }
  },

  toggleCollapse(nodeId) {
    const next = new Set(get().collapseSet);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    set({ collapseSet: next });
  },

  forceExpandArray(nodeId) {
    const next = new Set(get().forceExpandedSet);
    next.add(nodeId);
    set({ forceExpandedSet: next });
  },

  toggleStringExpand(nodeId) {
    const next = new Set(get().expandedStringSet);
    if (next.has(nodeId)) next.delete(nodeId);
    else next.add(nodeId);
    set({ expandedStringSet: next });
  },

  setSearch(query, mode) {
    set({ searchQuery: query, searchMode: mode });
  },

  clear() {
    set({
      ...initial,
      collapseSet: new Set(),
      forceExpandedSet: new Set(),
      expandedStringSet: new Set(),
    });
  },

  setLoadedHistoryId(id) {
    set({ loadedHistoryId: id });
  },

  setSavedInput(text) {
    set({ savedInput: text });
  },

  setPendingDrillInto(value) {
    set({ pendingDrillInto: value });
  },

  isDirty() {
    const { input, savedInput } = get();
    if (input.trim().length === 0) return false;
    if (savedInput === null) return true;
    return input !== savedInput;
  },

  async drillIntoNested(value) {
    set({
      input: value,
      loadedHistoryId: null,
      savedInput: null,
      pendingDrillInto: null,
      collapseSet: new Set(),
      forceExpandedSet: new Set(),
      expandedStringSet: new Set(),
    });
    await get().parse(value);
  },
}));
