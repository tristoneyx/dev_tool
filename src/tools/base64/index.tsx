import { useTranslation } from "react-i18next";

export function Base64() {
  const { t } = useTranslation();
  return (
    <div className="h-full flex items-center justify-center text-[color:var(--text-muted)]">
      {t("common.coming_soon", { tool: t("tools.base64") })}
    </div>
  );
}
