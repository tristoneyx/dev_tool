import { create } from "zustand";
import { jsonApi } from "./api";
import { IpcError } from "../../lib/ipc";
import type { JsonNode, JsonTree } from "../../types/ipc";

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
  nestedExpandedById: Map<number, JsonNode>;
  searchQuery: string;
  searchMode: SearchMode;
  loadedHistoryId: number | null;

  setInput(text: string): void;
  parse(text: string): Promise<void>;
  parseNested(nodeId: number, value: string): Promise<void>;
  collapseNested(nodeId: number): void;
  toggleCollapse(nodeId: number): void;
  forceExpandArray(nodeId: number): void;
  setSearch(query: string, mode: SearchMode): void;
  clear(): void;
  setLoadedHistoryId(id: number | null): void;
}

const initial = {
  input: "",
  tree: null as JsonTree | null,
  parseError: null as ParseDiagnostic | null,
  unescapeLayers: 0,
  collapseSet: new Set<number>(),
  forceExpandedSet: new Set<number>(),
  nestedExpandedById: new Map<number, JsonNode>(),
  searchQuery: "",
  searchMode: "both" as SearchMode,
  loadedHistoryId: null as number | null,
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
        nestedExpandedById: new Map(),
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

  async parseNested(nodeId, value) {
    const sub = await jsonApi.parseNested(value);
    const map = new Map(get().nestedExpandedById);
    map.set(nodeId, sub.root);
    set({ nestedExpandedById: map });
  },

  collapseNested(nodeId) {
    const map = new Map(get().nestedExpandedById);
    map.delete(nodeId);
    set({ nestedExpandedById: map });
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

  setSearch(query, mode) {
    set({ searchQuery: query, searchMode: mode });
  },

  clear() {
    set({ ...initial, collapseSet: new Set(), forceExpandedSet: new Set(), nestedExpandedById: new Map() });
  },

  setLoadedHistoryId(id) {
    set({ loadedHistoryId: id });
  },
}));
