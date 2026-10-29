"use client";

import { useMemo, type ComponentType } from "react";
import {
  ArrowExpand01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowShrink01Icon,
  ArrowUpRight01Icon,
  BulbIcon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  CircleIcon,
  Copy01Icon,
  Cursor01Icon,
  DiamondIcon,
  File01Icon,
  Note01Icon,
  PencilIcon,
  PlayIcon,
  ShuffleIcon,
  SquareIcon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Button } from "@/components/panelui/button";
import { cn } from "@/lib/utils";
import { springScale } from "./anatomy/example";
import { AnatomyStage } from "./anatomy/stage";
import "./anatomy/anatomy.css";

/*
 * The Studio tools on the landing page's stage, built from the app's own
 * viewers (studio/tools/<id>/viewer.tsx): the same layout, classes and Panel
 * components, with a little sample content about how cells make energy.
 * Anatomy draws a real figure with the app's renderer (./anatomy).
 *
 * A scene shows `step` 0, 1 or 2. Each walkthrough click moves it one step
 * on; a visitor can click the same controls to play with it. Controls the
 * walkthrough uses carry `data-target`.
 */

export interface SceneProps {
  step: number;
  /** Moves the scene to `step`, from a visitor's click. */
  go: (step: number) => void;
}

export interface Beat {
  /** The `data-target` the cursor goes to and the note points at. */
  target: string;
  /** The handwritten note. */
  note: string;
  /** Where the note sits: above or below the scene. */
  place: "above" | "below";
  /** Whether the cursor clicks, which moves the scene one step on. */
  click?: boolean;
}

export interface Scene {
  View: ComponentType<SceneProps>;
  beats: Beat[];
}

function Icon({
  icon,
  size = 16,
  className,
}: {
  icon: IconSvgElement;
  size?: number;
  className?: string;
}) {
  return <HugeiconsIcon icon={icon} size={size} className={className} aria-hidden="true" />;
}

/** A citation mark, as components/chat/citation.tsx draws it. */
function Cite({
  n,
  open,
  target,
  onClick,
}: {
  n: number;
  open: boolean;
  target?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-target={target}
      onClick={onClick}
      className={cn(
        "relative -top-[0.45em] mx-px inline-flex h-[1.35em] min-w-[1.35em] cursor-pointer items-center justify-center rounded-[0.4em] px-[0.35em] align-baseline",
        "bg-muted font-mono text-[0.68em] leading-none font-medium text-muted-foreground tabular-nums transition-colors",
        "hover:bg-info hover:text-info-foreground",
        open && "bg-info text-info-foreground",
      )}
    >
      {n}
    </button>
  );
}

function Report({ step, go }: SceneProps) {
  return (
    <article className="relative w-[26rem] rounded-3xl bg-card px-7 py-7 text-card-foreground ring-1 ring-border">
      <h3 className="text-xl font-semibold tracking-tight">How cells make energy</h3>
      <p className="mt-3 text-[0.9375rem] leading-7">
        Most of a cell&apos;s ATP is made in the mitochondria, where ATP synthase turns the flow of
        protons into energy
        <Cite n={2} target="cite" open={step >= 1} onClick={() => go(step >= 1 ? 0 : 1)} />.
        Glycolysis adds a little more in the cytoplasm
        <Cite n={1} open={false} onClick={() => go(1)} />.
      </p>
      {/* The citation's hover card. */}
      <div
        className={cn(
          "absolute start-24 top-[5.5rem] w-72 rounded-2xl bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-border transition-all duration-200",
          step >= 1 ? "opacity-100" : "pointer-events-none translate-y-1 opacity-0",
        )}
      >
        <div className="flex items-start gap-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            <Icon icon={File01Icon} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Biology notes.pdf</p>
            <p className="text-xs text-muted-foreground">PDF · passage 2</p>
          </div>
        </div>
        <p className="mt-2.5 border-s-2 border-border ps-2.5 text-xs leading-relaxed text-muted-foreground">
          ATP synthase in the inner membrane makes most of the cell&apos;s ATP as protons flow back
          through it.
        </p>
      </div>
    </article>
  );
}

function Flashcards({ step, go }: SceneProps) {
  const flipped = step === 1;
  return (
    <div className="flex w-[26rem] flex-col items-center gap-4">
      <div className="flex w-full items-center justify-between text-sm text-muted-foreground">
        <span className="tabular-nums">{step >= 2 ? 4 : 3} / 20</span>
        <Button variant="ghost" size="sm">
          <Icon icon={ShuffleIcon} />
          Shuffle
        </Button>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-chart-4 transition-[width]"
          style={{ width: step >= 2 ? "15%" : "10%" }}
        />
      </div>
      <button
        type="button"
        data-target="card"
        onClick={() => go(flipped ? 0 : 1)}
        className="group w-full cursor-pointer outline-none [perspective:1600px]"
      >
        <div
          className={cn(
            "relative grid aspect-[16/8] w-full transition-transform duration-500 ease-[cubic-bezier(0.3,0.7,0.1,1)] [transform-style:preserve-3d] motion-reduce:transition-none",
            flipped && "[transform:rotateY(180deg)]",
          )}
        >
          <div className="col-start-1 row-start-1 flex items-center justify-center rounded-3xl bg-card p-6 text-center text-lg leading-snug font-semibold text-card-foreground shadow-sm ring-1 ring-border [backface-visibility:hidden]">
            {step >= 2 ? "Where in the cell is ATP synthase?" : "What does ATP synthase do?"}
          </div>
          <div className="col-start-1 row-start-1 flex [transform:rotateY(180deg)] items-center justify-center rounded-3xl bg-muted p-6 text-center leading-relaxed [backface-visibility:hidden]">
            It uses the flow of protons across a membrane to make ATP.
          </div>
        </div>
      </button>
      <div className="flex w-full items-center justify-center gap-2">
        <Button variant="outline" shape="pill" size="sm">
          <Icon icon={CancelCircleIcon} className="text-destructive" />
          Still learning
          <span className="text-muted-foreground tabular-nums">2</span>
        </Button>
        <Button variant="outline" shape="pill" size="sm" data-target="knew" onClick={() => go(2)}>
          <Icon icon={CheckmarkCircle02Icon} className="text-success" />I knew it
          <span className="text-muted-foreground tabular-nums">{step >= 2 ? 8 : 7}</span>
        </Button>
      </div>
    </div>
  );
}

const OPTIONS = ["The nucleus", "The mitochondria", "The ribosome"];
const LETTERS = "ABCD";

function Quiz({ step, go }: SceneProps) {
  const answered = step >= 2;
  return (
    <div className="flex w-[26rem] flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground tabular-nums">Question 2 of 10</p>
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full w-[10%] rounded-full bg-chart-3" />
        </div>
      </div>
      <h3 className="text-lg leading-snug font-semibold">
        Where is most of a cell&apos;s ATP made?
      </h3>
      <div className="flex flex-col gap-2">
        {OPTIONS.map((option, at) => {
          const right = at === 1;
          return (
            <button
              key={option}
              type="button"
              data-target={right ? "answer" : undefined}
              onClick={() => go(2)}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-2.5 text-start transition-colors outline-none hover:bg-muted/60",
                answered && right && "border-success bg-success/10 hover:bg-success/10",
              )}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {LETTERS[at]}
              </span>
              <span className="min-w-0 flex-1 pt-0.5 text-[0.9375rem] leading-6">{option}</span>
              {answered && right ? (
                <Icon icon={CheckmarkCircle02Icon} size={18} className="mt-0.5 text-success" />
              ) : null}
            </button>
          );
        })}
      </div>
      {answered ? (
        <div className="rounded-2xl bg-muted/60 px-4 py-3 text-sm leading-6">
          <p className="font-semibold text-success">Correct</p>
          <p className="mt-1">ATP synthase sits in the inner membrane of the mitochondria.</p>
        </div>
      ) : step >= 1 ? (
        <p className="flex items-start gap-2 rounded-2xl bg-warning/10 px-4 py-3 text-sm leading-6">
          <Icon icon={BulbIcon} className="mt-1 shrink-0 text-warning" />
          Think of the cell&apos;s power plant.
        </p>
      ) : (
        <button
          type="button"
          data-target="hint"
          onClick={() => go(1)}
          className="inline-flex w-fit cursor-pointer items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <Icon icon={BulbIcon} />
          Show a hint
        </button>
      )}
    </div>
  );
}

/** Mind map node colours by depth, as studio/tools/mind-map/tree-view.tsx has them. */
const DEPTH = [
  "bg-chart-5/20 ring-chart-5/40 font-semibold",
  "bg-chart-2/15 ring-chart-2/35",
  "bg-chart-3/15 ring-chart-3/35",
];

interface MapNodeProps {
  label: string;
  depth: number;
  x: number;
  y: number;
  toggle?: boolean;
  open?: boolean;
  target?: string;
  onToggle?: () => void;
  hidden?: boolean;
}

function MapNode({ label, depth, x, y, toggle, open, target, onToggle, hidden }: MapNodeProps) {
  return (
    <div
      className={cn(
        "absolute top-0 left-0 flex items-center gap-2 transition-all duration-300",
        hidden ? "pointer-events-none opacity-0" : "opacity-100",
      )}
      style={{ transform: `translate(${x}px, ${y}px)` }}
    >
      <span
        className={cn(
          "flex h-9 items-center rounded-xl px-3.5 text-sm font-medium whitespace-nowrap text-foreground ring-1",
          DEPTH[depth],
        )}
      >
        {label}
      </span>
      {toggle ? (
        <button
          type="button"
          data-target={target}
          onClick={onToggle}
          aria-label={open ? `Close ${label}` : `Open ${label}`}
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full bg-muted text-foreground ring-1 ring-border transition-colors hover:bg-foreground/15"
        >
          <HugeiconsIcon
            icon={open ? ArrowLeft01Icon : ArrowRight01Icon}
            size={13}
            strokeWidth={2.4}
          />
        </button>
      ) : null}
    </div>
  );
}

function MindMap({ step, go }: SceneProps) {
  const open = step >= 1;
  return (
    <div className="relative h-60 w-[32rem] overflow-hidden rounded-3xl bg-card ring-1 ring-border">
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <g className="fill-none stroke-chart-5/55 [stroke-width:1.6]">
          <path d="M140 120 C170 120 170 66 200 66" />
          <path d="M140 120 L200 120" />
          <path d="M140 120 C170 120 170 174 200 174" />
        </g>
        <g
          className={cn(
            "fill-none stroke-chart-5/55 [stroke-width:1.6] transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
        >
          <path d="M352 174 C365 174 365 146 378 146" />
          <path d="M352 174 C365 174 365 202 378 202" />
        </g>
      </svg>
      <MapNode label="Cell energy" depth={0} x={24} y={102} />
      <MapNode label="Glycolysis" depth={1} x={200} y={48} toggle />
      <MapNode label="Krebs cycle" depth={1} x={200} y={102} toggle />
      <MapNode
        label="Electron chain"
        depth={1}
        x={200}
        y={156}
        toggle
        open={open}
        target="branch"
        onToggle={() => go(open ? 0 : 1)}
      />
      <MapNode label="Proton flow" depth={2} x={378} y={128} hidden={!open} />
      <MapNode label="ATP synthase" depth={2} x={378} y={184} hidden={!open} />
    </div>
  );
}

const COLUMNS = ["Stage", "Where", "ATP"];
const ROWS = [
  ["Glycolysis", "Cytoplasm", "2"],
  ["Krebs cycle", "Matrix", "2"],
  ["Electron chain", "Inner membrane", "~34"],
];

function DataTable({ step, go }: SceneProps) {
  return (
    <div className="flex w-[26rem] flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">3 rows</p>
        <Button variant="ghost" size="sm" data-target="copy" onClick={() => go(1)}>
          <Icon
            icon={step >= 1 ? CheckmarkCircle02Icon : Copy01Icon}
            className={cn(step >= 1 && "text-success")}
          />
          {step >= 1 ? "Copied" : "Copy as Markdown"}
        </Button>
      </div>
      <div data-target="table" className="overflow-hidden rounded-2xl border">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted">
            <tr>
              {COLUMNS.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="border-b px-4 py-2.5 text-start font-semibold"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row[0]} className="even:bg-muted/30">
                {row.map((cell, at) => (
                  <td key={at} className="border-b px-4 py-2.5 align-top leading-6">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Anatomy({ step, go }: SceneProps) {
  const figureStep = step >= 1 ? 1 : 0;
  const exploded = step >= 2;
  const current = springScale.steps[figureStep];
  const lit = useMemo(() => new Set(current.focus), [current]);
  return (
    <section className="anatomy flex h-[19rem] w-[30rem] flex-col rounded-3xl border bg-card">
      <div className="pointer-events-none flex justify-between gap-4 px-5 pt-4 font-mono text-[0.6875rem] tracking-wide text-muted-foreground">
        <span className="text-foreground/70">Fig 1</span>
        <span className="truncate tracking-[0.1em] uppercase">{springScale.title}</span>
      </div>
      <div className="relative mx-3 min-h-0 flex-1">
        <AnatomyStage
          scene={springScale}
          step={figureStep}
          exploded={exploded}
          lit={lit}
          active={null}
          label={springScale.object}
          onHover={() => {}}
          onSelect={() => {}}
        />
      </div>
      <div className="flex items-center gap-2 border-t px-3 py-2">
        <Button variant="ghost" size="icon-sm" aria-label="Previous step" onClick={() => go(0)}>
          <Icon icon={ArrowLeft01Icon} className="rtl:rotate-180" />
        </Button>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {figureStep + 1} / 2
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next step"
          data-target="next-step"
          onClick={() => go(Math.max(step, 1))}
        >
          <Icon icon={ArrowRight01Icon} className="rtl:rotate-180" />
        </Button>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{current.title}</span>
        <Button
          variant="outline"
          shape="pill"
          size="sm"
          data-target="apart"
          aria-pressed={exploded}
          onClick={() => go(exploded ? 1 : 2)}
        >
          <Icon icon={exploded ? ArrowShrink01Icon : ArrowExpand01Icon} />
          {exploded ? "Put together" : "Take apart"}
        </Button>
      </div>
    </section>
  );
}

const SLIDES = [
  {
    title: "Where your energy comes from",
    bullets: ["Glycolysis: 2 ATP", "Krebs cycle: 2 ATP", "Electron chain: about 34 ATP"],
  },
  {
    title: "The electron chain",
    bullets: [
      "Protons are pumped across the membrane",
      "They flow back through ATP synthase",
      "Each turn makes ATP",
    ],
  },
];

function SlideDeck({ step, go }: SceneProps) {
  const index = step >= 1 ? 1 : 0;
  const slide = SLIDES[index];
  const notes = step >= 2;
  return (
    <div className="flex w-[32rem] flex-col gap-3">
      {/* As studio/tools/slide-deck/slide.tsx lays out a bullets slide. */}
      <div className="@container relative aspect-video w-full overflow-hidden rounded-[1.6cqw] bg-card text-start text-card-foreground ring-1 ring-border">
        <div className="absolute inset-0 flex flex-col px-[6.5cqw] pt-[5.5cqw] pb-[6cqw]">
          <h2 className="mb-[2.8cqw] shrink-0 text-[3.4cqw] leading-[1.15] font-semibold tracking-tight">
            {slide.title}
          </h2>
          <ul className="flex flex-col gap-[1.6cqw] text-[2.5cqw] leading-[1.35]">
            {slide.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-[1.6cqw]">
                <span className="mt-[1cqw] size-[1cqw] shrink-0 rounded-full bg-info" />
                {bullet}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" aria-label="Previous slide" onClick={() => go(0)}>
          <Icon icon={ArrowLeft01Icon} className="rtl:rotate-180" />
        </Button>
        <span className="min-w-14 text-center font-mono text-xs text-muted-foreground tabular-nums">
          {index + 1} / 8
        </span>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Next slide"
          data-target="next"
          onClick={() => go(Math.max(step, 1))}
        >
          <Icon icon={ArrowRight01Icon} className="rtl:rotate-180" />
        </Button>
        <div className="ms-auto flex items-center gap-2">
          <Button
            variant={notes ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={notes}
            data-target="notes"
            onClick={() => go(notes ? 1 : 2)}
          >
            <Icon icon={Note01Icon} />
            Notes
          </Button>
          <Button size="sm" shape="pill">
            <Icon icon={PlayIcon} />
            Present
          </Button>
        </div>
      </div>
      {notes ? (
        <section className="rounded-2xl bg-muted/60 px-4 py-3 text-sm">
          The membrane works like a dam, and ATP synthase is its turbine.
        </section>
      ) : null}
    </div>
  );
}

const BARS = [
  { value: "2", name: "Glycolysis", tone: "bg-chart-4", height: "16%" },
  { value: "2", name: "Krebs", tone: "bg-chart-3", height: "16%" },
  { value: "34", name: "Electron chain", tone: "bg-chart-2", height: "100%" },
];

function Infographic({ step, go }: SceneProps) {
  const details = step >= 1;
  return (
    <div className="flex w-[34rem] gap-3">
      {/* The picture, as the image model drew it. */}
      <div
        data-target="picture"
        className="flex flex-1 flex-col gap-3 rounded-3xl bg-card p-5 ring-1 ring-border"
      >
        <p className="text-sm font-semibold">Where your energy comes from</p>
        <div className="flex flex-1 items-end gap-3">
          {BARS.map((bar) => (
            <div key={bar.name} className="flex flex-1 flex-col gap-1.5">
              <div className="flex h-24 items-end">
                <div className={cn("w-full rounded-lg", bar.tone)} style={{ height: bar.height }} />
              </div>
              <span className="text-lg font-semibold tabular-nums">{bar.value}</span>
              <span className="text-[11px] text-muted-foreground">{bar.name}</span>
            </div>
          ))}
        </div>
      </div>
      {/* The side panel's tabs, as Panel's Tabs draw them. */}
      <aside className="w-48 shrink-0 rounded-3xl border bg-card p-2">
        <div className="flex rounded-lg bg-muted p-0.5 text-xs">
          <button
            type="button"
            onClick={() => go(0)}
            className={cn(
              "flex-1 cursor-pointer rounded-md py-1",
              !details && "bg-background shadow-xs",
            )}
          >
            Brief
          </button>
          <button
            type="button"
            data-target="details"
            onClick={() => go(1)}
            className={cn(
              "flex-1 cursor-pointer rounded-md py-1",
              details && "bg-background shadow-xs",
            )}
          >
            Details
          </button>
        </div>
        <div className="flex flex-col gap-2 p-2 pt-3 text-xs">
          {details ? (
            <>
              <p className="text-muted-foreground">Image model</p>
              <p className="font-medium">GPT Image</p>
              <p className="text-muted-foreground">Size</p>
              <p className="font-medium">1536 × 1024</p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">Cell energy</p>
              <p className="leading-5 text-muted-foreground">
                Most ATP comes from the electron chain
                <Cite n={2} open={false} onClick={() => go(1)} />.
              </p>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

const BOARD_TOOLS: { id: string; icon: IconSvgElement; digit: string }[] = [
  { id: "Select", icon: Cursor01Icon, digit: "1" },
  { id: "Rectangle", icon: SquareIcon, digit: "2" },
  { id: "Diamond", icon: DiamondIcon, digit: "3" },
  { id: "Ellipse", icon: CircleIcon, digit: "4" },
  { id: "Arrow", icon: ArrowUpRight01Icon, digit: "5" },
  { id: "Pen", icon: PencilIcon, digit: "7" },
  { id: "Text", icon: TextFontIcon, digit: "8" },
];

function Whiteboard({ step, go }: SceneProps) {
  const pen = step >= 1;
  return (
    <div className="relative h-64 w-[30rem] overflow-hidden rounded-3xl bg-card ring-1 ring-border">
      <span className="absolute top-20 left-10 rounded-md border-2 border-foreground/70 px-3 py-2 font-[Excalifont] text-base">
        Sources
      </span>
      <span className="absolute right-10 bottom-10 rounded-full border-2 border-foreground/70 px-4 py-2 font-[Excalifont] text-base">
        Study plan
      </span>
      <button
        type="button"
        data-target="board"
        onClick={() => pen && go(2)}
        aria-label="Draw on the board"
        className={cn("absolute inset-x-0 top-16 bottom-0", pen && "cursor-crosshair")}
      />
      <svg className="pointer-events-none absolute inset-0 size-full text-info" aria-hidden="true">
        {step >= 2 ? (
          <path
            d="M150 104 C220 100 250 150 318 184"
            pathLength={1}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="stage-line"
          />
        ) : null}
      </svg>
      {/* As studio/tools/whiteboard/toolbar.tsx lays out the tools. */}
      <div className="absolute inset-x-0 top-3 flex justify-center">
        <div className="flex gap-0.5 rounded-2xl border bg-background/95 p-1.5 shadow-sm">
          {BOARD_TOOLS.map((tool) => {
            const pressed = tool.id === "Pen" ? pen : tool.id === "Select" && !pen;
            return (
              <button
                key={tool.id}
                type="button"
                aria-label={tool.id}
                aria-pressed={pressed}
                data-target={tool.id === "Pen" ? "pen" : undefined}
                onClick={() => tool.id === "Pen" && go(pen ? 0 : 1)}
                className={cn(
                  "relative flex size-8 cursor-pointer items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent",
                  pressed && "bg-info/15 text-info",
                )}
              >
                <HugeiconsIcon icon={tool.icon} size={17} />
                <span className="pointer-events-none absolute end-0.5 bottom-0 text-[0.5625rem] leading-none text-muted-foreground/70 tabular-nums">
                  {tool.digit}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Each tool's scene and walkthrough, by the tool's id in lib/site/tools.ts. */
export const SCENES: Record<string, Scene> = {
  report: {
    View: Report,
    beats: [{ target: "cite", note: "Every claim cites its passage", place: "below", click: true }],
  },
  flashcards: {
    View: Flashcards,
    beats: [
      { target: "card", note: "Click a card to flip it", place: "above", click: true },
      { target: "knew", note: "Then mark what you knew", place: "below", click: true },
    ],
  },
  quiz: {
    View: Quiz,
    beats: [
      { target: "hint", note: "Stuck? Ask for a hint", place: "below", click: true },
      { target: "answer", note: "Answer, and see why", place: "above", click: true },
    ],
  },
  "mind-map": {
    View: MindMap,
    beats: [{ target: "branch", note: "Open a branch to go deeper", place: "below", click: true }],
  },
  "data-table": {
    View: DataTable,
    beats: [
      { target: "table", note: "The facts, in rows and columns", place: "below" },
      { target: "copy", note: "Copy it anywhere", place: "above", click: true },
    ],
  },
  anatomy: {
    View: Anatomy,
    beats: [
      { target: "next-step", note: "Step through how it works", place: "below", click: true },
      { target: "apart", note: "Then take it apart", place: "below", click: true },
    ],
  },
  "slide-deck": {
    View: SlideDeck,
    beats: [
      { target: "next", note: "Step through the slides", place: "below", click: true },
      { target: "notes", note: "With notes for presenting", place: "above", click: true },
    ],
  },
  infographic: {
    View: Infographic,
    beats: [
      { target: "picture", note: "One page, drawn by your image model", place: "above" },
      { target: "details", note: "Its brief stays beside it", place: "below", click: true },
    ],
  },
  whiteboard: {
    View: Whiteboard,
    beats: [
      { target: "pen", note: "Pick the pen", place: "above", click: true },
      { target: "board", note: "And draw over anything", place: "below", click: true },
    ],
  },
};
