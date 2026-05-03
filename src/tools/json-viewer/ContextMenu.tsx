import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface ContextMenuItem {
  label: string;
  onClick(): void;
  /** Optional emphasis style for the primary action (e.g. "Open nested JSON"). */
  emphasis?: boolean;
}

interface ContextMenuProps {
  /** Page-level coordinates (clientX/clientY from the original event). */
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose(): void;
}

const MENU_WIDTH = 220;
const ITEM_HEIGHT = 32;
const VIEWPORT_MARGIN = 8;

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Dismiss on click-outside, Escape, or scroll/resize.
  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (!ref.current) return;
      if (ref.current.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScrollOrResize = () => onClose();
    // Use capture so we catch the click that opened the menu won't re-close it.
    document.addEventListener("mousedown", onPointer, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onPointer, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [onClose]);

  // Clamp to viewport so the menu never opens off-screen.
  const estimatedHeight = items.length * ITEM_HEIGHT + 8;
  const left = Math.min(x, window.innerWidth - MENU_WIDTH - VIEWPORT_MARGIN);
  const top = Math.min(y, window.innerHeight - estimatedHeight - VIEWPORT_MARGIN);

  return createPortal(
    <div
      ref={ref}
      className="fixed z-50 bg-[color:var(--bg-panel)] border border-[color:var(--border)] rounded-md shadow-lg py-1"
      style={{
        left: `${Math.max(VIEWPORT_MARGIN, left)}px`,
        top: `${Math.max(VIEWPORT_MARGIN, top)}px`,
        minWidth: `${MENU_WIDTH}px`,
      }}
      role="menu"
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          role="menuitem"
          onClick={() => {
            item.onClick();
            onClose();
          }}
          className={`block w-full text-left px-3 py-1.5 text-sm hover:bg-[color:var(--bg-base)] ${
            item.emphasis ? "text-[color:var(--accent)]" : "text-[color:var(--text-primary)]"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>,
    document.body,
  );
}
