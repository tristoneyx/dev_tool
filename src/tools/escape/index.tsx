import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useEscapeStore } from "./store";
import { copyToClipboard } from "../../lib/clipboard";
import { useToastStore } from "../../shell/toastStore";
import { SaveDialogHost } from "./SaveDialogHost";
import type { EscapeDirection } from "../../types/ipc";

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

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--border)] bg-[color:var(--bg-panel)]">
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as EscapeDirection)}
          className="px-2 py-1 text-sm rounded border border-[color:var(--border)] bg-[color:var(--bg-base)]"
        >
          <option value="escape">{t("escape.direction_escape")}</option>
          <option value="unescape">{t("escape.direction_unescape")}</option>
        </select>
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
