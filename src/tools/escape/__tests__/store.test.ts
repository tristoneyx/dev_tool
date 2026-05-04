import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEscapeStore } from "../store";

vi.mock("../api", () => ({
  escapeApi: { escape: vi.fn(), unescape: vi.fn() },
}));

import { escapeApi } from "../api";
import { IpcError } from "../../../lib/ipc";

describe("escape store", () => {
  beforeEach(() => {
    useEscapeStore.setState(useEscapeStore.getInitialState());
    vi.clearAllMocks();
  });

  it("initial state matches contract", () => {
    const s = useEscapeStore.getState();
    expect(s.input).toBe("");
    expect(s.output).toBe("");
    expect(s.error).toBeNull();
    expect(s.direction).toBe("escape");
    expect(s.loadedHistoryId).toBeNull();
    expect(s.savedInput).toBeNull();
    expect(s.savedDirection).toBeNull();
  });

  it("recompute success populates output", async () => {
    (escapeApi.escape as ReturnType<typeof vi.fn>).mockResolvedValue("hello\\n");
    useEscapeStore.getState().setInput("hello\n");
    await useEscapeStore.getState().recompute();
    expect(useEscapeStore.getState().output).toBe("hello\\n");
    expect(useEscapeStore.getState().error).toBeNull();
    expect(escapeApi.escape).toHaveBeenCalledWith("hello\n");
    expect(escapeApi.unescape).not.toHaveBeenCalled();
  });

  it("recompute uses unescape api when direction is unescape", async () => {
    (escapeApi.unescape as ReturnType<typeof vi.fn>).mockResolvedValue("hello\n");
    useEscapeStore.getState().setDirection("unescape");
    useEscapeStore.getState().setInput("hello\\n");
    await useEscapeStore.getState().recompute();
    expect(useEscapeStore.getState().output).toBe("hello\n");
    expect(escapeApi.unescape).toHaveBeenCalledWith("hello\\n");
    expect(escapeApi.escape).not.toHaveBeenCalled();
  });

  it("recompute on empty input clears output and error without calling api", async () => {
    useEscapeStore.setState({ output: "stale", error: "stale" });
    useEscapeStore.getState().setInput("");
    await useEscapeStore.getState().recompute();
    expect(useEscapeStore.getState().output).toBe("");
    expect(useEscapeStore.getState().error).toBeNull();
    expect(escapeApi.escape).not.toHaveBeenCalled();
    expect(escapeApi.unescape).not.toHaveBeenCalled();
  });

  it("recompute codec error stores inline error and clears output", async () => {
    (escapeApi.unescape as ReturnType<typeof vi.fn>).mockRejectedValue(
      new IpcError({ code: "codec", message: "unescape failed: syntax" }),
    );
    useEscapeStore.getState().setDirection("unescape");
    useEscapeStore.getState().setInput("\\xZZ");
    await useEscapeStore.getState().recompute();
    expect(useEscapeStore.getState().output).toBe("");
    expect(useEscapeStore.getState().error).toBe("unescape failed: syntax");
  });

  it("recompute non-IpcError falls back to message string", async () => {
    (escapeApi.escape as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("boom"),
    );
    useEscapeStore.getState().setInput("anything");
    await useEscapeStore.getState().recompute();
    expect(useEscapeStore.getState().output).toBe("");
    expect(useEscapeStore.getState().error).toBe("boom");
  });

  it("clear resets to initial state", () => {
    useEscapeStore.setState({
      input: "x",
      output: "y",
      error: "boom",
      direction: "unescape",
      loadedHistoryId: 5,
      savedInput: "x",
      savedDirection: "unescape",
    });
    useEscapeStore.getState().clear();
    const s = useEscapeStore.getState();
    expect(s.input).toBe("");
    expect(s.output).toBe("");
    expect(s.error).toBeNull();
    expect(s.direction).toBe("escape");
    expect(s.loadedHistoryId).toBeNull();
    expect(s.savedInput).toBeNull();
    expect(s.savedDirection).toBeNull();
  });

  describe("isDirty", () => {
    it("empty input returns false", () => {
      expect(useEscapeStore.getState().isDirty()).toBe(false);
    });

    it("non-empty input with no saved baseline returns true", () => {
      useEscapeStore.getState().setInput("abc");
      expect(useEscapeStore.getState().isDirty()).toBe(true);
    });

    it("input matching savedInput with same direction returns false", () => {
      useEscapeStore.getState().setInput("abc");
      useEscapeStore.getState().setDirection("escape");
      useEscapeStore.getState().setSaved("abc", "escape");
      expect(useEscapeStore.getState().isDirty()).toBe(false);
    });

    it("input matches saved but direction differs returns true", () => {
      useEscapeStore.getState().setInput("abc");
      useEscapeStore.getState().setDirection("unescape");
      useEscapeStore.getState().setSaved("abc", "escape");
      expect(useEscapeStore.getState().isDirty()).toBe(true);
    });

    it("input differs from savedInput returns true", () => {
      useEscapeStore.getState().setInput("xyz");
      useEscapeStore.getState().setDirection("escape");
      useEscapeStore.getState().setSaved("abc", "escape");
      expect(useEscapeStore.getState().isDirty()).toBe(true);
    });
  });
});
