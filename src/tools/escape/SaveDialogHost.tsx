import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SaveDialog, type SaveResult } from "../../history/SaveDialog";
import { useEscapeStore } from "./store";
import { useHistoryStore } from "../../history/store";
import { useToastStore } from "../../shell/toastStore";
import type { SaveRequest } from "../../types/ipc";

export function SaveDialogHost({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const input = useEscapeStore((s) => s.input);
  const direction = useEscapeStore((s) => s.direction);
  const loadedHistoryId = useEscapeStore((s) => s.loadedHistoryId);
  const setLoadedHistoryId = useEscapeStore((s) => s.setLoadedHistoryId);
  const setSaved = useEscapeStore((s) => s.setSaved);
  const save = useHistoryStore((s) => s.save);
  const push = useToastStore((s) => s.push);

  const [defaultTitle] = useState(
    () =>
      input.slice(0, 50).replace(/\s+/g, " ").trim() ||
      t("escape.save_default_title"),
  );

  const handle = async (result: SaveResult) => {
    const req: SaveRequest =
      result.mode === "new"
        ? {
            mode: "new",
            title: result.title,
            content: { tool: "escape", input, direction },
          }
        : {
            mode: "overwrite",
            id: result.id,
            title: result.title,
            content: { tool: "escape", input, direction },
          };
    try {
      const item = await save(req);
      setLoadedHistoryId(item.id);
      setSaved(input, direction);
      onClose();
    } catch (e) {
      push("error", e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <SaveDialog
      open={open}
      defaultTitle={defaultTitle}
      loadedId={loadedHistoryId}
      onSave={handle}
      onCancel={onClose}
    />
  );
}
