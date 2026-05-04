import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUrlParserStore } from "./store";
import { QueryTable } from "./QueryTable";
import { SaveDialogHost } from "./SaveDialogHost";
import { debounce } from "../../lib/debounce";
import type { UrlParts } from "../../types/ipc";

const DEBOUNCE_MS = 200;

export function UrlParser() {
  const { t } = useTranslation();
  const url = useUrlParserStore((s) => s.url);
  const parts = useUrlParserStore((s) => s.parts);
  const error = useUrlParserStore((s) => s.error);
  const setUrl = useUrlParserStore((s) => s.setUrl);
  const setParts = useUrlParserStore((s) => s.setParts);
  const setQueryParam = useUrlParserStore((s) => s.setQueryParam);
  const addQueryParam = useUrlParserStore((s) => s.addQueryParam);
  const removeQueryParam = useUrlParserStore((s) => s.removeQueryParam);
  const reparse = useUrlParserStore((s) => s.reparse);
  const rebuild = useUrlParserStore((s) => s.rebuild);
  const clear = useUrlParserStore((s) => s.clear);

  // Debounced reparse on URL changes (skip if mutating == we just set it from rebuild).
  const debouncedReparse = useMemo(
    () =>
      debounce(() => {
        if (useUrlParserStore.getState().mutating) return;
        void reparse();
      }, DEBOUNCE_MS),
    [reparse],
  );

  // Debounced rebuild on parts changes (skip if mutating == we just set it from reparse).
  const debouncedRebuild = useMemo(
    () =>
      debounce(() => {
        if (useUrlParserStore.getState().mutating) return;
        void rebuild();
      }, DEBOUNCE_MS),
    [rebuild],
  );

  useEffect(() => {
    debouncedReparse();
    return () => debouncedReparse.cancel();
  }, [url, debouncedReparse]);

  useEffect(() => {
    debouncedRebuild();
    return () => debouncedRebuild.cancel();
  }, [parts, debouncedRebuild]);

  const [saveOpen, setSaveOpen] = useState(false);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[color:var(--border)] bg-[color:var(--bg-panel)]">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t("url_parser.url_placeholder")}
          className="flex-1 px-2 py-1 text-sm rounded border border-[color:var(--border)] bg-[color:var(--bg-base)] font-mono"
        />
        <button
          type="button"
          onClick={clear}
          className="px-3 py-1 text-sm rounded border border-[color:var(--border)] hover:bg-[color:var(--bg-base)]"
        >
          {t("url_parser.clear")}
        </button>
        <button
          type="button"
          onClick={() => setSaveOpen(true)}
          disabled={url.trim().length === 0}
          className="px-3 py-1 text-sm rounded bg-[color:var(--accent)] text-white disabled:opacity-50"
        >
          {t("url_parser.save")}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 text-xs text-[color:var(--diff-removed)] border-b border-[color:var(--border)]">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto p-3 grid gap-3">
        {parts && <PartsCard parts={parts} onChange={setParts} t={t} />}
        {parts && (
          <QueryTable
            params={parts.query}
            onChange={setQueryParam}
            onAdd={addQueryParam}
            onRemove={removeQueryParam}
          />
        )}
      </div>

      <SaveDialogHost open={saveOpen} onClose={() => setSaveOpen(false)} />
    </div>
  );
}

interface PartsCardProps {
  parts: UrlParts;
  onChange(parts: UrlParts): void;
  t: (key: string) => string;
}

function PartsCard({ parts, onChange, t }: PartsCardProps) {
  const update = (patch: Partial<UrlParts>) => onChange({ ...parts, ...patch });

  return (
    <div className="border border-[color:var(--border)] rounded">
      <div className="px-3 py-2 text-xs text-[color:var(--text-muted)] border-b border-[color:var(--border)] bg-[color:var(--bg-base)]">
        {t("url_parser.parts_card_title")}
      </div>
      <div className="grid grid-cols-2 gap-3 p-3 text-sm">
        <Field
          label={t("url_parser.scheme")}
          value={parts.scheme}
          onChange={(v) => update({ scheme: v })}
        />
        <Field
          label={t("url_parser.host")}
          value={parts.host}
          onChange={(v) => update({ host: v })}
        />
        <Field
          label={t("url_parser.port")}
          value={parts.port === null ? "" : String(parts.port)}
          onChange={(v) => {
            if (v.trim().length === 0) update({ port: null });
            else {
              const n = Number(v);
              if (Number.isInteger(n) && n >= 0 && n <= 65535)
                update({ port: n });
            }
          }}
        />
        <Field
          label={t("url_parser.path")}
          value={parts.path}
          onChange={(v) => update({ path: v })}
        />
        <Field
          label={t("url_parser.fragment")}
          value={parts.fragment ?? ""}
          onChange={(v) => update({ fragment: v.length === 0 ? null : v })}
        />
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange(v: string): void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-[color:var(--text-muted)]">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 text-sm rounded border border-[color:var(--border)] bg-[color:var(--bg-base)] font-mono"
      />
    </label>
  );
}
