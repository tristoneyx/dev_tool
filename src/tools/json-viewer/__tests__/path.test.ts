import { describe, expect, it } from "vitest";
import { joinObjectKey, joinArrayIndex } from "../path";

describe("joinObjectKey", () => {
  it("safe identifier uses dot", () => {
    expect(joinObjectKey("a", "b")).toBe("a.b");
    expect(joinObjectKey("", "root")).toBe("root");
    expect(joinObjectKey("a", "_field")).toBe("a._field");
  });

  it("weird key uses brackets", () => {
    expect(joinObjectKey("a", "weird-key")).toBe('a["weird-key"]');
    expect(joinObjectKey("a", "key.with.dots")).toBe('a["key.with.dots"]');
  });

  it("empty key uses brackets", () => {
    expect(joinObjectKey("a", "")).toBe('a[""]');
  });

  it("digit-leading key uses brackets", () => {
    expect(joinObjectKey("a", "9lives")).toBe('a["9lives"]');
  });

  it("escapes quotes inside bracketed key", () => {
    expect(joinObjectKey("a", 'say "hi"')).toBe('a["say \\"hi\\""]');
  });
});

describe("joinArrayIndex", () => {
  it("appends bracket index", () => {
    expect(joinArrayIndex("a", 0)).toBe("a[0]");
    expect(joinArrayIndex("a.b", 7)).toBe("a.b[7]");
    expect(joinArrayIndex("", 3)).toBe("[3]");
  });
});
