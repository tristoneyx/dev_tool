import { useTranslation } from "react-i18next";
import { useLocaleStore } from "../i18n/store";

export function LocaleToggle() {
  const { t } = useTranslation();
  const { locale, toggle } = useLocaleStore();
  return (
    <button
      type="button"
      onClick={toggle}
      className="px-3 py-1 text-sm rounded-md border border-[color:var(--border)] hover:bg-[color:var(--bg-panel)] transition-colors"
      title={t("locale.tooltip")}
    >
      {locale === "zh-CN" ? t("locale.zh") : t("locale.en")}
    </button>
  );
}
