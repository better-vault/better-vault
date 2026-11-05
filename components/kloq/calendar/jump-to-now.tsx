"use client";

/** "Jump to now" — a pill shown only while the now-line is off-screen. */

import { ArrowDown, ArrowUp } from "@/components/kloq/lib/icons";
import { memo, useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../lib/springs";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import { useKloqSettings } from "./settings-context";
import { useNowMinutes } from "./time-shade";

interface JumpToNowProps {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** -1 hides the pill entirely. */
  todayIndex: number;
  /** the calendar's own box is phone-width: the pill moves out of the thumb's way */
  narrow?: boolean;
}

export const JumpToNow = memo(function JumpToNow({
  scrollRef,
  todayIndex,
  narrow = false,
}: JumpToNowProps) {
  const g = useKloqSettings();
  const minutes = useNowMinutes();
  const [dir, setDir] = useState<"up" | "down" | null>(null);
  const animRaf = useRef(0);

  // Read through a ref so scroll/resize listeners subscribe once per scroller.
  const compute = () => {
    const scroll = scrollRef.current;
    const off = minutes !== null && (minutes < g.dayStartMin || minutes > g.dayEndMin);
    if (!scroll || minutes === null || todayIndex < 0 || off) {
      setDir(null);
      return;
    }
    const nowPx = g.minutesToPx(minutes);
    const margin = 24;
    if (nowPx < scroll.scrollTop + margin) setDir("up");
    else if (nowPx > scroll.scrollTop + scroll.clientHeight - margin) setDir("down");
    else setDir(null);
  };
  const computeRef = useRef(compute);
  useEffect(() => {
    computeRef.current = compute;
  });

  useEffect(() => {
    computeRef.current();
  }, [minutes, todayIndex, g]);

  useEffect(() => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    let raf = 0;
    const check = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => computeRef.current());
    };
    scroll.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      scroll.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [scrollRef]);

  useEffect(() => () => cancelAnimationFrame(animRaf.current), []);

  if (dir === null) return null;

  const jump = () => {
    const scroll = scrollRef.current;
    if (!scroll || minutes === null) return;
    const target = Math.max(
      0,
      Math.min(
        g.minutesToPx(minutes) - scroll.clientHeight / 2,
        scroll.scrollHeight - scroll.clientHeight,
      ),
    );
    if (prefersReducedMotion()) {
      scroll.scrollTop = target;
      return;
    }
    cancelAnimationFrame(animRaf.current);
    let x = scroll.scrollTop;
    let v = 0;
    const stiffness = 170;
    const damping = 26;
    let last = performance.now();
    const step = (t: number) => {
      const dt = Math.min(0.032, (t - last) / 1000);
      last = t;
      const a = stiffness * (target - x) - damping * v;
      v += a * dt;
      x += v * dt;
      if (Math.abs(target - x) < 0.5 && Math.abs(v) < 0.5) {
        scroll.scrollTop = target;
        return;
      }
      scroll.scrollTop = x;
      animRaf.current = requestAnimationFrame(step);
    };
    animRaf.current = requestAnimationFrame(step);
  };

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-3 z-30 flex",
        narrow ? "justify-end pe-3" : "justify-center",
      )}
    >
      <Button
        variant="outline"
        size="xs"
        className="pointer-events-auto rounded-full shadow-md"
        onClick={jump}
      >
        {dir === "up" ? <ArrowUp /> : <ArrowDown />}
        Now
      </Button>
    </div>
  );
});
