import { useState } from "react";
import { useTranslation } from "react-i18next";
import { noSmartTyping } from "../lib/inputAttrs";

export type SaveResult =
  | { mode: "new"; title: string }
  | { mode: "overwrite"; id: number; title: string };

interface SaveDialogProps {
  open: boolean;
  defaultTitle: string;
  loadedId: number | null;
  onSave(result: SaveResult): void;
  onCancel(): void;
}

export function SaveDialog({
  open,
  defaultTitle,
  loadedId,
  onSave,
  onCancel,
}: SaveDialogProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(defaultTitle);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center">
      <div className="bg-[color:var(--bg-panel)] border border-[color:var(--border)] rounded-lg shadow w-96 p-4">
        <h2 className="text-sm font-semibold mb-3">{t("save_dialog.heading")}</h2>
        <label className="block text-xs text-[color:var(--text-muted)] mb-1">
          {t("save_dialog.title_label")}
        </label>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          {...noSmartTyping}
          className="w-full px-2 py-1 mb-4 text-sm rounded border border-[color:var(--border)] bg-[color:var(--bg-base)]"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-sm rounded border border-[color:var(--border)]"
          >
            {t("save_dialog.cancel")}
          </button>
          <button
            type="button"
            disabled={loadedId === null}
            onClick={() =>
              loadedId !== null &&
              onSave({ mode: "overwrite", id: loadedId, title })
            }
            className="px-3 py-1 text-sm rounded border border-[color:var(--border)] disabled:opacity-50"
          >
            {t("save_dialog.overwrite")}
          </button>
          <button
            type="button"
            onClick={() => onSave({ mode: "new", title })}
            className="px-3 py-1 text-sm rounded bg-[color:var(--accent)] text-white"
          >
            {t("save_dialog.new")}
          </button>
        </div>
      </div>
    </div>
  );
}
