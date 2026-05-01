import { beforeEach, describe, expect, it } from "vitest";
import { useThemeStore } from "../themeStore";

describe("theme store", () => {
  beforeEach(() => {
    useThemeStore.setState({ mode: "light" });
    document.documentElement.classList.remove("dark");
  });

  it("light mode removes the dark class", () => {
    useThemeStore.getState().setMode("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("dark mode adds the dark class", () => {
    useThemeStore.getState().setMode("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("cycle goes light -> dark -> system -> light", () => {
    useThemeStore.setState({ mode: "light" });
    useThemeStore.getState().cycle();
    expect(useThemeStore.getState().mode).toBe("dark");
    useThemeStore.getState().cycle();
    expect(useThemeStore.getState().mode).toBe("system");
    useThemeStore.getState().cycle();
    expect(useThemeStore.getState().mode).toBe("light");
  });
});
