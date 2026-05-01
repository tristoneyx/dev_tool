import { create } from "zustand";
import { historyApi } from "./api";
import type { HistoryItem, SaveRequest, ToolKind } from "../types/ipc";

interface HistoryState {
  itemsByTool: Partial<Record<ToolKind, HistoryItem[]>>;
  loadedIdByTool: Partial<Record<ToolKind, number | null>>;
  refresh(tool: ToolKind, search?: string): Promise<void>;
  setLoadedId(tool: ToolKind, id: number | null): void;
  save(req: SaveRequest): Promise<HistoryItem>;
  remove(tool: ToolKind, id: number): Promise<void>;
}

export const useHistoryStore = create<HistoryState>((set) => ({
  itemsByTool: {},
  loadedIdByTool: {},

  async refresh(tool, search) {
    const items = await historyApi.list(tool, search);
    set((s) => ({ itemsByTool: { ...s.itemsByTool, [tool]: items } }));
  },

  setLoadedId(tool, id) {
    set((s) => ({ loadedIdByTool: { ...s.loadedIdByTool, [tool]: id } }));
  },

  async save(req) {
    const saved = await historyApi.save(req);
    const tool = saved.tool;
    set((s) => {
      const current = s.itemsByTool[tool] ?? [];
      const next =
        req.mode === "new"
          ? [saved, ...current]
          : current.map((it) => (it.id === saved.id ? saved : it));
      return {
        itemsByTool: { ...s.itemsByTool, [tool]: next },
        loadedIdByTool: { ...s.loadedIdByTool, [tool]: saved.id },
      };
    });
    return saved;
  },

  async remove(tool, id) {
    await historyApi.delete(id);
    set((s) => {
      const next = (s.itemsByTool[tool] ?? []).filter((it) => it.id !== id);
      const loaded =
        s.loadedIdByTool[tool] === id ? null : s.loadedIdByTool[tool] ?? null;
      return {
        itemsByTool: { ...s.itemsByTool, [tool]: next },
        loadedIdByTool: { ...s.loadedIdByTool, [tool]: loaded },
      };
    });
  },
}));
