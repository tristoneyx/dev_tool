import { useTranslation } from "react-i18next";
import { ThemeToggle } from "./ThemeToggle";
import { LocaleToggle } from "./LocaleToggle";
import { ToolTabs } from "./ToolTabs";

interface TitleBarProps {
  onToggleHistory: () => void;
}

export function TitleBar({ onToggleHistory }: TitleBarProps) {
  const { t } = useTranslation();
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-[color:var(--border)] bg-[color:var(--bg-base)]">
      <div className="text-sm font-semibold text-[color:var(--text-primary)]">
        {t("app.title")}
      </div>
      <ToolTabs />
      <div className="flex items-center gap-2">
        <LocaleToggle />
        <ThemeToggle />
        <button
          type="button"
          onClick={onToggleHistory}
          className="px-3 py-1 text-sm rounded-md border border-[color:var(--border)] hover:bg-[color:var(--bg-panel)] transition-colors"
        >
          {t("app.history")}
        </button>
      </div>
    </header>
  );
}
