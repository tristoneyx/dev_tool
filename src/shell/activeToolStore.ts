import { create } from "zustand";
import type { ToolKind } from "../types/ipc";

interface ActiveToolState {
  active: ToolKind;
  setActive(tool: ToolKind): void;
}

export const useActiveToolStore = create<ActiveToolState>((set) => ({
  active: "json_viewer",
  setActive: (tool) => set({ active: tool }),
}));
