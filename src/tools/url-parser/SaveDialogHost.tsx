import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SaveDialog, type SaveResult } from "../../history/SaveDialog";
import { useUrlParserStore } from "./store";
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
  const url = useUrlParserStore((s) => s.url);
  const loadedHistoryId = useUrlParserStore((s) => s.loadedHistoryId);
  const setLoadedHistoryId = useUrlParserStore((s) => s.setLoadedHistoryId);
  const setSaved = useUrlParserStore((s) => s.setSaved);
  const save = useHistoryStore((s) => s.save);
  const push = useToastStore((s) => s.push);

  const [defaultTitle] = useState(
    () =>
      url.slice(0, 50).replace(/\s+/g, " ").trim() ||
      t("url_parser.save_default_title"),
  );

  const handle = async (result: SaveResult) => {
    const req: SaveRequest =
      result.mode === "new"
        ? {
            mode: "new",
            title: result.title,
            content: { tool: "url_parser", url },
          }
        : {
            mode: "overwrite",
            id: result.id,
            title: result.title,
            content: { tool: "url_parser", url },
          };
    try {
      const item = await save(req);
      setLoadedHistoryId(item.id);
      setSaved(url);
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
