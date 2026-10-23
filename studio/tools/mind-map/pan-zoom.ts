"use client";

import { useCallback, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import type { CanvasViewport } from "@/components/panelui/canvas";

const MIN = 0.15;
const MAX = 3;
const clamp = (zoom: number) => Math.min(MAX, Math.max(MIN, zoom));

/**
 * Drag to pan and wheel to zoom over a frame, as a Canvas viewport. Presses
 * that start on a button are left to the button.
 */
export function usePanZoom() {
  const frame = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; startX: number; startY: number } | null>(null);
  const [view, setView] = useState<CanvasViewport>({ x: 0, y: 0, zoom: 1 });

  /** Zooms around a point of the frame, so what is under it stays put. */
  const zoomAt = useCallback((factor: number, pointX?: number, pointY?: number) => {
    const box = frame.current?.getBoundingClientRect();
    const px = pointX ?? (box ? box.width / 2 : 0);
    const py = pointY ?? (box ? box.height / 2 : 0);
    setView((current) => {
      const zoom = clamp(current.zoom * factor);
      const ratio = zoom / current.zoom;
      return { zoom, x: px - (px - current.x) * ratio, y: py - (py - current.y) * ratio };
    });
  }, []);

  /** Fits a content box of this size into the frame. */
  const fit = useCallback((width: number, height: number, maxZoom = 1.2) => {
    const box = frame.current?.getBoundingClientRect();
    if (!box || width <= 0 || height <= 0) return;
    const zoom = clamp(Math.min((box.width - 64) / width, (box.height - 64) / height, maxZoom));
    setView({ zoom, x: (box.width - width * zoom) / 2, y: (box.height - height * zoom) / 2 });
  }, []);

  const handlers = {
    onWheel: (event: WheelEvent) => {
      const box = frame.current?.getBoundingClientRect();
      if (!box) return;
      zoomAt(Math.exp(-event.deltaY * 0.0015), event.clientX - box.left, event.clientY - box.top);
    },
    onPointerDown: (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest("button, a")) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { x: view.x, y: view.y, startX: event.clientX, startY: event.clientY };
    },
    onPointerMove: (event: PointerEvent) => {
      const start = drag.current;
      if (!start) return;
      setView((current) => ({ ...current, x: start.x + event.clientX - start.startX, y: start.y + event.clientY - start.startY }));
    },
    onPointerUp: () => {
      drag.current = null;
    },
    onPointerCancel: () => {
      drag.current = null;
    },
  };

  return { frame, view, setView, zoomAt, fit, handlers };
}
