"use client";

import {
  Alert02Icon,
  ArrowLeft01Icon,
  Delete02Icon,
  Loading03Icon,
  MoreVerticalIcon,
  PencilEdit01Icon,
  RepeatIcon,
} from "@hugeicons/core-free-icons";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Menu } from "@/components/panelui/menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { useOutput } from "@/lib/db/outputs";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toolClients } from "@/studio/client";
import { toolDefinitions } from "@/studio/definitions";
import { isStudioToolId, studioTools } from "@/studio/tools";
import { DownloadMenu } from "./download-menu";
import { useStudioRunner } from "./studio-runner";

/** One Studio output, full size in the Studio tab. */
export function OutputViewer({ id }: { id: string }) {
  const { t, i18n } = useTranslation("studio");
  const { t: tCommon } = useTranslation();
  const { closeOutput, readSource, requestOutputAction } = useWorkspace();
  const runner = useStudioRunner();
  const output = useOutput(id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gone = output === null || (output !== undefined && !isStudioToolId(output.toolId));

  // A deleted output, here or in another tab, goes back to the list.
  useEffect(() => {
    if (gone) closeOutput();
  }, [gone, closeOutput]);

  if (!output || !isStudioToolId(output.toolId)) return null;

  const tool = studioTools[output.toolId];
  const client = toolClients[output.toolId];
  const definition = toolDefinitions[output.toolId];
  const parsed = output.status === "ready" ? definition?.data.safeParse(output.data) : undefined;

  return (
    <ScrollArea className="h-full" viewportRef={scrollRef}>
      <div className="flex min-h-full flex-col px-4 pb-6 sm:px-6">
        <div
          className={cn(
            "mx-auto flex w-full flex-1 flex-col pt-2",
            client?.wideViewer ? "max-w-7xl" : client?.fill ? "max-w-6xl" : "max-w-4xl",
          )}
        >
          <header className="flex flex-wrap items-center gap-3 pb-5">
            <Button variant="ghost" size="sm" className="-ms-2" onClick={closeOutput}>
              <Icon icon={ArrowLeft01Icon} size={16} className="rtl:rotate-180" />
              {t("viewer.back")}
            </Button>
            <div className="flex min-w-0 basis-full items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-muted">
                <Icon icon={tool.icon} size={20} className={tool.tint} />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-xl font-semibold tracking-tight">{output.title}</h2>
                <p className="truncate text-xs text-muted-foreground">
                  {t("viewer.meta", {
                    sources: tCommon("sourceCount", { count: output.sourceIds.length }),
                    model: output.model?.modelId ?? "",
                    time: formatRelativeTime(output.createdAt, i18n.language),
                  })}
                </p>
              </div>
              {parsed?.success && definition?.exports?.length ? (
                <DownloadMenu
                  title={output.title}
                  data={parsed.data}
                  options={definition.exports}
                />
              ) : null}
              <Menu>
                <Menu.Trigger
                  aria-label={t("viewer.actions")}
                  className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Icon icon={MoreVerticalIcon} size={16} />
                </Menu.Trigger>
                <Menu.Content align="end">
                  <Menu.Item onClick={() => requestOutputAction({ kind: "rename", output })}>
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
          </header>

          {output.status === "generating" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
              <Icon icon={Loading03Icon} size={28} className="animate-spin text-muted-foreground" />
              <p className="font-medium">{t("status.generating")}</p>
              <p className="max-w-sm text-sm text-muted-foreground">{t("view.generatingBody")}</p>
            </div>
          ) : output.status === "error" || !parsed?.success || !client ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-20 text-center">
              <Icon icon={Alert02Icon} size={28} className="text-destructive" />
              <p className="font-medium">{t("view.failedTitle")}</p>
              {output.error ? (
                <p className="max-w-md text-sm text-muted-foreground">{output.error}</p>
              ) : null}
              <Button shape="pill" className="mt-2" onClick={() => void runner.retry(output)}>
                <Icon icon={RepeatIcon} size={16} />
                {t("view.retry")}
              </Button>
            </div>
          ) : (
            <client.Viewer
              title={output.title}
              data={parsed.data}
              scrollRef={scrollRef}
              onOpenPassage={(passage) => readSource(passage.sourceId, passage.chunkId)}
            />
          )}
        </div>
      </div>
    </ScrollArea>
  );
}
