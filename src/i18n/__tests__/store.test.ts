import { beforeEach, describe, expect, it } from "vitest";
import i18n from "../index";
import { useLocaleStore } from "../store";

describe("locale store", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage("zh-CN");
    useLocaleStore.setState({ locale: "zh-CN" });
  });

  it("setLocale changes i18n language and persists", async () => {
    useLocaleStore.getState().setLocale("en");
    expect(useLocaleStore.getState().locale).toBe("en");
    expect(i18n.language).toBe("en");
    expect(window.localStorage.getItem("dev-tool.locale")).toBe("en");
  });

  it("toggle flips zh-CN <-> en", () => {
    useLocaleStore.getState().toggle();
    expect(useLocaleStore.getState().locale).toBe("en");
    useLocaleStore.getState().toggle();
    expect(useLocaleStore.getState().locale).toBe("zh-CN");
  });
});
