import { useTranslation } from "react-i18next";

export function JsonViewer() {
  const { t } = useTranslation();
  return (
    <div className="h-full flex items-center justify-center text-[color:var(--text-muted)]">
      {t("common.coming_soon", { tool: t("tools.json_viewer") })}
    </div>
  );
}
