"use client";

import {
  Copy01Icon,
  Download04Icon,
  FitToScreenIcon,
  ZoomInAreaIcon,
  ZoomOutAreaIcon,
} from "@hugeicons/core-free-icons";
import { render } from "pele";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Canvas, type CanvasViewport } from "@/components/panelui/canvas";
import { downloadText, fileNameFor } from "@/lib/format";
import type { ToolViewerProps } from "@/studio/shared/form";
import type { MindMapData } from "./definition";

const MIN = 0.2;
const MAX = 4;
const clamp = (zoom: number) => Math.min(MAX, Math.max(MIN, zoom));

function draw(mermaid: string): { svg: string; width: number; height: number } | { error: string } {
  try {
    // Links and images off: the code comes from a model.
    const result = render(mermaid, { links: false, images: false, responsive: false });
    return { svg: result.svg, width: result.width, height: result.height };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

/** The diagram on a dotted canvas you can drag and zoom. */
export function MindMapViewer({ title, data }: ToolViewerProps<MindMapData>) {
  const { t } = useTranslation("studio");
  const drawn = useMemo(() => draw(data.mermaid), [data.mermaid]);
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const [view, setView] = useState<CanvasViewport>({ x: 0, y: 0, zoom: 1 });

  const fit = useCallback(() => {
    const box = frame.current?.getBoundingClientRect();
    if (!box || "error" in drawn) return;
    const zoom = clamp(Math.min((box.width - 48) / drawn.width, (box.height - 48) / drawn.height, 1.5));
    setView({ zoom, x: (box.width - drawn.width * zoom) / 2, y: (box.height - drawn.height * zoom) / 2 });
  }, [drawn]);

  useEffect(() => {
    fit();
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(() => fit());
    observer.observe(element);
    return () => observer.disconnect();
  }, [fit]);

  /** Zooms around a point of the frame, so what is under it stays put. */
  const zoomAt = (factor: number, pointX?: number, pointY?: number) => {
    const box = frame.current?.getBoundingClientRect();
    const px = pointX ?? (box ? box.width / 2 : 0);
    const py = pointY ?? (box ? box.height / 2 : 0);
    setView((current) => {
      const zoom = clamp(current.zoom * factor);
      const ratio = zoom / current.zoom;
      return { zoom, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
    });
  };

  const onWheel = (event: WheelEvent) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box) return;
    zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX - box.left, event.clientY - box.top);
  };

  const onPointerDown = (event: PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: view.x, y: view.y, startX: event.clientX, startY: event.clientY };
  };
  const onPointerMove = (event: PointerEvent) => {
    const start = drag.current;
    if (!start) return;
    setView((current) => ({
      ...current,
      x: start.x + event.clientX - start.startX,
      y: start.y + event.clientY - start.startY,
    }));
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-end gap-1">
        <Button variant="ghost" size="icon-sm" aria-label={t("mind-map.viewer.zoomOut")} title={t("mind-map.viewer.zoomOut")} onClick={() => zoomAt(1 / 1.25)}>
          <Icon icon={ZoomOutAreaIcon} size={16} />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={t("mind-map.viewer.zoomIn")} title={t("mind-map.viewer.zoomIn")} onClick={() => zoomAt(1.25)}>
          <Icon icon={ZoomInAreaIcon} size={16} />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={t("mind-map.viewer.fit")} title={t("mind-map.viewer.fit")} onClick={fit}>
          <Icon icon={FitToScreenIcon} size={16} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(data.mermaid);
            toast.success(t("viewer.copied"));
          }}
        >
          <Icon icon={Copy01Icon} size={16} />
          {t("mind-map.viewer.copyCode")}
        </Button>
        {"svg" in drawn ? (
          <Button variant="ghost" size="sm" onClick={() => downloadText(drawn.svg, fileNameFor(title, "svg"), "image/svg+xml")}>
            <Icon icon={Download04Icon} size={16} />
            {t("mind-map.viewer.downloadSvg")}
          </Button>
        ) : null}
      </div>
      <Canvas viewport={view} className="min-h-[420px] flex-1 rounded-3xl ring-1 ring-border">
        <Canvas.Pattern variant="dots" fade="edges" />
        <Canvas.Content>
          {"error" in drawn ? (
            <p className="p-6 text-sm text-destructive">{t("mind-map.viewer.renderError", { error: drawn.error })}</p>
          ) : (
            <div
              ref={frame}
              className="absolute inset-0 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
              onWheel={onWheel}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <div
                // Physical left: the pan and zoom maths work in screen coordinates.
                className="pele absolute left-0 top-0 origin-top-left [&_svg]:block"
                style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`, width: drawn.width, height: drawn.height }}
                // Pele escapes every label it draws; links and images are off.
                dangerouslySetInnerHTML={{ __html: drawn.svg }}
              />
            </div>
          )}
        </Canvas.Content>
      </Canvas>
    </div>
  );
}
