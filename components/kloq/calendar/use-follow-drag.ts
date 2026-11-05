import { type RefObject, useEffect } from "react";
import { craftBus } from "../lib/craft-bus";
import { formatDuration } from "../lib/event-text";
import { useLatest } from "../lib/use-latest";

/** While the anchored block is dragged, ride along per frame and mirror its live time/day labels. */
export function useFollowDrag({
  wrapRef,
  eventId,
  reanchor,
  refs,
  live,
}: {
  wrapRef: RefObject<HTMLDivElement | null>;
  eventId: string;
  reanchor: (animate: boolean) => void;
  refs: {
    timeRef: RefObject<HTMLSpanElement | null>;
    dayRef: RefObject<HTMLSpanElement | null>;
    durRef: RefObject<HTMLSpanElement | null>;
  };
  live: {
    dayNamesLong: string[];
    spanLabel: (a: number, b: number) => string;
    formatRange: (a: number, b: number) => string;
  };
}) {
  const { timeRef, dayRef, durRef } = refs;
  const liveRef = useLatest(live);

  useEffect(() => {
    let settleRaf = 0;
    const wrap = wrapRef.current;

    const follow = () => reanchor(false);

    const unsub = craftBus.subscribe((e) => {
      if (e.type === "design-mode") return;
      if (e.frame.id !== eventId) return;

      if (e.type === "drag:start" || e.type === "drag:frame") {
        if (wrap && !wrap.dataset.following) {
          wrap.dataset.following = "";
          wrap.style.pointerEvents = "none";
          wrap.style.opacity = "0.85";
        }
        follow();
        const live = liveRef.current;
        if (e.frame.endDayIndex !== undefined) {
          if (dayRef.current)
            dayRef.current.textContent = live.spanLabel(e.frame.dayIndex, e.frame.endDayIndex);
          if (timeRef.current) timeRef.current.textContent = "All day";
        } else {
          if (timeRef.current)
            timeRef.current.textContent = live.formatRange(e.frame.startMin, e.frame.endMin);
          if (durRef.current)
            durRef.current.textContent = formatDuration(e.frame.endMin - e.frame.startMin);
          if (dayRef.current)
            dayRef.current.textContent = live.dayNamesLong[e.frame.dayIndex] ?? "";
        }
        return;
      }

      // ride along with the settle spring, then let go
      const start = performance.now();
      const settle = () => {
        follow();
        if (performance.now() - start < 320) {
          settleRaf = requestAnimationFrame(settle);
        } else if (wrap) {
          delete wrap.dataset.following;
          wrap.style.pointerEvents = "";
          wrap.style.opacity = "";
          follow();
        }
      };
      settleRaf = requestAnimationFrame(settle);
    });
    return () => {
      cancelAnimationFrame(settleRaf);
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);
}
