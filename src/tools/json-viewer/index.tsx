import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { JsonEditor } from "../../components/editor/JsonEditor";
import { Tree } from "./Tree";
import { SearchBar } from "./SearchBar";
import { Toolbar } from "./Toolbar";
import { SaveDialogHost } from "./SaveButton";
import { useJsonViewerStore } from "./store";
import { debounce } from "../../lib/debounce";

const PARSE_DEBOUNCE_MS = 200;

export function JsonViewer() {
  const { t } = useTranslation();
  const input = useJsonViewerStore((s) => s.input);
  const setInput = useJsonViewerStore((s) => s.setInput);
  const parse = useJsonViewerStore((s) => s.parse);
  const parseError = useJsonViewerStore((s) => s.parseError);
  const unescapeLayers = useJsonViewerStore((s) => s.unescapeLayers);
  const drillIntoNested = useJsonViewerStore((s) => s.drillIntoNested);
  const setPendingDrillInto = useJsonViewerStore((s) => s.setPendingDrillInto);
  const pendingDrillInto = useJsonViewerStore((s) => s.pendingDrillInto);

  const debouncedParse = useMemo(
    () => debounce((text: string) => void parse(text), PARSE_DEBOUNCE_MS),
    [parse],
  );

  useEffect(() => {
    debouncedParse(input);
    return () => debouncedParse.cancel();
  }, [input, debouncedParse]);

  const [saveOpen, setSaveOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleRequestDrill = (stringValue: string) => {
    const dirty = useJsonViewerStore.getState().isDirty();
    if (!dirty) {
      void drillIntoNested(stringValue);
      return;
    }
    setPendingDrillInto(stringValue);
    setConfirmOpen(true);
  };

  const onSaveAndOpen = () => {
    // Keep pendingDrillInto set; the SaveDialog flow will pick it up after
    // a successful save and complete the drill.
    setConfirmOpen(false);
    setSaveOpen(true);
  };

  const onDiscardAndOpen = async () => {
    const queued = pendingDrillInto;
    setPendingDrillInto(null);
    setConfirmOpen(false);
    if (queued !== null) {
      await drillIntoNested(queued);
    }
  };

  const onCancelDrill = () => {
    setPendingDrillInto(null);
    setConfirmOpen(false);
  };

  return (
    <div className="h-full flex flex-col">
      <Toolbar onOpenSave={() => setSaveOpen(true)} />
      {unescapeLayers > 0 && (
        <div className="px-3 py-1 text-xs text-[color:var(--text-muted)] bg-[color:var(--bg-base)] border-b border-[color:var(--border)]">
          {t("json_viewer.auto_unescape_pill", { n: unescapeLayers })}
        </div>
      )}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <div className="flex-1 min-w-0 border-r border-[color:var(--border)] overflow-hidden">
          <JsonEditor
            value={input}
            onChange={setInput}
            diagnostic={parseError}
          />
        </div>
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <SearchBar />
          <div className="flex-1 min-h-0 overflow-hidden">
            <Tree onRequestDrill={handleRequestDrill} />
          </div>
        </div>
      </div>
      <SaveDialogHost
        open={saveOpen}
        onClose={() => {
          setSaveOpen(false);
          // If the user opened SaveDialog via the drill flow but cancelled
          // out of it without saving, drop the pending drill so it doesn't
          // leak into a future save.
          if (pendingDrillInto !== null) {
            setPendingDrillInto(null);
          }
        }}
      />
      {confirmOpen && (
        <DrillConfirmDialog
          onSaveAndOpen={onSaveAndOpen}
          onDiscardAndOpen={() => void onDiscardAndOpen()}
          onCancel={onCancelDrill}
        />
      )}
    </div>
  );
}

interface DrillConfirmDialogProps {
  onSaveAndOpen(): void;
  onDiscardAndOpen(): void;
  onCancel(): void;
}

function DrillConfirmDialog({
  onSaveAndOpen,
  onDiscardAndOpen,
  onCancel,
}: DrillConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-40 bg-black/30 flex items-center justify-center">
      <div className="bg-[color:var(--bg-panel)] border border-[color:var(--border)] rounded-lg shadow w-[420px] p-4">
        <h2 className="text-sm font-semibold mb-2">
          {t("json_viewer.drill_confirm_heading")}
        </h2>
        <p className="text-sm text-[color:var(--text-muted)] mb-4">
          {t("json_viewer.drill_confirm_message")}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1 text-sm rounded border border-[color:var(--border)]"
          >
            {t("json_viewer.drill_cancel")}
          </button>
          <button
            type="button"
            onClick={onDiscardAndOpen}
            className="px-3 py-1 text-sm rounded border border-[color:var(--border)]"
          >
            {t("json_viewer.drill_discard_and_open")}
          </button>
          <button
            type="button"
            onClick={onSaveAndOpen}
            className="px-3 py-1 text-sm rounded bg-[color:var(--accent)] text-white"
          >
            {t("json_viewer.drill_save_and_open")}
          </button>
        </div>
      </div>
    </div>
  );
}
