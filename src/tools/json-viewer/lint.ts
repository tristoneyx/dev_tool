import { linter, type Diagnostic } from "@codemirror/lint";
import type { ParseDiagnostic } from "./store";

/**
 * Build a CodeMirror linter that surfaces a single parse diagnostic
 * at the given line/col. Returns a no-op linter when `getDiag()` returns null.
 */
export function parseLinter(getDiag: () => ParseDiagnostic | null) {
  return linter((view) => {
    const diag = getDiag();
    if (!diag) return [];
    const doc = view.state.doc;
    const lineNumber = Math.max(1, Math.min(diag.line, doc.lines));
    const line = doc.line(lineNumber);
    const col = Math.max(0, Math.min(diag.col, line.length));
    const from = line.from + col;
    const to = Math.min(from + 1, line.to);
    const result: Diagnostic[] = [
      {
        from,
        to,
        severity: "error",
        message: diag.message,
      },
    ];
    return result;
  });
}
