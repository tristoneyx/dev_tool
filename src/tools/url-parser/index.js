import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslation } from "react-i18next";
export function UrlParser() {
    const { t } = useTranslation();
    return (_jsx("div", { className: "h-full flex items-center justify-center text-[color:var(--text-muted)]", children: t("common.coming_soon", { tool: t("tools.url_parser") }) }));
}
