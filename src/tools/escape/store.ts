import { create } from "zustand";
import { escapeApi } from "./api";
import { IpcError } from "../../lib/ipc";
import type { EscapeDirection } from "../../types/ipc";

interface EscapeState {
  input: string;
  output: string;
  error: string | null;
  direction: EscapeDirection;
  loadedHistoryId: number | null;
  savedInput: string | null;
  savedDirection: EscapeDirection | null;

  setInput(text: string): void;
  setDirection(d: EscapeDirection): void;
  recompute(): Promise<void>;
  clear(): void;
  setLoadedHistoryId(id: number | null): void;
  setSaved(input: string | null, direction: EscapeDirection | null): void;
  isDirty(): boolean;
}

const initial = {
  input: "",
  output: "",
  error: null as string | null,
  direction: "escape" as EscapeDirection,
  loadedHistoryId: null as number | null,
  savedInput: null as string | null,
  savedDirection: null as EscapeDirection | null,
};

export const useEscapeStore = create<EscapeState>((set, get) => ({
  ...initial,

  setInput(text) {
    set({ input: text });
  },

  setDirection(d) {
    set({ direction: d });
  },

  setLoadedHistoryId(id) {
    set({ loadedHistoryId: id });
  },

  setSaved(input, direction) {
    set({ savedInput: input, savedDirection: direction });
  },

  clear() {
    set({ ...initial });
  },

  async recompute() {
    const { input, direction } = get();
    if (input.length === 0) {
      set({ output: "", error: null });
      return;
    }
    try {
      const out =
        direction === "escape"
          ? await escapeApi.escape(input)
          : await escapeApi.unescape(input);
      set({ output: out, error: null });
    } catch (e) {
      if (e instanceof IpcError && e.app.code === "codec") {
        set({ output: "", error: e.app.message });
      } else {
        const message = e instanceof Error ? e.message : String(e);
        set({ output: "", error: message });
      }
    }
  },

  isDirty() {
    const { input, direction, savedInput, savedDirection } = get();
    if (input.length === 0) return false;
    if (savedInput === null) return true;
    return input !== savedInput || direction !== savedDirection;
  },
}));
