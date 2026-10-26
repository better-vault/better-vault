"use client";

import { FitToScreenIcon, MinusSignIcon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Canvas } from "@/components/panelui/canvas";
import { usePanZoom } from "./pan-zoom";
import { renderDiagram } from "./render";

/** A Mermaid diagram drawn by Pele, on a dotted canvas you can drag and zoom. */
export function DiagramView({ mermaid }: { mermaid: string }) {
  const { t } = useTranslation("studio");
  const drawn = useMemo(() => renderDiagram(mermaid), [mermaid]);
  const { frame, view, zoomAt, fit, handlers } = usePanZoom();
  const size = useRef({ width: 0, height: 0 });

  useEffect(() => {
    if ("svg" in drawn) size.current = { width: drawn.width, height: drawn.height };
    fit(size.current.width, size.current.height);
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(() => fit(size.current.width, size.current.height));
    observer.observe(element);
    return () => observer.disconnect();
  }, [fit, frame, drawn]);

  const control =
    "flex size-9 cursor-pointer items-center justify-center text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset";

  return (
    <Canvas viewport={view} className="min-h-[460px] flex-1 rounded-3xl ring-1 ring-border">
      <Canvas.Pattern variant="dots" fade="edges" />
      {/* Absolute: the viewer's height is a minimum, so a percentage height would be 0. */}
      <Canvas.Content className="absolute inset-0">
        {"error" in drawn ? (
          <p className="p-6 text-sm text-destructive">
            {t("mind-map.viewer.renderError", { error: drawn.error })}
          </p>
        ) : (
          <>
            <div
              ref={frame}
              className="absolute inset-0 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
              {...handlers}
            >
              <div
                // Physical left: the pan and zoom maths work in screen coordinates.
                className="pele absolute top-0 left-0 origin-top-left [&_svg]:block"
                style={{
                  transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
                  width: drawn.width,
                  height: drawn.height,
                }}
                // Pele escapes every label it draws; links and images are off.
                dangerouslySetInnerHTML={{ __html: drawn.svg }}
              />
            </div>
            <div className="absolute right-4 bottom-4 flex flex-col overflow-hidden rounded-full bg-popover shadow-sm ring-1 ring-border">
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
                onClick={() => zoomAt(1 / 1.25)}
              >
                <Icon icon={MinusSignIcon} size={16} />
              </button>
              <button
                type="button"
                className={control}
                aria-label={t("mind-map.viewer.fit")}
                title={t("mind-map.viewer.fit")}
                onClick={() => fit(size.current.width, size.current.height)}
              >
                <Icon icon={FitToScreenIcon} size={16} />
              </button>
            </div>
          </>
        )}
      </Canvas.Content>
    </Canvas>
  );
}
