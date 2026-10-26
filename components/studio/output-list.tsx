"use client";

import {
  Alert02Icon,
  Delete02Icon,
  Loading03Icon,
  MoreVerticalIcon,
  PencilEdit01Icon,
} from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Menu } from "@/components/panelui/menu";
import { useWorkspace } from "@/components/workspace/workspace-context";
import type { StudioOutput } from "@/lib/db/database";
import { useOutputs } from "@/lib/db/outputs";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isStudioToolId, studioTools } from "@/studio/tools";

/** The outputs created in a notebook, newest first. */
export function OutputList({
  notebookId,
  onOpen,
}: {
  notebookId: string;
  onOpen: (output: StudioOutput) => void;
}) {
  const { t } = useTranslation("studio");
  const outputs = useOutputs(notebookId);
  if (!outputs) return null;
  if (outputs.length === 0) {
    return <p className="px-1 py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>;
  }
  return (
    <ul className="-mx-2 flex flex-col gap-0.5">
      {outputs.map((output) => (
        <li key={output.id}>
          <OutputRow output={output} onOpen={() => onOpen(output)} />
        </li>
      ))}
    </ul>
  );
}

/**
 * One output: its tool, title and state. Rename and delete open their dialogs
 * in the workspace, so a sheet showing this row closes first.
 */
export function OutputRow({ output, onOpen }: { output: StudioOutput; onOpen: () => void }) {
  const { t, i18n } = useTranslation("studio");
  const { t: tCommon } = useTranslation();
  const { requestOutputAction } = useWorkspace();
  const tool = isStudioToolId(output.toolId) ? studioTools[output.toolId] : null;

  const meta =
    output.status === "generating"
      ? t("status.generating")
      : output.status === "error"
        ? (output.error ?? t("status.failed"))
        : output.model
          ? `${tCommon("sourceCount", { count: output.sourceIds.length })} · ${formatRelativeTime(output.createdAt, i18n.language)}`
          : t("viewer.metaLocal", { time: formatRelativeTime(output.updatedAt, i18n.language) });

  return (
    <div className="group/output flex items-center gap-1 rounded-2xl pe-1 transition-colors hover:bg-muted">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {tool ? <Icon icon={tool.icon} size={20} className={cn("shrink-0", tool.tint)} /> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{output.title}</span>
          <span
            className={cn(
              "block truncate text-xs text-muted-foreground",
              output.status === "error" && "text-destructive",
            )}
          >
            {meta}
          </span>
        </span>
        {output.status === "generating" ? (
          <Icon
            icon={Loading03Icon}
            size={16}
            className="shrink-0 animate-spin text-muted-foreground"
          />
        ) : output.status === "error" ? (
          <Icon icon={Alert02Icon} size={16} className="shrink-0 text-destructive" />
        ) : null}
      </button>
      <Menu>
        <Menu.Trigger
          aria-label={t("outputMenu", { title: output.title })}
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-foreground/10 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon icon={MoreVerticalIcon} size={16} />
        </Menu.Trigger>
        <Menu.Content align="end">
          <Menu.Item
            onClick={() => requestOutputAction({ kind: "rename", output })}
            disabled={output.status !== "ready"}
          >
            <Icon icon={PencilEdit01Icon} />
            {tCommon("actions.rename")}
          </Menu.Item>
          <Menu.Item
            variant="destructive"
            onClick={() => requestOutputAction({ kind: "delete", output })}
          >
            <Icon icon={Delete02Icon} />
            {tCommon("actions.delete")}
          </Menu.Item>
        </Menu.Content>
      </Menu>
    </div>
  );
}
