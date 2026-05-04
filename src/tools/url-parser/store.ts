import { create } from "zustand";
import { urlApi } from "./api";
import { IpcError } from "../../lib/ipc";
import type { UrlParts, QueryParam } from "../../types/ipc";

/**
 * Tracks which side the user most recently edited so the two debounced
 * effects in the page can fire in the matching direction without ever
 * clobbering each other:
 *
 *   - "url"   → user typed in the URL field; reparse it, populate parts.
 *               (Do NOT rebuild — that would round-trip the URL through
 *               the parser/builder and overwrite incomplete user input.)
 *   - "parts" → user edited a parts field or query row; rebuild the URL.
 *               (Do NOT reparse the rebuilt URL — same reason in reverse.)
 *   - null    → no user edit pending; both effects no-op.
 *
 * `reparse()` and `rebuild()` themselves DO NOT touch `source`. Only
 * user-action setters (setUrl, setParts, setQueryParam, addQueryParam,
 * removeQueryParam) set it. Each effect clears it back to null after
 * its API call resolves so the next type-then-pause cycle starts fresh.
 */
export type EditSource = "url" | "parts" | null;

interface UrlParserState {
  url: string;
  parts: UrlParts | null;
  error: string | null;
  loadedHistoryId: number | null;
  savedUrl: string | null;
  source: EditSource;

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
  source: null as EditSource,
};

export const useUrlParserStore = create<UrlParserState>((set, get) => ({
  ...initial,

  setUrl(text) {
    set({ url: text, source: "url" });
  },

  setParts(next) {
    if (get().parts === next) return;
    set({ parts: next, source: "parts" });
  },

  setQueryParam(index, patch) {
    const parts = get().parts;
    if (!parts) return;
    const query = parts.query.map((q, i) =>
      i === index ? { ...q, ...patch } : q,
    );
    set({ parts: { ...parts, query }, source: "parts" });
  },

  addQueryParam() {
    const parts = get().parts;
    if (!parts) return;
    set({
      parts: { ...parts, query: [...parts.query, { key: "", value: "" }] },
      source: "parts",
    });
  },

  removeQueryParam(index) {
    const parts = get().parts;
    if (!parts) return;
    const query = parts.query.filter((_, i) => i !== index);
    set({ parts: { ...parts, query }, source: "parts" });
  },

  async reparse() {
    const { url } = get();
    if (url.trim().length === 0) {
      set({ parts: null, error: null, source: null });
      return;
    }
    try {
      const parts = await urlApi.parse(url);
      set({ parts, error: null, source: null });
    } catch (e) {
      if (e instanceof IpcError && e.app.code === "url_parse") {
        set({ error: e.app.message, source: null });
      } else {
        const message = e instanceof Error ? e.message : String(e);
        set({ error: message, source: null });
      }
    }
  },

  async rebuild() {
    const { parts } = get();
    if (!parts) return;
    try {
      const url = await urlApi.build(parts);
      set({ url, error: null, source: null });
    } catch (e) {
      if (e instanceof IpcError && e.app.code === "url_parse") {
        set({ error: e.app.message, source: null });
      } else {
        const message = e instanceof Error ? e.message : String(e);
        set({ error: message, source: null });
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
