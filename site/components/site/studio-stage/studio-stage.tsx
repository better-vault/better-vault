"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft01Icon, ArrowRight01Icon, Download04Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { usePrefersReducedMotion } from "@/lib/dither";
import { tools } from "@/lib/site/tools";
import { cn } from "@/lib/utils";
import { SCENES, type Beat } from "./scenes";

/*
 * The Studio on the landing page, one tool at a time on a stage, after
 * Darkroom's Scaena. Arrows and the dots step through the tools, and each
 * scene can be played with. While the section is on screen, a walkthrough
 * plays every tool in turn, again and again: a cursor goes to a control, the
 * rest dims, a handwritten note draws its line to the control, and the cursor
 * clicks it. A visitor's first click hands the stage over to them.
 */

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Note {
  beat: Beat;
  /** The target's box. */
  box: Box;
  /** The scene's box: notes sit just outside it. */
  scene: Box;
  key: number;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Where a note's text and line go: just outside the scene, kept inside the stage. */
function noteLayout(note: Note, stage: { width: number; height: number }) {
  const { box, scene } = note;
  const centre = box.x + box.width / 2;
  const roomAbove = scene.y;
  const roomBelow = stage.height - (scene.y + scene.height);
  let place = note.beat.place;
  if (place === "above" && roomAbove < 72) place = "below";
  if (place === "below" && roomBelow < 96) place = "above";
  const textX = Math.min(Math.max(centre + 32, 160), stage.width - 160);
  const textY =
    place === "above"
      ? Math.max(scene.y - 40, 28)
      : Math.min(scene.y + scene.height + 40, stage.height - 32);
  const start = { x: textX - 24, y: place === "above" ? textY + 16 : textY - 18 };
  const end = { x: centre, y: place === "above" ? box.y - 6 : box.y + box.height + 6 };
  const control = { x: start.x - 14, y: (start.y + end.y) / 2 };
  // The arrowhead follows the line's last direction.
  const angle = Math.atan2(end.y - control.y, end.x - control.x);
  const head = (turn: number) =>
    `${end.x - 9 * Math.cos(angle + turn)},${end.y - 9 * Math.sin(angle + turn)}`;
  return {
    textX,
    textY,
    line: `M${start.x},${start.y} Q${control.x},${control.y} ${end.x},${end.y}`,
    arrow: `M${head(0.5)} L${end.x},${end.y} L${head(-0.5)}`,
  };
}

export function StudioStage() {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState(0);
  const [inView, setInView] = useState(false);
  /** Set once the visitor uses the stage themselves; the tour then stays off. */
  const [handsOn, setHandsOn] = useState(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [ring, setRing] = useState(0);
  const [note, setNote] = useState<Note | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  /** The tool shown, for the tour to resume from. */
  const indexRef = useRef(0);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  // The tour plays only on screen, until the visitor takes over, and never
  // for people who asked for less motion.
  const walking = inView && !handsOn && !reduced;

  const tool = tools[index];
  const { View } = SCENES[tool.id];

  const show = useCallback((next: number) => {
    setIndex((next + tools.length) % tools.length);
    setStep(0);
  }, []);

  /** A target's box and the scene's, in the stage's coordinates. */
  const measure = useCallback((target: string): { box: Box; scene: Box } | null => {
    const stage = stageRef.current?.getBoundingClientRect();
    const scene = sceneRef.current;
    const element = scene?.querySelector(`[data-target="${target}"]`);
    if (!stage || !scene || !element) return null;
    const relative = (rect: DOMRect): Box => ({
      x: rect.left - stage.left,
      y: rect.top - stage.top,
      width: rect.width,
      height: rect.height,
    });
    return {
      box: relative(element.getBoundingClientRect()),
      scene: relative(scene.getBoundingClientRect()),
    };
  }, []);

  /** The visitor's own click or key: the tour stops for good. */
  const takeOver = useCallback(() => setHandsOn(true), []);

  // Whether the stage is on screen.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.6,
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  // The walkthrough: every tool, beat by beat, round and round, from the one shown.
  useEffect(() => {
    if (!walking) return;
    let stopped = false;
    let key = 0;
    const pace = (ms: number) => wait(reduced ? Math.min(ms, 400) : ms);

    (async () => {
      const stage = stageRef.current?.getBoundingClientRect();
      if (stage) {
        setSize({ width: stage.width, height: stage.height });
        setCursor({ x: stage.width / 2, y: stage.height - 72 });
      }
      for (let at = indexRef.current; ; at = (at + 1) % tools.length) {
        if (stopped) return;
        setIndex(at);
        setStep(0);
        setNote(null);
        await pace(800);
        for (const beat of SCENES[tools[at].id].beats) {
          if (stopped) return;
          const found = measure(beat.target);
          if (!found) continue;
          const { box, scene } = found;
          setCursor({ x: box.x + box.width / 2 + 6, y: box.y + box.height / 2 + 6 });
          await pace(900);
          if (stopped) return;
          setNote({ beat, box, scene, key: ++key });
          await pace(1300);
          if (stopped) return;
          if (beat.click) {
            setRing((value) => value + 1);
            setStep((value) => value + 1);
          }
          await pace(beat.click ? 1500 : 900);
          setNote(null);
          await pace(250);
        }
      }
    })();

    return () => {
      stopped = true;
    };
  }, [walking, reduced, measure]);

  // While walking, notes follow the stage's size.
  useEffect(() => {
    if (!walking) return;
    const onResize = () => {
      const stage = stageRef.current?.getBoundingClientRect();
      if (stage) setSize({ width: stage.width, height: stage.height });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [walking]);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight") show(index + 1);
    else if (event.key === "ArrowLeft") show(index - 1);
    else return;
    takeOver();
    event.preventDefault();
  };

  const shown = walking ? note : null;
  const layout = shown && size.width ? noteLayout(shown, size) : null;
  const spotlight: CSSProperties | undefined = shown
    ? {
        background: `radial-gradient(ellipse ${shown.box.width / 2 + 70}px ${shown.box.height / 2 + 60}px at ${
          shown.box.x + shown.box.width / 2
        }px ${shown.box.y + shown.box.height / 2}px, transparent 55%, color-mix(in oklab, var(--background) 70%, transparent) 100%)`,
      }
    : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Studio tools"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative h-[26rem] rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-[28rem]"
      >
        <div
          ref={stageRef}
          className={cn("overflow-hidden rounded-2xl border bg-card", "absolute inset-0")}
        >
          <div className="absolute inset-0 flex items-center justify-center p-6 pb-6">
            <div
              key={tool.id}
              ref={sceneRef}
              onPointerDownCapture={takeOver}
              className={cn(
                // Phones get the scene a little smaller, rather than cut off.
                "stage-note transition-transform duration-500 max-sm:scale-[0.82]",
                walking && !reduced && "sm:scale-110",
              )}
            >
              <View step={step} go={setStep} />
            </div>
          </div>

          {/* Everything but the target dims while a note is up. */}
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-0 transition-opacity duration-300",
              shown ? "opacity-100" : "opacity-0",
            )}
            style={spotlight}
          />

          {shown && layout ? (
            <div
              key={shown.key}
              aria-live="polite"
              className="pointer-events-none absolute inset-0"
            >
              <svg
                className="absolute inset-0 size-full overflow-visible text-foreground"
                aria-hidden="true"
              >
                <path
                  d={layout.line}
                  pathLength={1}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  className="stage-line"
                />
                <path
                  d={layout.arrow}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="stage-arrowhead"
                />
              </svg>
              <p
                className="stage-note absolute -translate-x-1/2 -translate-y-1/2 font-[Excalifont] text-xl whitespace-nowrap sm:text-2xl"
                style={{ left: layout.textX, top: layout.textY }}
              >
                {shown.beat.note}
              </p>
            </div>
          ) : null}

          {walking && cursor ? (
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute z-10",
                !reduced &&
                  "transition-[left,top] duration-[850ms] ease-[cubic-bezier(0.65,0,0.35,1)]",
              )}
              style={{ left: cursor.x, top: cursor.y }}
            >
              {ring ? (
                <span
                  key={ring}
                  className="stage-ring absolute -top-4 -left-4 size-8 rounded-full border-2 border-info"
                />
              ) : null}
              <svg width="18" height="22" viewBox="0 0 18 22" className="drop-shadow-md">
                <path
                  d="M1 1 L1 17 L5.5 12.8 L8.6 20 L11.4 18.8 L8.4 11.8 L14.5 11.8 Z"
                  className="fill-foreground stroke-background"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          ) : null}

          <>
            <button
              type="button"
              onClick={() => {
                takeOver();
                show(index - 1);
              }}
              aria-label="Previous tool"
              className="absolute top-1/2 left-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                className="size-4 rtl:-scale-x-100"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              onClick={() => {
                takeOver();
                show(index + 1);
              }}
              aria-label="Next tool"
              className="absolute top-1/2 right-3 flex size-9 -translate-y-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
            >
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                className="size-4 rtl:-scale-x-100"
                aria-hidden="true"
              />
            </button>
          </>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex flex-col items-center gap-1.5">
          <h3 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <HugeiconsIcon
              icon={tool.icon}
              className={cn("size-5", tool.tint)}
              aria-hidden="true"
            />
            <Link href={`/docs/studio/${tool.id}`} className="underline-offset-4 hover:underline">
              {tool.name}
            </Link>
            {tool.isNew ? (
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-medium text-info">
                Not in NotebookLM
              </span>
            ) : null}
          </h3>
          <p className="max-w-md text-sm text-muted-foreground">{tool.body}</p>
          <p className="flex flex-wrap items-center justify-center gap-1.5">
            <HugeiconsIcon
              icon={Download04Icon}
              className="size-3.5 text-muted-foreground"
              aria-label="Downloads as"
            />
            {tool.formats.map((format) => (
              <span
                key={format}
                className="rounded-md border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
              >
                {format}
              </span>
            ))}
          </p>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border bg-card px-2 py-1.5">
          {tools.map((item, at) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                takeOver();
                show(at);
              }}
              aria-label={item.name}
              aria-current={at === index}
              className={cn(
                "flex items-center justify-center rounded-full transition-all",
                at === index
                  ? "size-5 bg-foreground font-mono text-[10px] text-background"
                  : "size-1.5 bg-muted-foreground/40 hover:bg-muted-foreground",
              )}
            >
              {at === index ? at + 1 : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
