import { beforeEach, describe, expect, it, vi } from "vitest";
import { useUrlParserStore } from "../store";

vi.mock("../api", () => ({
  urlApi: { parse: vi.fn(), build: vi.fn() },
}));

import { urlApi } from "../api";
import { IpcError } from "../../../lib/ipc";
import type { UrlParts } from "../../../types/ipc";

const makeParts = (over: Partial<UrlParts> = {}): UrlParts => ({
  scheme: "https",
  host: "example.com",
  port: null,
  path: "/",
  query: [],
  fragment: null,
  ...over,
});

describe("url-parser store", () => {
  beforeEach(() => {
    useUrlParserStore.setState(useUrlParserStore.getInitialState());
    vi.clearAllMocks();
  });

  it("initial state matches contract", () => {
    const s = useUrlParserStore.getState();
    expect(s.url).toBe("");
    expect(s.parts).toBeNull();
    expect(s.error).toBeNull();
    expect(s.loadedHistoryId).toBeNull();
    expect(s.savedUrl).toBeNull();
    expect(s.source).toBeNull();
  });

  it("setUrl + reparse populates parts on success", async () => {
    const parts = makeParts({
      host: "ex.com",
      path: "/p",
      query: [{ key: "q", value: "1" }],
    });
    (urlApi.parse as ReturnType<typeof vi.fn>).mockResolvedValue(parts);
    useUrlParserStore.getState().setUrl("https://ex.com/p?q=1");
    await useUrlParserStore.getState().reparse();
    expect(useUrlParserStore.getState().parts).toEqual(parts);
    expect(useUrlParserStore.getState().error).toBeNull();
    expect(urlApi.parse).toHaveBeenCalledWith("https://ex.com/p?q=1");
  });

  it("setUrl + reparse stores error on url_parse IpcError", async () => {
    (urlApi.parse as ReturnType<typeof vi.fn>).mockRejectedValue(
      new IpcError({ code: "url_parse", message: "invalid url" }),
    );
    useUrlParserStore.getState().setUrl("not-a-url");
    await useUrlParserStore.getState().reparse();
    expect(useUrlParserStore.getState().error).toBe("invalid url");
    expect(useUrlParserStore.getState().parts).toBeNull();
  });

  it("reparse on empty url clears parts and error without calling api", async () => {
    useUrlParserStore.setState({
      parts: makeParts(),
      error: "stale",
    });
    useUrlParserStore.getState().setUrl("   ");
    await useUrlParserStore.getState().reparse();
    expect(useUrlParserStore.getState().parts).toBeNull();
    expect(useUrlParserStore.getState().error).toBeNull();
    expect(urlApi.parse).not.toHaveBeenCalled();
  });

  it("setParts + rebuild populates url on success", async () => {
    (urlApi.build as ReturnType<typeof vi.fn>).mockResolvedValue(
      "https://ex.com/p",
    );
    const parts = makeParts({ host: "ex.com", path: "/p" });
    useUrlParserStore.getState().setParts(parts);
    await useUrlParserStore.getState().rebuild();
    expect(useUrlParserStore.getState().url).toBe("https://ex.com/p");
    expect(urlApi.build).toHaveBeenCalledWith(parts);
  });

  it("rebuild with null parts is a noop", async () => {
    await useUrlParserStore.getState().rebuild();
    expect(urlApi.build).not.toHaveBeenCalled();
  });

  it("addQueryParam then removeQueryParam mutates query immutably", () => {
    const parts = makeParts({ query: [{ key: "a", value: "1" }] });
    useUrlParserStore.getState().setParts(parts);
    useUrlParserStore.getState().addQueryParam();
    expect(useUrlParserStore.getState().parts?.query.length).toBe(2);
    expect(useUrlParserStore.getState().parts?.query[1]).toEqual({
      key: "",
      value: "",
    });
    useUrlParserStore.getState().removeQueryParam(0);
    expect(useUrlParserStore.getState().parts?.query.length).toBe(1);
    expect(useUrlParserStore.getState().parts?.query[0]).toEqual({
      key: "",
      value: "",
    });
    // Original parts object must not have been mutated.
    expect(parts.query.length).toBe(1);
    expect(parts.query[0]).toEqual({ key: "a", value: "1" });
  });

  it("setQueryParam patches a single index immutably", () => {
    const parts = makeParts({
      query: [
        { key: "a", value: "1" },
        { key: "b", value: "2" },
      ],
    });
    useUrlParserStore.getState().setParts(parts);
    useUrlParserStore.getState().setQueryParam(1, { value: "99" });
    expect(useUrlParserStore.getState().parts?.query[0]).toEqual({
      key: "a",
      value: "1",
    });
    expect(useUrlParserStore.getState().parts?.query[1]).toEqual({
      key: "b",
      value: "99",
    });
    // Original wasn't mutated.
    expect(parts.query[1].value).toBe("2");
  });

  it("clear resets to initial state", () => {
    useUrlParserStore.setState({
      url: "x",
      parts: makeParts(),
      error: "boom",
      loadedHistoryId: 5,
      savedUrl: "x",
      source: "url",
    });
    useUrlParserStore.getState().clear();
    const s = useUrlParserStore.getState();
    expect(s.url).toBe("");
    expect(s.parts).toBeNull();
    expect(s.error).toBeNull();
    expect(s.loadedHistoryId).toBeNull();
    expect(s.savedUrl).toBeNull();
    expect(s.source).toBeNull();
  });

  it("setUrl marks source 'url'; reparse clears source back to null", async () => {
    (urlApi.parse as ReturnType<typeof vi.fn>).mockResolvedValue(makeParts());
    useUrlParserStore.getState().setUrl("https://x.com");
    expect(useUrlParserStore.getState().source).toBe("url");
    await useUrlParserStore.getState().reparse();
    expect(useUrlParserStore.getState().source).toBeNull();
  });

  it("setQueryParam / addQueryParam / removeQueryParam mark source 'parts'", () => {
    useUrlParserStore.setState({ parts: makeParts({ query: [{ key: "a", value: "1" }] }) });
    useUrlParserStore.getState().setQueryParam(0, { value: "2" });
    expect(useUrlParserStore.getState().source).toBe("parts");
    useUrlParserStore.setState({ source: null });
    useUrlParserStore.getState().addQueryParam();
    expect(useUrlParserStore.getState().source).toBe("parts");
    useUrlParserStore.setState({ source: null });
    useUrlParserStore.getState().removeQueryParam(0);
    expect(useUrlParserStore.getState().source).toBe("parts");
  });

  it("rebuild populates url and clears source", async () => {
    (urlApi.build as ReturnType<typeof vi.fn>).mockResolvedValue("https://built/");
    useUrlParserStore.setState({ parts: makeParts(), source: "parts" });
    await useUrlParserStore.getState().rebuild();
    expect(useUrlParserStore.getState().url).toBe("https://built/");
    expect(useUrlParserStore.getState().source).toBeNull();
  });

  describe("isDirty", () => {
    it("empty url returns false", () => {
      expect(useUrlParserStore.getState().isDirty()).toBe(false);
    });

    it("non-empty url with no saved baseline returns true", () => {
      useUrlParserStore.getState().setUrl("https://x");
      expect(useUrlParserStore.getState().isDirty()).toBe(true);
    });

    it("url matches savedUrl returns false", () => {
      useUrlParserStore.getState().setUrl("https://x");
      useUrlParserStore.getState().setSaved("https://x");
      expect(useUrlParserStore.getState().isDirty()).toBe(false);
    });

    it("url differs from savedUrl returns true", () => {
      useUrlParserStore.getState().setUrl("https://y");
      useUrlParserStore.getState().setSaved("https://x");
      expect(useUrlParserStore.getState().isDirty()).toBe(true);
    });
  });
});
