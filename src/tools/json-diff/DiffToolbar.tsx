import { useTranslation } from "react-i18next";
import { useJsonDiffStore } from "./store";
import { useToastStore } from "../../shell/toastStore";

interface DiffToolbarProps {
  onOpenSave(): void;
}

export function DiffToolbar({ onOpenSave }: DiffToolbarProps): JSX.Element {
  const { t } = useTranslation();
  const left = useJsonDiffStore((s) => s.left);
  const right = useJsonDiffStore((s) => s.right);
  const tree = useJsonDiffStore((s) => s.tree);
  const swap = useJsonDiffStore((s) => s.swap);
  const clear = useJsonDiffStore((s) => s.clear);
  const push = useToastStore((s) => s.push);

  const onCompare = async () => {
    await useJsonDiffStore.getState().compare();
    const err = useJsonDiffStore.getState().diffError;
    if (err) {
      push("error", t("json_diff.compare_failed", { message: err.message }));
    }
  };

  const stats = tree?.stats;
  let statusText = "";
  if (stats) {
    if (stats.differences === 0) {
      statusText = t("json_diff.stats_no_diff");
    } else {
      statusText = t("json_diff.stats_diffs", {
        n: stats.differences,
        total: stats.total_nodes,
      });
    }
  }

  const saveDisabled = left.trim().length === 0 && right.trim().length === 0;

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--border)] bg-[color:var(--bg-panel)]">
      <button
        type="button"
        onClick={() => void onCompare()}
        className="px-3 py-1 text-sm rounded bg-[color:var(--accent)] text-white"
      >
        {t("json_diff.compare")}
      </button>
      <button
        type="button"
        onClick={swap}
        className="px-3 py-1 text-sm rounded border border-[color:var(--border)] hover:bg-[color:var(--bg-base)]"
      >
        {t("json_diff.swap")}
      </button>
      <button
        type="button"
        onClick={clear}
        className="px-3 py-1 text-sm rounded border border-[color:var(--border)] hover:bg-[color:var(--bg-base)]"
      >
        {t("json_diff.clear")}
      </button>
      <span className="ml-auto text-xs text-[color:var(--text-muted)]">
        {statusText}
      </span>
      <button
        type="button"
        onClick={onOpenSave}
        disabled={saveDisabled}
        className="px-3 py-1 text-sm rounded bg-[color:var(--accent)] text-white disabled:opacity-50"
      >
        {t("json_diff.save")}
      </button>
    </div>
  );
}
