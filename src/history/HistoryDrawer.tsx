import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useHistoryStore } from "./store";
import { formatBytes, formatRelativeTime } from "../lib/format";
import { noSmartTyping } from "../lib/inputAttrs";
import type { HistoryContent, HistoryItem, ToolKind } from "../types/ipc";

interface HistoryDrawerProps {
  open: boolean;
  tool: ToolKind;
  onLoad(item: HistoryItem): void;
}

function contentSize(c: HistoryContent): number {
  switch (c.tool) {
    case "json_viewer":
      return c.input.length;
    case "json_diff":
      return c.left.length + c.right.length;
    case "escape":
    case "base64":
      return c.input.length;
    case "url_parser":
      return c.url.length;
  }
}

export function HistoryDrawer({ open, tool, onLoad }: HistoryDrawerProps) {
  const { t } = useTranslation();
  const items = useHistoryStore((s) => s.itemsByTool[tool] ?? []);
  const refresh = useHistoryStore((s) => s.refresh);
  const remove = useHistoryStore((s) => s.remove);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) refresh(tool, search.trim() || undefined);
  }, [open, tool, search, refresh]);

  if (!open) return null;

  return (
    <aside className="w-80 border-l border-[color:var(--border)] bg-[color:var(--bg-panel)] flex flex-col">
      <div className="p-3 border-b border-[color:var(--border)]">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("history_drawer.search_placeholder")}
          {...noSmartTyping}
          className="w-full px-2 py-1 text-sm rounded border border-[color:var(--border)] bg-[color:var(--bg-base)]"
        />
      </div>
      <ul className="flex-1 overflow-auto">
        {items.length === 0 ? (
          <li className="p-4 text-sm text-[color:var(--text-muted)]">
            {t("history_drawer.empty")}
          </li>
        ) : (
          items.map((item) => (
            <li
              key={item.id}
              className="border-b border-[color:var(--border)] flex items-stretch hover:bg-[color:var(--bg-base)]"
            >
              <button
                type="button"
                onClick={() => onLoad(item)}
                className="flex-1 text-left px-3 py-2"
              >
                <div className="text-sm font-medium truncate">{item.title}</div>
                <div className="text-xs text-[color:var(--text-muted)] mt-0.5">
                  {formatRelativeTime(item.updated_at)} ·{" "}
                  {formatBytes(contentSize(item.content))}
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      t("history_drawer.delete_confirm", { title: item.title }),
                    )
                  ) {
                    remove(tool, item.id);
                  }
                }}
                className="px-2 text-[color:var(--text-muted)] hover:text-[color:var(--diff-removed)]"
                title={t("history_drawer.delete_title")}
              >
                ×
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
