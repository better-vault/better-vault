import { Cancel01Icon, HierarchyCircle01Icon, Note01Icon } from "@hugeicons/core-free-icons";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";

/**
 * The open notes as tabs. The open tab is raised in the page's own colour and
 * flares into it at the foot, like a folder tab; the others are quiet labels
 * that show a soft pill on hover. The graph tab sits apart, after a divider.
 */
export function NoteTabs({
  tabs,
  active,
  graphTab,
  labelOf,
  onShow,
  onClose,
}: {
  tabs: string[];
  active: string | null;
  graphTab: string;
  labelOf: (id: string) => string;
  onShow: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const { t } = useTranslation("notes");
  return (
    <div
      role="tablist"
      aria-label={t("title")}
      className="flex h-full min-w-0 flex-1 [scrollbar-width:none] items-end gap-0.5 overflow-x-auto ps-3"
    >
      {tabs.map((id, at) => {
        const selected = id === active;
        const graph = id === graphTab;
        return (
          <Fragment key={id}>
            {graph && at > 0 ? (
              <span aria-hidden className="mx-1.5 mb-3 h-5 w-px shrink-0 bg-border" />
            ) : null}
            <div
              role="tab"
              aria-selected={selected}
              data-active={selected ? "" : undefined}
              className="note-tab group"
            >
              <button
                type="button"
                onClick={() => onShow(id)}
                onAuxClick={(event) => event.button === 1 && onClose(id)}
                className="flex min-w-0 cursor-pointer items-center gap-2 outline-none focus-visible:underline"
              >
                <Icon
                  icon={graph ? HierarchyCircle01Icon : Note01Icon}
                  size={15}
                  className="shrink-0 opacity-80"
                />
                <span className="truncate">{labelOf(id)}</span>
              </button>
              <button
                type="button"
                onClick={() => onClose(id)}
                aria-label={t("tabs.close")}
                className="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground opacity-0 outline-none group-hover:opacity-100 group-data-active:opacity-100 hover:bg-foreground/10 hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon icon={Cancel01Icon} size={12} />
              </button>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
