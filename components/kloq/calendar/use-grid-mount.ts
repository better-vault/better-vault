import { type RefObject, useLayoutEffect } from "react";
import { EASE_OUT, ms, prefersReducedMotion } from "../lib/springs";
import { useKloqSettings } from "./settings-context";

export function useGridMount({
  rootRef,
  scrollRef,
  canvasRef,
  laneRef,
  isTimeGrid,
}: {
  rootRef: RefObject<HTMLElement | null>;
  scrollRef: RefObject<HTMLElement | null>;
  canvasRef: RefObject<HTMLElement | null>;
  laneRef: RefObject<HTMLElement | null>;
  isTimeGrid: boolean;
}) {
  const g = useKloqSettings();
  // where the grid opens: 7:30am, or the top of a day range that starts later
  const initialScrollTop = Math.max(0, g.minutesToPx(7.5 * 60));

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    // `=== 0`: with `ssr` the pre-paint script already scrolled, and hydration must not snap the user back
    if (scroll && scroll.scrollTop === 0) scroll.scrollTop = initialScrollTop;

    if (prefersReducedMotion()) return;
    const blocks = canvasRef.current
      ? [
          ...(laneRef.current?.querySelectorAll<HTMLElement>("[data-cal-event]") ?? []),
          ...canvasRef.current.querySelectorAll<HTMLElement>("[data-cal-event]"),
        ]
      : [...(rootRef.current?.querySelectorAll<HTMLElement>("[data-cal-event]") ?? [])];
    blocks.forEach((el, i) => {
      el.animate(
        [
          { opacity: 0, transform: "translateY(6px)" },
          { opacity: 1, transform: "none" },
        ],
        {
          duration: ms(260),
          delay: i * 20,
          easing: EASE_OUT,
          fill: "backwards",
        },
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // returning to a time grid remounts the scroller at 0 (midnight)
  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    if (scroll && scroll.scrollTop === 0) scroll.scrollTop = initialScrollTop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTimeGrid]);
  return { initialScrollTop };
}
