import { create } from "zustand";
import { urlApi } from "./api";
import { IpcError } from "../../lib/ipc";
import type { UrlParts, QueryParam } from "../../types/ipc";

interface UrlParserState {
  url: string;
  parts: UrlParts | null;
  error: string | null;
  loadedHistoryId: number | null;
  savedUrl: string | null;
  /**
   * True while a programmatic state write is in progress (e.g., reparse() writing parts,
   * or rebuild() writing url). Effects in the page check this flag and skip if set.
   */
  mutating: boolean;

  setUrl(text: string): void;
  setParts(parts: UrlParts): void;
  setQueryParam(index: number, patch: Partial<QueryParam>): void;
  addQueryParam(): void;
  removeQueryParam(index: number): void;
  reparse(): Promise<void>;
  rebuild(): Promise<void>;
  clear(): void;
  setLoadedHistoryId(id: number | null): void;
  setSaved(url: string | null): void;
  isDirty(): boolean;
}

const initial = {
  url: "",
  parts: null as UrlParts | null,
  error: null as string | null,
  loadedHistoryId: null as number | null,
  savedUrl: null as string | null,
  mutating: false,
};

export const useUrlParserStore = create<UrlParserState>((set, get) => ({
  ...initial,

  setUrl(text) {
    set({ url: text });
  },

  setParts(next) {
    if (get().parts === next) return;
    set({ parts: next });
  },

  setQueryParam(index, patch) {
    const parts = get().parts;
    if (!parts) return;
    const query = parts.query.map((q, i) =>
      i === index ? { ...q, ...patch } : q,
    );
    set({ parts: { ...parts, query } });
  },

  addQueryParam() {
    const parts = get().parts;
    if (!parts) return;
    set({
      parts: { ...parts, query: [...parts.query, { key: "", value: "" }] },
    });
  },

  removeQueryParam(index) {
    const parts = get().parts;
    if (!parts) return;
    const query = parts.query.filter((_, i) => i !== index);
    set({ parts: { ...parts, query } });
  },

  async reparse() {
    const { url } = get();
    if (url.trim().length === 0) {
      set({ parts: null, error: null });
      return;
    }
    try {
      const parts = await urlApi.parse(url);
      set({ mutating: true, parts, error: null });
      // microtask to release the lock so the next render sees mutating=false
      queueMicrotask(() => set({ mutating: false }));
    } catch (e) {
      if (e instanceof IpcError && e.app.code === "url_parse") {
        set({ error: e.app.message });
      } else {
        const message = e instanceof Error ? e.message : String(e);
        set({ error: message });
      }
    }
  },

  async rebuild() {
    const { parts } = get();
    if (!parts) return;
    try {
      const url = await urlApi.build(parts);
      set({ mutating: true, url, error: null });
      queueMicrotask(() => set({ mutating: false }));
    } catch (e) {
      if (e instanceof IpcError && e.app.code === "url_parse") {
        set({ error: e.app.message });
      } else {
        const message = e instanceof Error ? e.message : String(e);
        set({ error: message });
      }
    }
  },

  clear() {
    set({ ...initial });
  },

  setLoadedHistoryId(id) {
    set({ loadedHistoryId: id });
  },

  setSaved(url) {
    set({ savedUrl: url });
  },

  isDirty() {
    const { url, savedUrl } = get();
    if (url.trim().length === 0) return false;
    if (savedUrl === null) return true;
    return url !== savedUrl;
  },
}));
