import { useTranslation } from "react-i18next";
import { useJsonDiffStore } from "./store";
import { noSmartTyping } from "../../lib/inputAttrs";

export function DiffSearchBar(): JSX.Element {
  const { t } = useTranslation();
  const searchQuery = useJsonDiffStore((s) => s.searchQuery);
  const setSearchQuery = useJsonDiffStore((s) => s.setSearchQuery);
  const showOnlyDiffs = useJsonDiffStore((s) => s.showOnlyDiffs);
  const setShowOnlyDiffs = useJsonDiffStore((s) => s.setShowOnlyDiffs);

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--border)] bg-[color:var(--bg-panel)]">
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder={t("json_diff.search_placeholder")}
        {...noSmartTyping}
        className="flex-1 px-2 py-1 text-sm rounded border border-[color:var(--border)] bg-[color:var(--bg-base)]"
      />
      <label className="flex items-center gap-1 text-sm text-[color:var(--text-muted)]">
        <input
          type="checkbox"
          checked={showOnlyDiffs}
          onChange={(e) => setShowOnlyDiffs(e.target.checked)}
        />
        {t("json_diff.show_only_diffs")}
      </label>
    </div>
  );
}
