import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SaveDialog, type SaveResult } from "../../history/SaveDialog";
import { useJsonDiffStore } from "./store";
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
  const left = useJsonDiffStore((s) => s.left);
  const right = useJsonDiffStore((s) => s.right);
  const loadedHistoryId = useJsonDiffStore((s) => s.loadedHistoryId);
  const setLoadedHistoryId = useJsonDiffStore((s) => s.setLoadedHistoryId);
  const setSaved = useJsonDiffStore((s) => s.setSaved);
  const save = useHistoryStore((s) => s.save);
  const push = useToastStore((s) => s.push);

  const [defaultTitle] = useState(
    () =>
      (left + " vs " + right).slice(0, 50).replace(/\s+/g, " ").trim() ||
      t("json_diff.save_default_title"),
  );

  const handle = async (result: SaveResult) => {
    const req: SaveRequest =
      result.mode === "new"
        ? {
            mode: "new",
            title: result.title,
            content: { tool: "json_diff", left, right },
          }
        : {
            mode: "overwrite",
            id: result.id,
            title: result.title,
            content: { tool: "json_diff", left, right },
          };
    try {
      const item = await save(req);
      setLoadedHistoryId(item.id);
      setSaved(left, right);
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
