import { useTranslation } from "react-i18next";
import type { QueryParam } from "../../types/ipc";

interface QueryTableProps {
  params: QueryParam[];
  onChange(index: number, patch: Partial<QueryParam>): void;
  onAdd(): void;
  onRemove(index: number): void;
}

export function QueryTable({
  params,
  onChange,
  onAdd,
  onRemove,
}: QueryTableProps) {
  const { t } = useTranslation();

  return (
    <div className="border border-[color:var(--border)] rounded">
      <div className="px-3 py-2 text-xs text-[color:var(--text-muted)] border-b border-[color:var(--border)] bg-[color:var(--bg-base)]">
        {t("url_parser.query_table_title")}
      </div>
      <div className="grid grid-cols-[1fr_2fr_auto] gap-x-2 gap-y-1 p-2 text-sm">
        <div className="text-xs text-[color:var(--text-muted)] px-1">
          {t("url_parser.key")}
        </div>
        <div className="text-xs text-[color:var(--text-muted)] px-1">
          {t("url_parser.value")}
        </div>
        <div />
        {params.map((p, i) => (
          <Row
            key={i}
            param={p}
            onChange={(patch) => onChange(i, patch)}
            onRemove={() => onRemove(i)}
            removeLabel={t("url_parser.remove_row")}
          />
        ))}
      </div>
      <div className="px-2 pb-2">
        <button
          type="button"
          onClick={onAdd}
          className="text-xs text-[color:var(--accent)] hover:underline"
        >
          {t("url_parser.add_row")}
        </button>
      </div>
    </div>
  );
}

function Row({
  param,
  onChange,
  onRemove,
  removeLabel,
}: {
  param: QueryParam;
  onChange(patch: Partial<QueryParam>): void;
  onRemove(): void;
  removeLabel: string;
}) {
  return (
    <>
      <input
        value={param.key}
        onChange={(e) => onChange({ key: e.target.value })}
        className="px-2 py-1 text-sm rounded border border-[color:var(--border)] bg-[color:var(--bg-base)] font-mono"
      />
      <input
        value={param.value}
        onChange={(e) => onChange({ value: e.target.value })}
        className="px-2 py-1 text-sm rounded border border-[color:var(--border)] bg-[color:var(--bg-base)] font-mono"
      />
      <button
        type="button"
        onClick={onRemove}
        className="px-2 py-1 text-xs text-[color:var(--diff-removed)] hover:underline"
        aria-label={removeLabel}
      >
        ×
      </button>
    </>
  );
}
