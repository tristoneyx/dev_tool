import { describe, expect, it } from "vitest";
import { previewObject, previewArray, valueSummary } from "../nodePreview";
import type { JsonNode } from "../../../types/ipc";

const stringNode = (k: string, v: string): JsonNode => ({
  id: 0,
  key: { kind: "object", name: k },
  path: k,
  value: { type: "string", value: v, nested_hint: null },
});

const numberNode = (k: string, raw: string): JsonNode => ({
  id: 0,
  key: { kind: "object", name: k },
  path: k,
  value: { type: "number", raw },
});

describe("valueSummary", () => {
  it("primitives show their literal", () => {
    expect(valueSummary({ type: "null" })).toBe("null");
    expect(valueSummary({ type: "bool", value: true })).toBe("true");
    expect(valueSummary({ type: "number", raw: "42" })).toBe("42");
  });

  it("string shown quoted, truncated to 30 chars", () => {
    expect(valueSummary({ type: "string", value: "hi", nested_hint: null })).toBe('"hi"');
    const long = "a".repeat(50);
    expect(
      valueSummary({ type: "string", value: long, nested_hint: null }),
    ).toBe('"' + "a".repeat(30) + '…"');
  });

  it("object/array show ellipsis with brackets", () => {
    expect(valueSummary({ type: "object", children: [], key_count: 5 })).toBe("{...}");
    expect(valueSummary({ type: "array", children: [], item_count: 3 })).toBe("[...]");
  });
});

describe("previewObject", () => {
  it("empty object", () => {
    expect(previewObject([])).toBe("{ }");
  });

  it("one key", () => {
    expect(previewObject([stringNode("a", "x")])).toBe('{ "a": "x" }');
  });

  it("two keys", () => {
    expect(previewObject([stringNode("a", "x"), stringNode("b", "y")])).toBe(
      '{ "a": "x", "b": "y" }',
    );
  });

  it("more than two keys shows +N", () => {
    expect(
      previewObject([
        stringNode("a", "x"),
        stringNode("b", "y"),
        stringNode("c", "z"),
        stringNode("d", "w"),
      ]),
    ).toBe('{ "a": "x", "b": "y", +2 }');
  });
});

describe("previewArray", () => {
  it("empty array", () => {
    expect(previewArray([])).toBe("[ ]");
  });

  it("two items", () => {
    expect(previewArray([numberNode("0", "1"), numberNode("1", "2")])).toBe("[ 1, 2 ]");
  });

  it("more than two items shows +N", () => {
    expect(
      previewArray([
        numberNode("0", "1"),
        numberNode("1", "2"),
        numberNode("2", "3"),
      ]),
    ).toBe("[ 1, 2, +1 ]");
  });
});
