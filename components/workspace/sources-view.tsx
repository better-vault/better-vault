"use client";

import { Add01Icon, Book02Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { SourceRow } from "@/components/sources/source-row";
import { Checkbox } from "@/components/ui/checkbox";
import { setAllSourcesSelected, useSources } from "@/lib/db/sources";
import { useWorkspace } from "./workspace-context";

/** The Sources tab: everything in the notebook, and which of it is used. */
export function SourcesView() {
  const { t } = useTranslation("sources");
  const { notebook, setAddSourceOpen, readSource } = useWorkspace();
  const sources = useSources(notebook.id);
  if (!sources) return null;

  const selected = sources.filter((source) => source.selected).length;
  const all = sources.length > 0 && selected === sources.length;

  return (
    <div className="h-full overflow-y-auto px-4 pb-40 sm:px-6">
      <div className="mx-auto max-w-2xl pt-4">
        <div className="flex items-end justify-between gap-4 px-1">
          <div className="min-w-0">
            <h2 className="text-xl font-semibold tracking-tight">{t("title")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("description")}</p>
          </div>
          <Button shape="pill" className="shrink-0" onClick={() => setAddSourceOpen(true)}>
            <Icon icon={Add01Icon} />
            {t("add")}
          </Button>
        </div>

        {sources.length === 0 ? (
          <button
            type="button"
            onClick={() => setAddSourceOpen(true)}
            className="mt-8 flex w-full cursor-pointer flex-col items-center gap-3 rounded-3xl border border-dashed px-6 py-14 text-center outline-none transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Icon icon={Book02Icon} size={22} />
            </span>
            <span className="font-medium">{t("empty.title")}</span>
            <span className="max-w-sm text-sm text-muted-foreground">{t("empty.body")}</span>
          </button>
        ) : (
          <>
            <label className="mt-6 flex cursor-pointer items-center gap-3 px-3 py-2 text-sm">
              <Checkbox
                checked={all}
                indeterminate={selected > 0 && !all}
                onCheckedChange={(checked) => void setAllSourcesSelected(notebook.id, checked)}
              />
              <span className="font-medium">{t("selectAll")}</span>
              <span className="ms-auto text-xs text-muted-foreground">
                {t("selected", { selected, total: sources.length })}
              </span>
            </label>
            <ul className="flex flex-col gap-0.5">
              {sources.map((source) => (
                <li key={source.id}>
                  <SourceRow source={source} onRead={() => readSource(source.id)} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
