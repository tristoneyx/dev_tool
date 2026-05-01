import { ipc } from "../lib/ipc";
import type { HistoryItem, SaveRequest, ToolKind } from "../types/ipc";

export const historyApi = {
  list: (tool: ToolKind, search?: string) =>
    ipc<HistoryItem[]>("history_list", { tool, search: search ?? null }),
  get: (id: number) => ipc<HistoryItem>("history_get", { id }),
  save: (req: SaveRequest) => ipc<HistoryItem>("history_save", { req }),
  delete: (id: number) => ipc<void>("history_delete", { id }),
};
