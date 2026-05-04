import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SaveDialog, type SaveResult } from "../../history/SaveDialog";
import { useBase64Store } from "./store";
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
  const input = useBase64Store((s) => s.input);
  const direction = useBase64Store((s) => s.direction);
  const urlSafe = useBase64Store((s) => s.urlSafe);
  const loadedHistoryId = useBase64Store((s) => s.loadedHistoryId);
  const setLoadedHistoryId = useBase64Store((s) => s.setLoadedHistoryId);
  const setSaved = useBase64Store((s) => s.setSaved);
  const save = useHistoryStore((s) => s.save);
  const push = useToastStore((s) => s.push);

  const [defaultTitle] = useState(
    () =>
      input.slice(0, 50).replace(/\s+/g, " ").trim() ||
      t("base64.save_default_title"),
  );

  const handle = async (result: SaveResult) => {
    const req: SaveRequest =
      result.mode === "new"
        ? {
            mode: "new",
            title: result.title,
            content: { tool: "base64", input, direction, url_safe: urlSafe },
          }
        : {
            mode: "overwrite",
            id: result.id,
            title: result.title,
            content: { tool: "base64", input, direction, url_safe: urlSafe },
          };
    try {
      const item = await save(req);
      setLoadedHistoryId(item.id);
      setSaved(input, direction, urlSafe);
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
