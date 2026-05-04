import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { parseLinter } from "../../tools/json-viewer/lint";
import type { ParseDiagnostic } from "../../tools/json-viewer/store";

interface JsonEditorProps {
  value: string;
  onChange(text: string): void;
  diagnostic: ParseDiagnostic | null;
  /**
   * i18n key used for the host's aria-label (so screen readers can announce
   * the placeholder text). Defaults to the JSON Viewer's editor placeholder.
   */
  ariaLabelKey?: string;
}

export function JsonEditor({
  value,
  onChange,
  diagnostic,
  ariaLabelKey = "json_viewer.editor_placeholder",
}: JsonEditorProps) {
  const { t } = useTranslation();
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const diagRef = useRef(diagnostic);

  // Keep refs current so the EditorView created once below sees fresh closures.
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);
  useEffect(() => {
    diagRef.current = diagnostic;
    viewRef.current?.dispatch({}); // trigger lint refresh
  }, [diagnostic]);

  useEffect(() => {
    if (!hostRef.current) return;

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          json(),
          parseLinter(() => diagRef.current),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          EditorView.theme(
            {
              "&": { height: "100%", maxWidth: "100%" },
              ".cm-scroller": {
                fontFamily: "var(--font-mono, monospace)",
                overflow: "auto",
              },
            },
            { dark: false },
          ),
        ],
      }),
    });
    viewRef.current = view;

    // Surface a placeholder via aria so screen readers know where to type.
    hostRef.current.setAttribute("aria-label", t(ariaLabelKey));

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the editor doc in sync when `value` changes externally
  // (e.g. after Format / Unescape in place / loading from history).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={hostRef} className="h-full w-full overflow-hidden" />;
}
