import { useToastStore } from "./toastStore";

const kindClass: Record<string, string> = {
  info: "border-[color:var(--border)]",
  success: "border-[color:var(--diff-added)]",
  error: "border-[color:var(--diff-removed)]",
};

export function ToastHost() {
  const { toasts, dismiss } = useToastStore();
  return (
    <div className="fixed top-3 right-3 flex flex-col gap-2 z-50">
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismiss(t.id)}
          className={`max-w-sm text-left text-sm bg-[color:var(--bg-panel)] border rounded-md px-3 py-2 shadow ${kindClass[t.kind]}`}
        >
          {t.message}
        </button>
      ))}
    </div>
  );
}
