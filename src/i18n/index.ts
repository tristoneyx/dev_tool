import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import zhCN from "./locales/zh-CN.json";
import en from "./locales/en.json";

export type Locale = "zh-CN" | "en";

const STORAGE_KEY = "dev-tool.locale";
const DEFAULT_LOCALE: Locale = "zh-CN";

function readPersistedLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "en" || v === "zh-CN" ? v : DEFAULT_LOCALE;
}

export function persistLocale(locale: Locale) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, locale);
  }
}

i18n.use(initReactI18next).init({
  resources: {
    "zh-CN": { translation: zhCN },
    en: { translation: en },
  },
  lng: readPersistedLocale(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
  returnNull: false,
});

export default i18n;
