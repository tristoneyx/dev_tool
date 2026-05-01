import { beforeEach, describe, expect, it, vi } from "vitest";
import { useHistoryStore } from "../store";
import type { HistoryItem } from "../../types/ipc";

vi.mock("../api", () => ({
  historyApi: {
    list: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
  },
}));

import { historyApi } from "../api";

const sample: HistoryItem = {
  id: 1,
  tool: "json_viewer",
  title: "t",
  content: { tool: "json_viewer", input: "{}" },
  created_at: 0,
  updated_at: 0,
};

describe("history store", () => {
  beforeEach(() => {
    useHistoryStore.setState({ itemsByTool: {}, loadedIdByTool: {} });
    vi.clearAllMocks();
  });

  it("refresh populates itemsByTool[tool]", async () => {
    (historyApi.list as ReturnType<typeof vi.fn>).mockResolvedValue([sample]);
    await useHistoryStore.getState().refresh("json_viewer");
    expect(useHistoryStore.getState().itemsByTool.json_viewer).toEqual([sample]);
  });

  it("setLoadedId sets and clears per tool", () => {
    useHistoryStore.getState().setLoadedId("json_viewer", 7);
    expect(useHistoryStore.getState().loadedIdByTool.json_viewer).toBe(7);
    useHistoryStore.getState().setLoadedId("json_viewer", null);
    expect(useHistoryStore.getState().loadedIdByTool.json_viewer).toBeNull();
  });

  it("save with mode=new prepends the returned item to the list", async () => {
    useHistoryStore.setState({
      itemsByTool: { json_viewer: [] },
      loadedIdByTool: {},
    });
    (historyApi.save as ReturnType<typeof vi.fn>).mockResolvedValue(sample);
    const item = await useHistoryStore
      .getState()
      .save({ mode: "new", title: "t", content: sample.content });
    expect(item).toEqual(sample);
    expect(useHistoryStore.getState().itemsByTool.json_viewer).toEqual([sample]);
    expect(useHistoryStore.getState().loadedIdByTool.json_viewer).toBe(1);
  });

  it("save with mode=overwrite replaces matching item in the list", async () => {
    useHistoryStore.setState({
      itemsByTool: {
        json_viewer: [
          { ...sample, id: 1, title: "old" },
          { ...sample, id: 2, title: "other" },
        ],
      },
      loadedIdByTool: { json_viewer: 1 },
    });
    const updated = { ...sample, id: 1, title: "renamed", updated_at: 5 };
    (historyApi.save as ReturnType<typeof vi.fn>).mockResolvedValue(updated);
    await useHistoryStore.getState().save({
      mode: "overwrite",
      id: 1,
      title: "renamed",
      content: sample.content,
    });
    const items = useHistoryStore.getState().itemsByTool.json_viewer;
    expect(items?.[0]).toEqual(updated);
    expect(items).toHaveLength(2);
  });

  it("delete removes item and clears loaded id if matched", async () => {
    useHistoryStore.setState({
      itemsByTool: { json_viewer: [sample] },
      loadedIdByTool: { json_viewer: 1 },
    });
    (historyApi.delete as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    await useHistoryStore.getState().remove("json_viewer", 1);
    expect(useHistoryStore.getState().itemsByTool.json_viewer).toEqual([]);
    expect(useHistoryStore.getState().loadedIdByTool.json_viewer).toBeNull();
  });
});
