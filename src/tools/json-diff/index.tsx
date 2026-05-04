import { useState } from "react";
import { useTranslation } from "react-i18next";
import { JsonEditor } from "../../components/editor/JsonEditor";
import { useJsonDiffStore } from "./store";
import { DiffToolbar } from "./DiffToolbar";
import { DiffSearchBar } from "./DiffSearchBar";
import { DiffPane } from "./DiffPane";
import { SaveDialogHost } from "./SaveDialogHost";

export function JsonDiff(): JSX.Element {
  const { t } = useTranslation();
  const left = useJsonDiffStore((s) => s.left);
  const right = useJsonDiffStore((s) => s.right);
  const setLeft = useJsonDiffStore((s) => s.setLeft);
  const setRight = useJsonDiffStore((s) => s.setRight);
  const diffError = useJsonDiffStore((s) => s.diffError);
  const [saveOpen, setSaveOpen] = useState(false);

  return (
    <div className="h-full flex flex-col">
      <DiffToolbar onOpenSave={() => setSaveOpen(true)} />
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* LEFT pane */}
        <div className="flex-1 min-w-0 border-r border-[color:var(--border)] overflow-hidden flex flex-col">
          <div className="px-3 py-1 text-xs text-[color:var(--text-muted)] bg-[color:var(--bg-base)] border-b border-[color:var(--border)]">
            {t("json_diff.left_label")}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <JsonEditor
              value={left}
              onChange={setLeft}
              diagnostic={null}
              ariaLabelKey="json_diff.left_placeholder"
            />
          </div>
        </div>
        {/* RIGHT pane */}
        <div className="flex-1 min-w-0 border-r border-[color:var(--border)] overflow-hidden flex flex-col">
          <div className="px-3 py-1 text-xs text-[color:var(--text-muted)] bg-[color:var(--bg-base)] border-b border-[color:var(--border)]">
            {t("json_diff.right_label")}
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <JsonEditor
              value={right}
              onChange={setRight}
              diagnostic={null}
              ariaLabelKey="json_diff.right_placeholder"
            />
          </div>
        </div>
        {/* RESULT pane */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <DiffSearchBar />
          {diffError && (
            <div className="px-3 py-2 text-xs text-[color:var(--diff-removed)] border-b border-[color:var(--border)]">
              {diffError.message}
            </div>
          )}
          <div className="flex-1 min-h-0 overflow-hidden">
            <DiffPane />
          </div>
        </div>
      </div>
      <SaveDialogHost open={saveOpen} onClose={() => setSaveOpen(false)} />
    </div>
  );
}
