import { create } from "zustand";
import { base64Api } from "./api";
import { IpcError } from "../../lib/ipc";
import type { CodecDirection } from "../../types/ipc";

interface Base64State {
  input: string;
  output: string;
  error: string | null;
  direction: CodecDirection;
  urlSafe: boolean;
  loadedHistoryId: number | null;
  savedInput: string | null;
  savedDirection: CodecDirection | null;
  savedUrlSafe: boolean | null;

  setInput(text: string): void;
  setDirection(d: CodecDirection): void;
  setUrlSafe(v: boolean): void;
  recompute(): Promise<void>;
  clear(): void;
  setLoadedHistoryId(id: number | null): void;
  setSaved(
    input: string | null,
    direction: CodecDirection | null,
    urlSafe: boolean | null,
  ): void;
  isDirty(): boolean;
}

const initial = {
  input: "",
  output: "",
  error: null as string | null,
  direction: "encode" as CodecDirection,
  urlSafe: false,
  loadedHistoryId: null as number | null,
  savedInput: null as string | null,
  savedDirection: null as CodecDirection | null,
  savedUrlSafe: null as boolean | null,
};

export const useBase64Store = create<Base64State>((set, get) => ({
  ...initial,

  setInput(text) {
    set({ input: text });
  },

  setDirection(d) {
    set({ direction: d });
  },

  setUrlSafe(v) {
    set({ urlSafe: v });
  },

  setLoadedHistoryId(id) {
    set({ loadedHistoryId: id });
  },

  setSaved(input, direction, urlSafe) {
    set({
      savedInput: input,
      savedDirection: direction,
      savedUrlSafe: urlSafe,
    });
  },

  clear() {
    set({ ...initial });
  },

  async recompute() {
    const { input, direction, urlSafe } = get();
    if (input.length === 0) {
      set({ output: "", error: null });
      return;
    }
    try {
      const out =
        direction === "encode"
          ? await base64Api.encode(input, urlSafe)
          : await base64Api.decode(input, urlSafe);
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
    const {
      input,
      direction,
      urlSafe,
      savedInput,
      savedDirection,
      savedUrlSafe,
    } = get();
    if (input.length === 0) return false;
    if (savedInput === null) return true;
    return (
      input !== savedInput ||
      direction !== savedDirection ||
      urlSafe !== savedUrlSafe
    );
  },
}));
