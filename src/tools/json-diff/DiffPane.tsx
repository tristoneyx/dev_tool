import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { VariableSizeList, type ListChildComponentProps } from "react-window";
import { useJsonDiffStore } from "./store";
import { flattenDiff, type VisibleDiffNode } from "./flatten";
import { DiffNode } from "./DiffNode";

const ROW_HEIGHT = 28;

/** Closer-row punctuation color matches the opener brace/bracket. */
function CloserRow({ visible }: { visible: VisibleDiffNode }) {
  return (
    <div
      className="text-sm font-mono leading-7 text-[color:var(--json-punctuation)] cursor-default"
      style={{
        height: ROW_HEIGHT,
        paddingLeft: `${visible.depth * 16 + 8 + 16}px`,
      }}
    >
      {visible.closer}
    </div>
  );
}

/** Measure the bounding box of a parent so react-window gets explicit dims. */
function useElementSize(): [
  React.RefObject<HTMLDivElement>,
  { width: number; height: number },
] {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setSize({ width, height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

export function DiffPane(): JSX.Element {
  const { t } = useTranslation();
  const tree = useJsonDiffStore((s) => s.tree);
  const collapseSet = useJsonDiffStore((s) => s.collapseSet);
  const showOnlyDiffs = useJsonDiffStore((s) => s.showOnlyDiffs);
  const searchQuery = useJsonDiffStore((s) => s.searchQuery);
  const toggleCollapse = useJsonDiffStore((s) => s.toggleCollapse);

  const listRef = useRef<VariableSizeList | null>(null);
  const [hostRef, size] = useElementSize();

  const visible: VisibleDiffNode[] = useMemo(() => {
    if (!tree) return [];
    return flattenDiff(tree.root, {
      collapseSet,
      showOnlyDiffs,
      searchQuery,
    });
  }, [tree, collapseSet, showOnlyDiffs, searchQuery]);

  const itemSize = useCallback(() => ROW_HEIGHT, []);

  // Reset the virtualizer when the visible set changes so any cached row
  // metrics get dropped.
  useEffect(() => {
    listRef.current?.resetAfterIndex(0);
  }, [visible]);

  const renderRow = ({ index, style }: ListChildComponentProps) => {
    const v = visible[index];
    if (v.closer) {
      return (
        <div style={style}>
          <CloserRow visible={v} />
        </div>
      );
    }
    return (
      <div style={style}>
        <DiffNode
          visible={v}
          onToggleCollapse={(id) => {
            toggleCollapse(id);
            listRef.current?.resetAfterIndex(0);
          }}
          searchQuery={searchQuery}
        />
      </div>
    );
  };

  return (
    <div ref={hostRef} className="h-full w-full overflow-hidden relative">
      {!tree && (
        <div className="absolute inset-0 flex items-center justify-center text-[color:var(--text-muted)] text-sm pointer-events-none">
          {t("json_diff.tree_empty")}
        </div>
      )}
      {tree && size.width > 0 && size.height > 0 && (
        <VariableSizeList
          ref={listRef}
          height={size.height}
          width={size.width}
          itemCount={visible.length}
          itemSize={itemSize}
          overscanCount={20}
        >
          {renderRow}
        </VariableSizeList>
      )}
    </div>
  );
}
