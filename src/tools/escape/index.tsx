import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEscapeStore } from "./store";
import { copyToClipboard } from "../../lib/clipboard";
import { useToastStore } from "../../shell/toastStore";
import { SaveDialogHost } from "./SaveDialogHost";

export function Escape() {
  const { t } = useTranslation();
  const input = useEscapeStore((s) => s.input);
  const output = useEscapeStore((s) => s.output);
  const error = useEscapeStore((s) => s.error);
  const direction = useEscapeStore((s) => s.direction);
  const setInput = useEscapeStore((s) => s.setInput);
  const setDirection = useEscapeStore((s) => s.setDirection);
  const recompute = useEscapeStore((s) => s.recompute);
  const clear = useEscapeStore((s) => s.clear);
  const push = useToastStore((s) => s.push);

  useEffect(() => {
    void recompute();
  }, [input, direction, recompute]);

  const [saveOpen, setSaveOpen] = useState(false);

  const swapDirection = () => {
    const next = direction === "escape" ? "unescape" : "escape";
    // If we have a non-error output, treat it as the new input — the previous
    // direction's output becomes the next direction's input. Otherwise just
    // flip the direction with the current input.
    if (output.length > 0 && !error) {
      setInput(output);
    }
    setDirection(next);
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--border)] bg-[color:var(--bg-panel)]">
        <button
          type="button"
          onClick={swapDirection}
          title={t("escape.swap_direction_tooltip")}
          className="px-3 py-1 text-sm rounded border border-[color:var(--border)] bg-[color:var(--bg-base)] hover:bg-[color:var(--bg-panel)] font-mono"
        >
          {direction === "escape"
            ? `${t("escape.direction_escape")} ⇄ ${t("escape.direction_unescape")}`
            : `${t("escape.direction_unescape")} ⇄ ${t("escape.direction_escape")}`}
        </button>
        <button
          type="button"
          onClick={clear}
          className="px-3 py-1 text-sm rounded border border-[color:var(--border)] hover:bg-[color:var(--bg-base)]"
        >
          {t("escape.clear")}
        </button>
        <button
          type="button"
          onClick={() => setSaveOpen(true)}
          disabled={input.trim().length === 0}
          className="ml-auto px-3 py-1 text-sm rounded bg-[color:var(--accent)] text-white disabled:opacity-50"
        >
          {t("escape.save")}
        </button>
      </div>

      {/* Two stacked panes */}
      <div className="flex-1 grid grid-rows-2 min-h-0">
        <div className="border-b border-[color:var(--border)] flex flex-col min-h-0">
          <div className="px-3 py-1 text-xs text-[color:var(--text-muted)] bg-[color:var(--bg-base)] border-b border-[color:var(--border)]">
            {t("escape.input_label")}
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t("escape.input_placeholder")}
            className="flex-1 p-3 font-mono text-sm bg-[color:var(--bg-base)] outline-none resize-none"
          />
        </div>
        <div className="flex flex-col min-h-0">
          <div className="px-3 py-1 text-xs text-[color:var(--text-muted)] bg-[color:var(--bg-base)] border-b border-[color:var(--border)] flex items-center">
            {t("escape.output_label")}
            <button
              type="button"
              disabled={output.length === 0}
              onClick={async () => {
                await copyToClipboard(output);
                push("success", t("json_viewer.copied_toast"));
              }}
              className="ml-auto px-2 py-0.5 text-xs rounded border border-[color:var(--border)] hover:bg-[color:var(--bg-panel)] disabled:opacity-50"
            >
              {t("escape.copy")}
            </button>
          </div>
          {error ? (
            <div className="flex-1 p-3 text-sm text-[color:var(--diff-removed)] font-mono whitespace-pre-wrap">
              {error}
            </div>
          ) : (
            <textarea
              readOnly
              value={output}
              className="flex-1 p-3 font-mono text-sm bg-[color:var(--bg-panel)] outline-none resize-none"
            />
          )}
        </div>
      </div>

      <SaveDialogHost open={saveOpen} onClose={() => setSaveOpen(false)} />
    </div>
  );
}
