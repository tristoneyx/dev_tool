import { useTranslation } from "react-i18next";
import { useJsonViewerStore, type SearchMode } from "./store";

const modes: SearchMode[] = ["both", "key", "value"];

export function SearchBar() {
  const { t } = useTranslation();
  const { searchQuery, searchMode, setSearch } = useJsonViewerStore();
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--border)] bg-[color:var(--bg-panel)]">
      <input
        type="search"
        value={searchQuery}
        onChange={(e) => setSearch(e.target.value, searchMode)}
        placeholder={t("json_viewer.search_placeholder")}
        className="flex-1 px-2 py-1 text-sm rounded border border-[color:var(--border)] bg-[color:var(--bg-base)]"
      />
      <select
        value={searchMode}
        onChange={(e) => setSearch(searchQuery, e.target.value as SearchMode)}
        className="px-2 py-1 text-sm rounded border border-[color:var(--border)] bg-[color:var(--bg-base)]"
      >
        {modes.map((m) => (
          <option key={m} value={m}>
            {t(`json_viewer.search_mode_${m}`)}
          </option>
        ))}
      </select>
    </div>
  );
}
