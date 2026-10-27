"use client";

import {
  FitToScreenIcon,
  Copy01Icon,
  MinusSignIcon,
  PencilEdit02Icon,
  PlusSignIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Markdown } from "@/components/chat/markdown";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Canvas } from "@/components/panelui/canvas";
import { Tabs } from "@/components/panelui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ToolViewerProps } from "@/studio/shared/form";
import { usePanZoom } from "@/studio/shared/pan-zoom";
import type { InfographicData } from "./definition";

/**
 * The picture on a canvas you can pan and zoom, and beside it the brief it
 * was drawn from, with citations: image models can misspell, the brief can't.
 */
export function InfographicViewer({
  title,
  data,
  onOpenPassage,
  onAnnotate,
}: ToolViewerProps<InfographicData>) {
  const { t } = useTranslation("studio");
  const { frame, view, zoomAt, fit, handlers } = usePanZoom();
  const { width, height } = data.image;
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fit(width, height, 2);
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(() => fit(width, height, 2));
    observer.observe(element);
    return () => observer.disconnect();
  }, [fit, frame, width, height]);

  const control =
    "flex size-9 cursor-pointer items-center justify-center text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      <Canvas
        viewport={view}
        className="relative min-h-[24rem] flex-1 rounded-3xl ring-1 ring-border"
      >
        <Canvas.Pattern variant="dots" fade="edges" />
        <Canvas.Content className="absolute inset-0">
          <div
            ref={frame}
            className="absolute inset-0 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
            {...handlers}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a data URL made by the image model */}
            <img
              src={data.image.dataUrl}
              alt={title}
              draggable={false}
              width={width}
              height={height}
              className="absolute top-0 left-0 max-w-none origin-top-left rounded-lg shadow-lg ring-1 ring-border select-none"
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
            />
          </div>
          {onAnnotate ? (
            <Button
              variant="outline"
              size="sm"
              shape="pill"
              className="absolute end-4 top-4"
              onClick={onAnnotate}
            >
              <Icon icon={PencilEdit02Icon} size={16} />
              {t("viewer.annotate")}
            </Button>
          ) : null}
          <div className="absolute end-4 bottom-4 flex flex-col overflow-hidden rounded-full bg-popover shadow-sm ring-1 ring-border">
            <button
              type="button"
              className={control}
              aria-label={t("mind-map.viewer.zoomIn")}
              title={t("mind-map.viewer.zoomIn")}
              onClick={() => zoomAt(1.25)}
            >
              <Icon icon={PlusSignIcon} size={16} />
            </button>
            <button
              type="button"
              className={control}
              aria-label={t("mind-map.viewer.zoomOut")}
              title={t("mind-map.viewer.zoomOut")}
              onClick={() => zoomAt(0.8)}
            >
              <Icon icon={MinusSignIcon} size={16} />
            </button>
            <button
              type="button"
              className={control}
              aria-label={t("mind-map.viewer.fit")}
              title={t("mind-map.viewer.fit")}
              onClick={() => fit(width, height, 2)}
            >
              <Icon icon={FitToScreenIcon} size={16} />
            </button>
          </div>
        </Canvas.Content>
      </Canvas>

      <aside className="relative h-[30rem] shrink-0 rounded-3xl border bg-card lg:h-auto lg:w-[22rem]">
        <Tabs defaultValue="brief" className="absolute inset-0 gap-0 p-2">
          <Tabs.List className="w-full *:flex-1">
            <Tabs.Trigger value="brief">{t("infographic.viewer.brief")}</Tabs.Trigger>
            <Tabs.Trigger value="details">{t("infographic.viewer.details")}</Tabs.Trigger>
          </Tabs.List>
          <Tabs.Content value="brief" className="min-h-0">
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-4 p-2 pt-4">
                <p className="rounded-xl bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
                  {t("infographic.viewer.spelling")}
                </p>
                <div className="px-1">
                  <h3 className="text-base font-semibold">{data.brief.title}</h3>
                  {data.brief.subtitle ? (
                    <p className="mt-0.5 text-sm text-muted-foreground">{data.brief.subtitle}</p>
                  ) : null}
                </div>
                {data.brief.numbers.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2">
                    {data.brief.numbers.map((number, at) => (
                      <div key={at} className="rounded-xl bg-muted/70 px-3 py-2">
                        <p className="text-lg font-semibold tabular-nums">{number.value}</p>
                        <Markdown
                          text={number.label}
                          passages={data.passages}
                          onCite={onOpenPassage}
                          className="text-xs text-muted-foreground"
                        />
                      </div>
                    ))}
                  </div>
                ) : null}
                {data.brief.sections.map((section, at) => (
                  <section key={at} className="px-1">
                    <h4 className="text-sm font-medium">{section.heading}</h4>
                    <ul className="mt-1.5 flex flex-col gap-1.5">
                      {section.points.map((point, index) => (
                        <li key={index} className="flex gap-2 text-sm text-muted-foreground">
                          <span
                            aria-hidden
                            className="mt-2 size-1.5 shrink-0 rounded-full bg-info"
                          />
                          <Markdown
                            text={point.text || point.short}
                            passages={data.passages}
                            onCite={onOpenPassage}
                            bare
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
                {data.brief.takeaway ? (
                  <p className="border-t px-1 pt-3 text-sm font-medium">{data.brief.takeaway}</p>
                ) : null}
              </div>
            </ScrollArea>
          </Tabs.Content>
          <Tabs.Content value="details" className="min-h-0">
            <ScrollArea className="h-full">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-3 pt-4 text-sm">
                <dt className="text-muted-foreground">{t("infographic.viewer.model")}</dt>
                <dd className="truncate">{data.imageModel.modelId}</dd>
                <dt className="text-muted-foreground">{t("infographic.orientation")}</dt>
                <dd>{t(`infographic.orientations.${data.orientation}`)}</dd>
                <dt className="text-muted-foreground">{t("infographic.viewer.size")}</dt>
                <dd className="tabular-nums">
                  {width} × {height}
                </dd>
              </dl>
              <div className="px-3 pb-3">
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("infographic.viewer.prompt")}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void navigator.clipboard.writeText(data.prompt).then(() => {
                        setCopied(true);
                        window.setTimeout(() => setCopied(false), 1500);
                      });
                    }}
                  >
                    <Icon icon={copied ? Tick02Icon : Copy01Icon} size={14} />
                    {copied ? t("viewer.copied") : t("viewer.copy")}
                  </Button>
                </div>
                <pre className="rounded-xl bg-muted/70 p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {data.prompt}
                </pre>
              </div>
            </ScrollArea>
          </Tabs.Content>
        </Tabs>
      </aside>
    </div>
  );
}
