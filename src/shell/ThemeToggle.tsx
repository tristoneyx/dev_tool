import { useTranslation } from "react-i18next";
import { useThemeStore, type ThemeMode } from "./themeStore";

const labelKey: Record<ThemeMode, string> = {
  light: "theme.light",
  dark: "theme.dark",
  system: "theme.system",
};

export function ThemeToggle() {
  const { t } = useTranslation();
  const { mode, cycle } = useThemeStore();
  return (
    <button
      type="button"
      onClick={cycle}
      className="px-3 py-1 text-sm rounded-md border border-[color:var(--border)] hover:bg-[color:var(--bg-panel)] transition-colors"
      title={t("theme.tooltip")}
    >
      {t(labelKey[mode])}
    </button>
  );
}
