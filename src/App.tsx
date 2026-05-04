import { type ReactElement, useState } from "react";
import { useTranslation } from "react-i18next";
import { TitleBar } from "./shell/TitleBar";
import { ToastHost } from "./shell/ToastHost";
import { HistoryDrawer } from "./history/HistoryDrawer";
import { useActiveToolStore } from "./shell/activeToolStore";
import { JsonViewer } from "./tools/json-viewer";
import { JsonDiff } from "./tools/json-diff";
import { Base64 } from "./tools/base64";
import { UrlParser } from "./tools/url-parser";
import type { HistoryItem, ToolKind } from "./types/ipc";
import { useToastStore } from "./shell/toastStore";
import { useJsonViewerStore } from "./tools/json-viewer/store";
import { useJsonDiffStore } from "./tools/json-diff/store";
import { useBase64Store } from "./tools/base64/store";
import { useUrlParserStore } from "./tools/url-parser/store";

// `ToolKind` still includes the deprecated `"escape"` value so old history
// items keep deserializing — the partial here lets us drop the UI without
// breaking the type.
const tools: Partial<Record<ToolKind, () => ReactElement>> = {
  json_viewer: JsonViewer,
  json_diff: JsonDiff,
  base64: Base64,
  url_parser: UrlParser,
};

export default function App() {
  const { t } = useTranslation();
  const active = useActiveToolStore((s) => s.active);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const push = useToastStore((s) => s.push);

  const ActiveTool = tools[active] ?? JsonViewer;

  function handleLoad(item: HistoryItem) {
    if (item.content.tool === "json_viewer") {
      useJsonViewerStore.getState().setInput(item.content.input);
      useJsonViewerStore.getState().setLoadedHistoryId(item.id);
      useJsonViewerStore.getState().setSavedInput(item.content.input);
      void useJsonViewerStore.getState().parse(item.content.input);
      push("success", t("common.loaded_history_toast", { title: item.title }));
      return;
    }
    if (item.content.tool === "json_diff") {
      useJsonDiffStore.getState().setLeft(item.content.left);
      useJsonDiffStore.getState().setRight(item.content.right);
      useJsonDiffStore.getState().setLoadedHistoryId(item.id);
      useJsonDiffStore.getState().setSaved(item.content.left, item.content.right);
      void useJsonDiffStore.getState().compare();
      push("success", t("common.loaded_history_toast", { title: item.title }));
      return;
    }
    if (item.content.tool === "base64") {
      useBase64Store.getState().setInput(item.content.input);
      useBase64Store.getState().setDirection(item.content.direction);
      useBase64Store.getState().setUrlSafe(item.content.url_safe);
      useBase64Store.getState().setLoadedHistoryId(item.id);
      useBase64Store
        .getState()
        .setSaved(item.content.input, item.content.direction, item.content.url_safe);
      push("success", t("common.loaded_history_toast", { title: item.title }));
      return;
    }
    if (item.content.tool === "url_parser") {
      useUrlParserStore.getState().setUrl(item.content.url);
      useUrlParserStore.getState().setLoadedHistoryId(item.id);
      useUrlParserStore.getState().setSaved(item.content.url);
      push("success", t("common.loaded_history_toast", { title: item.title }));
      return;
    }
    // `escape` history items (and any future deprecated tool) fall through
    // here — the UI no longer has a place to load them into.
    push("info", t("common.loaded_history_toast", { title: item.title }));
  }

  return (
    <div className="h-screen flex flex-col bg-[color:var(--bg-base)] text-[color:var(--text-primary)]">
      <TitleBar onToggleHistory={() => setDrawerOpen((v) => !v)} />
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-hidden">
          <ActiveTool />
        </main>
        <HistoryDrawer open={drawerOpen} tool={active} onLoad={handleLoad} />
      </div>
      <ToastHost />
    </div>
  );
}
