import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Editor } from "./Editor";
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

  const debouncedParse = useMemo(
    () => debounce((text: string) => void parse(text), PARSE_DEBOUNCE_MS),
    [parse],
  );

  useEffect(() => {
    debouncedParse(input);
    return () => debouncedParse.cancel();
  }, [input, debouncedParse]);

  const [saveOpen, setSaveOpen] = useState(false);

  return (
    <div className="h-full flex flex-col">
      <Toolbar onOpenSave={() => setSaveOpen(true)} />
      {unescapeLayers > 0 && (
        <div className="px-3 py-1 text-xs text-[color:var(--text-muted)] bg-[color:var(--bg-base)] border-b border-[color:var(--border)]">
          {t("json_viewer.auto_unescape_pill", { n: unescapeLayers })}
        </div>
      )}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 border-r border-[color:var(--border)]">
          <Editor
            value={input}
            onChange={setInput}
            diagnostic={parseError}
          />
        </div>
        <div className="flex-1 flex flex-col">
          <SearchBar />
          <div className="flex-1 overflow-hidden">
            <Tree />
          </div>
        </div>
      </div>
      <SaveDialogHost open={saveOpen} onClose={() => setSaveOpen(false)} />
    </div>
  );
}
