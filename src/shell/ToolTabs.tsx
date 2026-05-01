import { useTranslation } from "react-i18next";
import { useActiveToolStore } from "./activeToolStore";
import type { ToolKind } from "../types/ipc";

const tabs: ToolKind[] = [
  "json_viewer",
  "json_diff",
  "escape",
  "base64",
  "url_parser",
];

export function ToolTabs() {
  const { t } = useTranslation();
  const { active, setActive } = useActiveToolStore();
  return (
    <nav className="flex gap-1" aria-label="Tools">
      {tabs.map((id) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={[
              "px-3 py-1.5 text-sm rounded-md transition-colors",
              isActive
                ? "bg-[color:var(--accent)] text-white"
                : "text-[color:var(--text-primary)] hover:bg-[color:var(--bg-panel)]",
            ].join(" ")}
            aria-current={isActive ? "page" : undefined}
          >
            {t(`tools.${id}`)}
          </button>
        );
      })}
    </nav>
  );
}
