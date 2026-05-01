import { useThemeStore } from "./themeStore";

const labels: Record<string, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export function ThemeToggle() {
  const { mode, cycle } = useThemeStore();
  return (
    <button
      type="button"
      onClick={cycle}
      className="px-3 py-1 text-sm rounded-md border border-[color:var(--border)] hover:bg-[color:var(--bg-panel)] transition-colors"
      title="Cycle theme: light → dark → system"
    >
      {labels[mode]}
    </button>
  );
}
