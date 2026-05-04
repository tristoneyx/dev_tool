import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBase64Store } from "../store";

vi.mock("../api", () => ({
  base64Api: { encode: vi.fn(), decode: vi.fn() },
}));

import { base64Api } from "../api";
import { IpcError } from "../../../lib/ipc";

describe("base64 store", () => {
  beforeEach(() => {
    useBase64Store.setState(useBase64Store.getInitialState());
    vi.clearAllMocks();
  });

  it("initial state matches contract", () => {
    const s = useBase64Store.getState();
    expect(s.input).toBe("");
    expect(s.output).toBe("");
    expect(s.error).toBeNull();
    expect(s.direction).toBe("encode");
    expect(s.urlSafe).toBe(false);
    expect(s.loadedHistoryId).toBeNull();
    expect(s.savedInput).toBeNull();
    expect(s.savedDirection).toBeNull();
    expect(s.savedUrlSafe).toBeNull();
  });

  it("recompute encode success populates output", async () => {
    (base64Api.encode as ReturnType<typeof vi.fn>).mockResolvedValue(
      "aGVsbG8=",
    );
    useBase64Store.getState().setInput("hello");
    await useBase64Store.getState().recompute();
    expect(useBase64Store.getState().output).toBe("aGVsbG8=");
    expect(useBase64Store.getState().error).toBeNull();
    expect(base64Api.encode).toHaveBeenCalledWith("hello", false);
    expect(base64Api.decode).not.toHaveBeenCalled();
  });

  it("recompute decode uses decode api with urlSafe flag", async () => {
    (base64Api.decode as ReturnType<typeof vi.fn>).mockResolvedValue("hi");
    useBase64Store.getState().setDirection("decode");
    useBase64Store.getState().setUrlSafe(true);
    useBase64Store.getState().setInput("aGk=");
    await useBase64Store.getState().recompute();
    expect(useBase64Store.getState().output).toBe("hi");
    expect(base64Api.decode).toHaveBeenCalledWith("aGk=", true);
    expect(base64Api.encode).not.toHaveBeenCalled();
  });

  it("recompute decode failure on invalid input stores inline error", async () => {
    (base64Api.decode as ReturnType<typeof vi.fn>).mockRejectedValue(
      new IpcError({
        code: "codec",
        message: "base64 decode failed: invalid char",
      }),
    );
    useBase64Store.getState().setDirection("decode");
    useBase64Store.getState().setInput("###");
    await useBase64Store.getState().recompute();
    expect(useBase64Store.getState().output).toBe("");
    expect(useBase64Store.getState().error).toBe(
      "base64 decode failed: invalid char",
    );
  });

  it("recompute on empty input clears output and error without calling api", async () => {
    useBase64Store.setState({ output: "stale", error: "stale" });
    useBase64Store.getState().setInput("");
    await useBase64Store.getState().recompute();
    expect(useBase64Store.getState().output).toBe("");
    expect(useBase64Store.getState().error).toBeNull();
    expect(base64Api.encode).not.toHaveBeenCalled();
    expect(base64Api.decode).not.toHaveBeenCalled();
  });

  it("recompute non-IpcError falls back to message string", async () => {
    (base64Api.encode as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("boom"),
    );
    useBase64Store.getState().setInput("anything");
    await useBase64Store.getState().recompute();
    expect(useBase64Store.getState().output).toBe("");
    expect(useBase64Store.getState().error).toBe("boom");
  });

  it("clear resets to initial state", () => {
    useBase64Store.setState({
      input: "x",
      output: "y",
      error: "boom",
      direction: "decode",
      urlSafe: true,
      loadedHistoryId: 5,
      savedInput: "x",
      savedDirection: "decode",
      savedUrlSafe: true,
    });
    useBase64Store.getState().clear();
    const s = useBase64Store.getState();
    expect(s.input).toBe("");
    expect(s.output).toBe("");
    expect(s.error).toBeNull();
    expect(s.direction).toBe("encode");
    expect(s.urlSafe).toBe(false);
    expect(s.loadedHistoryId).toBeNull();
    expect(s.savedInput).toBeNull();
    expect(s.savedDirection).toBeNull();
    expect(s.savedUrlSafe).toBeNull();
  });

  describe("isDirty", () => {
    it("empty input returns false", () => {
      expect(useBase64Store.getState().isDirty()).toBe(false);
    });

    it("non-empty input with no saved baseline returns true", () => {
      useBase64Store.getState().setInput("abc");
      expect(useBase64Store.getState().isDirty()).toBe(true);
    });

    it("input matches saved with same direction & urlSafe returns false", () => {
      useBase64Store.getState().setInput("abc");
      useBase64Store.getState().setDirection("encode");
      useBase64Store.getState().setUrlSafe(false);
      useBase64Store.getState().setSaved("abc", "encode", false);
      expect(useBase64Store.getState().isDirty()).toBe(false);
    });

    it("urlSafe flag differs from saved returns true", () => {
      useBase64Store.getState().setInput("abc");
      useBase64Store.getState().setDirection("encode");
      useBase64Store.getState().setUrlSafe(true);
      useBase64Store.getState().setSaved("abc", "encode", false);
      expect(useBase64Store.getState().isDirty()).toBe(true);
    });

    it("direction differs from saved returns true", () => {
      useBase64Store.getState().setInput("abc");
      useBase64Store.getState().setDirection("decode");
      useBase64Store.getState().setUrlSafe(false);
      useBase64Store.getState().setSaved("abc", "encode", false);
      expect(useBase64Store.getState().isDirty()).toBe(true);
    });
  });
});
