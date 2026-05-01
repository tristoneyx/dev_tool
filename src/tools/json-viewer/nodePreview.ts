import type { JsonNode, NodeValue } from "../../types/ipc";

const VALUE_TRUNCATE = 30;
const PREVIEW_FIRST_N = 2;

export function valueSummary(value: NodeValue): string {
  switch (value.type) {
    case "null":
      return "null";
    case "bool":
      return value.value ? "true" : "false";
    case "number":
      return value.raw;
    case "string": {
      const v = value.value;
      const trimmed = v.length > VALUE_TRUNCATE ? v.slice(0, VALUE_TRUNCATE) + "…" : v;
      return `"${trimmed}"`;
    }
    case "object":
      return "{...}";
    case "array":
      return "[...]";
  }
}

function nodeKeyLiteral(node: JsonNode): string {
  if (node.key.kind === "object") return JSON.stringify(node.key.name);
  return "";
}

export function previewObject(children: JsonNode[]): string {
  if (children.length === 0) return "{ }";
  const head = children.slice(0, PREVIEW_FIRST_N);
  const tail = children.length - head.length;
  const parts = head.map(
    (c) => `${nodeKeyLiteral(c)}: ${valueSummary(c.value)}`,
  );
  if (tail > 0) parts.push(`+${tail}`);
  return `{ ${parts.join(", ")} }`;
}

export function previewArray(children: JsonNode[]): string {
  if (children.length === 0) return "[ ]";
  const head = children.slice(0, PREVIEW_FIRST_N);
  const tail = children.length - head.length;
  const parts = head.map((c) => valueSummary(c.value));
  if (tail > 0) parts.push(`+${tail}`);
  return `[ ${parts.join(", ")} ]`;
}
