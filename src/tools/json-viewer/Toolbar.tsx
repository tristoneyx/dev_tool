import { useTranslation } from "react-i18next";
import { useJsonViewerStore } from "./store";
import { jsonApi } from "./api";
import { useToastStore } from "../../shell/toastStore";
import { IpcError } from "../../lib/ipc";

interface ToolbarProps {
  onOpenSave(): void;
}

export function Toolbar({ onOpenSave }: ToolbarProps) {
  const { t } = useTranslation();
  const input = useJsonViewerStore((s) => s.input);
  const setInput = useJsonViewerStore((s) => s.setInput);
  const clear = useJsonViewerStore((s) => s.clear);
  const push = useToastStore((s) => s.push);

  const replaceInput = async (next: string) => {
    setInput(next);
    await useJsonViewerStore.getState().parse(next);
  };

  const onFormat = async (indent: number) => {
    try {
      const out = await jsonApi.format(input, indent);
      await replaceInput(out);
    } catch {
      push("error", t("json_viewer.format_failed"));
    }
  };

  const onUnescape = async () => {
    try {
      const out = await jsonApi.unescape(input);
      await replaceInput(out);
    } catch (e) {
      const msg = e instanceof IpcError ? e.app.message : String(e);
      push("error", msg);
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--border)] bg-[color:var(--bg-panel)]">
      <button
        type="button"
        onClick={() => onFormat(2)}
        className="px-3 py-1 text-sm rounded border border-[color:var(--border)] hover:bg-[color:var(--bg-base)]"
      >
        {t("json_viewer.format")}
      </button>
      <button
        type="button"
        onClick={() => onFormat(0)}
        className="px-3 py-1 text-sm rounded border border-[color:var(--border)] hover:bg-[color:var(--bg-base)]"
      >
        {t("json_viewer.minify")}
      </button>
      <button
        type="button"
        onClick={onUnescape}
        className="px-3 py-1 text-sm rounded border border-[color:var(--border)] hover:bg-[color:var(--bg-base)]"
      >
        {t("json_viewer.unescape_in_place")}
      </button>
      <button
        type="button"
        onClick={clear}
        className="px-3 py-1 text-sm rounded border border-[color:var(--border)] hover:bg-[color:var(--bg-base)]"
      >
        {t("json_viewer.clear")}
      </button>
      <button
        type="button"
        onClick={onOpenSave}
        disabled={input.trim().length === 0}
        className="ml-auto px-3 py-1 text-sm rounded bg-[color:var(--accent)] text-white disabled:opacity-50"
      >
        {t("json_viewer.save")}
      </button>
    </div>
  );
}
