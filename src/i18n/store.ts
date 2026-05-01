import { create } from "zustand";
import i18n, { persistLocale, type Locale } from "./index";

interface LocaleState {
  locale: Locale;
  setLocale(locale: Locale): void;
  toggle(): void;
}

export const useLocaleStore = create<LocaleState>((set, get) => ({
  locale: (i18n.language as Locale) ?? "zh-CN",
  setLocale(locale) {
    void i18n.changeLanguage(locale);
    persistLocale(locale);
    set({ locale });
  },
  toggle() {
    get().setLocale(get().locale === "zh-CN" ? "en" : "zh-CN");
  },
}));
