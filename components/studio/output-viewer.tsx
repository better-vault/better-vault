"use client";

import {
  Alert02Icon,
  ArrowLeft01Icon,
  Delete02Icon,
  Loading03Icon,
  MoreVerticalIcon,
  PencilEdit01Icon,
  RepeatIcon,
  WhiteboardIcon,
} from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Menu } from "@/components/panelui/menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { updateOutputData, useOutput } from "@/lib/db/outputs";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toolClients } from "@/studio/client";
import { toolDefinitions } from "@/studio/definitions";
import { isStudioToolId, studioTools } from "@/studio/tools";
import { isFileExport } from "@/studio/types";
import type { OutputChrome } from "@/studio/shared/form";
import { DownloadMenu } from "./download-menu";
import { useStudioRunner } from "./studio-runner";
import { useExporter } from "./use-exporter";

/** One Studio output, full size in the Studio tab. */
export function OutputViewer({ id }: { id: string }) {
  const { t, i18n } = useTranslation("studio");
  const { t: tCommon } = useTranslation();
  const { closeOutput, openOutput, readSource, requestOutputAction } = useWorkspace();
  const runner = useStudioRunner();
  const output = useOutput(id);
  const scrollRef = useRef<HTMLDivElement>(null);
  const saveData = useCallback(
    async (data: unknown) => {
      await updateOutputData(id, data);
    },
    [id],
  );
  const [annotating, setAnnotating] = useState(false);
  const exporter = useExporter();
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
  const local = definition?.local !== undefined;
  const png = local
    ? undefined
    : definition?.exports?.filter(isFileExport).find((option) => option.format === "png");

  // Annotate: the output's picture, locked on a new whiteboard, to draw over it.
  const annotate =
    png && parsed?.success
      ? async () => {
          if (annotating) return;
          setAnnotating(true);
          const toastId = toast.loading(t("whiteboard.annotating"));
          try {
            const [{ prepareImage, boardFromImage }, blob] = await Promise.all([
              import("@/studio/tools/whiteboard/images"),
              png.build(output.title, parsed.data, {
                question: t("export.question"),
                answer: t("export.answer"),
                answerKey: t("export.answerKey"),
                sources: t("export.sources"),
              }),
            ]);
            const data = boardFromImage(await prepareImage(blob), {
              outputId: output.id,
              toolId: output.toolId,
            });
            const id = await runner.createLocal("whiteboard", {
              title: t("whiteboard.annotateTitle", { title: output.title }),
              data,
              sourceIds: output.sourceIds,
            });
            toast.dismiss(toastId);
            openOutput(id);
          } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error), { id: toastId });
          } finally {
            setAnnotating(false);
          }
        }
      : undefined;

  const meta = output.model
    ? t("viewer.meta", {
        sources: tCommon("sourceCount", { count: output.sourceIds.length }),
        model: output.model.modelId,
        time: formatRelativeTime(output.createdAt, i18n.language),
      })
    : t("viewer.metaLocal", { time: formatRelativeTime(output.updatedAt, i18n.language) });
  // Shown only when the viewer is: a board that can't be read keeps the header, to delete it.
  const immersive = client?.immersive === true && parsed?.success === true;

  // An immersive viewer shows the title and actions itself.
  const chrome: OutputChrome | undefined = immersive
    ? {
        icon: tool.icon,
        tint: tool.tint,
        title: output.title,
        meta,
        busy: exporter.busy,
        downloads:
          parsed?.success && definition?.exports
            ? definition.exports.map((option) => ({
                format: option.format,
                label: t(`viewer.formats.${option.format}`),
                onSelect: () => void exporter.save(output.title, parsed.data, option),
              }))
            : [],
        onRename: () => requestOutputAction({ kind: "rename", output }),
        onDelete: () => requestOutputAction({ kind: "delete", output }),
      }
    : undefined;

  return (
    <ScrollArea className="h-full" viewportRef={scrollRef}>
      <div
        className={cn(
          "flex min-h-full flex-col",
          client?.bleed ? "px-3 pb-3" : "px-4 pb-6 sm:px-6",
        )}
      >
        <div
          className={cn(
            "mx-auto flex w-full flex-1 flex-col pt-2",
            client?.bleed
              ? "max-w-none"
              : client?.wideViewer
                ? "max-w-7xl"
                : client?.fill
                  ? "max-w-6xl"
                  : "max-w-4xl",
          )}
        >
          {immersive ? null : (
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
                  <p className="truncate text-xs text-muted-foreground">{meta}</p>
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
                    {annotate ? (
                      <Menu.Item disabled={annotating} onClick={() => void annotate()}>
                        <Icon icon={WhiteboardIcon} />
                        {t("viewer.annotate")}
                      </Menu.Item>
                    ) : null}
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
          )}

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
              {local ? null : (
                <Button shape="pill" className="mt-2" onClick={() => void runner.retry(output)}>
                  <Icon icon={RepeatIcon} size={16} />
                  {t("view.retry")}
                </Button>
              )}
            </div>
          ) : (
            <client.Viewer
              outputId={output.id}
              onDataChange={saveData}
              onAnnotate={annotate ? () => void annotate() : undefined}
              chrome={chrome}
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
