import { create } from "zustand";

export type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  setMode(mode: ThemeMode): void;
  cycle(): void;
}

function applyMode(mode: ThemeMode) {
  const root = document.documentElement;
  const effective =
    mode === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : mode;
  root.classList.toggle("dark", effective === "dark");
}

const order: ThemeMode[] = ["light", "dark", "system"];

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "light",
  setMode(mode) {
    applyMode(mode);
    set({ mode });
  },
  cycle() {
    const current = get().mode;
    const idx = order.indexOf(current);
    const next = order[(idx + 1) % order.length];
    get().setMode(next);
  },
}));

if (typeof window !== "undefined") {
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (useThemeStore.getState().mode === "system") {
        applyMode("system");
      }
    });
}
