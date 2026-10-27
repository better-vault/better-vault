"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

/**
 * The isometric line drawings on the landing page's feature cards.
 *
 * Each card makes its claim with an object you can press: citation keys that
 * light the passage they point at, a switch that lets the web in, a tray of
 * the nine Studio tools, a row of providers, a vault whose lid opens on the
 * notebooks inside, and a stack of export files. Every press changes the
 * readout in the corner, so the drawing says something rather than decorates.
 *
 * Every shape is a flat SVG rect or text laid onto a plane of an isometric
 * box by one matrix(). Depth is paint order: farther parts are drawn first and
 * every face is opaque. Colour comes from the theme tokens only.
 */

type V3 = [number, number, number];

const C = Math.cos(Math.PI / 6);
const S = Math.sin(Math.PI / 6);
const P = (x: number, y: number, z: number): [number, number] => [(x - y) * C, (x + y) * S - z];

const plane = (O: V3, U: V3, V: V3) => {
  const o = P(...O);
  const u = P(...U);
  const v = P(...V);
  return `matrix(${u[0]} ${u[1]} ${v[0]} ${v[1]} ${o[0]} ${o[1]})`;
};
/** z = const, origin at the face's back corner. */
const TOP = (x: number, y: number, z: number) => plane([x, y, z], [1, 0, 0], [0, 1, 0]);
/** y = const, faces lower-left; pass its top-left corner. */
const FRONT = (x: number, y: number, z: number) => plane([x, y, z], [1, 0, 0], [0, 0, -1]);
/** x = const, faces lower-right; pass its top-left corner. */
const SIDE = (x: number, y: number, z: number) => plane([x, y, z], [0, -1, 0], [0, 0, -1]);

type Bounds = [number, number, number, number, number, number];
const viewBox = ([ax, ay, az, bx, by, bz]: Bounds) => {
  const pts = [ax, bx].flatMap((x) => [ay, by].flatMap((y) => [az, bz].map((z) => P(x, y, z))));
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const m = 0.06 * Math.max(x1 - x0, y1 - y0);
  return `${x0 - m} ${y0 - m} ${x1 - x0 + 2 * m} ${y1 - y0 + 2 * m}`;
};

const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(" ");

function Face({ t, w, h, r = 0, className = "iso-face" }: { t: string; w: number; h: number; r?: number; className?: string }) {
  return (
    <g transform={t}>
      <rect className={className} width={w} height={h} rx={r} />
    </g>
  );
}

/** A box at (x, y, z), `w` along x, `d` along y, `h` up: its three visible faces. */
function Box({
  x,
  y,
  z,
  w,
  d,
  h,
  r = 0,
  className = "iso-face",
  top = "iso-face iso-top",
}: {
  x: number;
  y: number;
  z: number;
  w: number;
  d: number;
  h: number;
  r?: number;
  className?: string;
  top?: string;
}) {
  const rs = Math.min(r, h / 4);
  return (
    <>
      <Face t={SIDE(x + w, y + d, z + h)} w={d} h={h} r={rs} className={className} />
      <Face t={FRONT(x, y + d, z + h)} w={w} h={h} r={rs} className={className} />
      <Face t={TOP(x, y, z + h)} w={w} h={d} r={r} className={top} />
    </>
  );
}

/** A key standing on a surface, its label lying on its top. */
function Key({
  x,
  y,
  z = 0,
  w,
  d,
  h = 9,
  label,
  on,
  down,
  onPress,
  size = 10,
}: {
  x: number;
  y: number;
  z?: number;
  w: number;
  d: number;
  h?: number;
  label: string;
  on?: boolean;
  down?: boolean;
  onPress: () => void;
  size?: number;
}) {
  return (
    <g className={cx("iso-press", down && "down", on === true && "on", on === false && "off")} onClick={onPress}>
      <Box x={x} y={y} z={z} w={w} d={d} h={h} r={5} />
      <g transform={TOP(x, y, z + h)}>
        <text className="iso-label" x={w / 2} y={d / 2 + size * 0.35} fontSize={size} textAnchor="middle">
          {label}
        </text>
      </g>
    </g>
  );
}

/** Momentary press: the part sinks for 110ms, the way a key does. */
function usePress() {
  const [down, setDown] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return [
    down,
    (key: string) => {
      setDown(key);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setDown(null), 110);
    },
  ] as const;
}

function Frame({
  n,
  name,
  hint,
  readout,
  label,
  bounds,
  onKey,
  children,
}: {
  n: number;
  name: string;
  hint: string;
  readout: string;
  label: string;
  bounds: Bounds;
  onKey: (key: string) => boolean;
  children: ReactNode;
}) {
  const handleKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
    if (onKey(e.key.length === 1 ? e.key.toLowerCase() : e.key)) e.preventDefault();
  };
  return (
    <div className="iso-figure flex flex-col gap-2 font-mono text-[10px] tracking-[0.08em] text-muted-foreground">
      <div className="flex flex-wrap justify-between gap-x-3">
        <span>Fig {n}</span>
        <span className="uppercase">{name}</span>
      </div>
      <svg
        viewBox={viewBox(bounds)}
        role="img"
        tabIndex={0}
        aria-label={label}
        onKeyDown={handleKey}
        className="block aspect-[3/2] w-full touch-manipulation rounded-md select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {children}
      </svg>
      <div className="flex flex-wrap justify-between gap-x-3">
        <span className="uppercase">{hint}</span>
        <span className="text-foreground" aria-live="polite">
          {readout}
        </span>
      </div>
    </div>
  );
}

/* Fig 1: a page of text with three citation keys beside it ---------------- */

const CITES = [
  { label: "[1]", line: 0, where: "p. 2" },
  { label: "[2]", line: 2, where: "p. 7" },
  { label: "[3]", line: 4, where: "p. 12" },
];

function Citations() {
  const [active, setActive] = useState(1);
  const [down, flash] = usePress();
  const press = (i: number) => {
    flash(String(i));
    setActive(i);
  };
  const widths = [86, 70, 92, 60, 80, 54];
  return (
    <Frame
      n={1}
      bounds={[6, 6, 0, 196, 104, 15]}
      name="Cited answer"
      hint="marks · 1 2 3"
      readout={`${CITES[active].label} · source · ${CITES[active].where}`}
      label="A page of text with three citation keys beside it. Pressing a key lights the passage it cites. Press 1, 2 or 3."
      onKey={(k) => {
        const i = ["1", "2", "3"].indexOf(k);
        if (i < 0) return false;
        press(i);
        return true;
      }}
    >
      <Box x={6} y={8} z={0} w={124} d={96} h={6} r={6} />
      <g transform={TOP(6, 8, 6)}>
        <rect className="iso-face iso-glass" x={8} y={8} width={108} height={80} rx={4} />
        {widths.map((w, i) => (
          <rect
            key={i}
            className={cx("iso-anim", CITES[active].line === i ? "iso-fill-live" : "iso-bar")}
            x={16}
            y={16 + i * 11}
            width={w}
            height={5}
            rx={1}
          />
        ))}
      </g>
      {CITES.map((c, i) => (
        <Key
          key={c.label}
          x={146}
          y={6 + i * 34}
          w={50}
          d={26}
          h={7}
          label={c.label}
          on={active === i}
          down={down === String(i)}
          onPress={() => press(i)}
        />
      ))}
    </Frame>
  );
}

/* Fig 2: a switch from Sources to Sources + Web --------------------------- */

function WebSwitch() {
  const [on, setOn] = useState(false);
  const [down, flash] = usePress();
  const toggle = () => {
    flash("switch");
    setOn((v) => !v);
  };
  const knob = P(60, 0, 0);
  return (
    <Frame
      n={2}
      bounds={[36, 18, 0, 164, 88, 54]}
      name="Answer from"
      hint="switch · space"
      readout={on ? "sources + provider search" : "your sources only"}
      label="A large switch between Sources and Web. Press space to let the model search the web with its provider's own search."
      onKey={(k) => {
        if (k !== " " && k !== "Enter") return false;
        toggle();
        return true;
      }}
    >
      <g className={cx("iso-press", down === "switch" && "down", on && "on")} onClick={toggle}>
        <Box x={36} y={18} z={0} w={128} d={70} h={40} r={8} />
        <g transform={TOP(36, 18, 40)}>
          <rect className="iso-face iso-glass" x={10} y={18} width={108} height={34} rx={17} />
          <text className={cx("iso-label", on && "iso-dim")} x={14} y={12} fontSize={7}>
            sources
          </text>
          <text className={cx("iso-label", !on && "iso-dim")} x={114} y={12} fontSize={7} textAnchor="end">
            web
          </text>
        </g>
        <g transform={FRONT(36, 88, 40)}>
          {/* Globe meridians on the front face: drawn faint, lit when on. */}
          <g className={on ? "iso-ring" : "iso-detail"}>
            <circle cx={64} cy={20} r={12} fill="none" />
            <ellipse cx={64} cy={20} rx={5} ry={12} fill="none" />
            <line x1={52} x2={76} y1={20} y2={20} />
          </g>
        </g>
        <g className="iso-anim" style={{ transform: on ? `translate(${knob[0]}px, ${knob[1]}px)` : "translate(0px, 0px)" }}>
          <Box x={48} y={38} z={40} w={44} d={30} h={14} r={10} />
          <g transform={TOP(48, 38, 54)}>
            <rect className={on ? "iso-fill-live" : "iso-bar"} x={18} y={9} width={8} height={12} rx={2} />
          </g>
        </g>
      </g>
    </Frame>
  );
}

/* Fig 3: a tray of nine keys, one per Studio tool ------------------------- */

const TOOLS = [
  ["RPT", "report"],
  ["FLC", "flashcards"],
  ["QZ", "quiz"],
  ["MAP", "mind map"],
  ["TBL", "data table"],
  ["ANA", "anatomy"],
  ["DCK", "slide deck"],
  ["INF", "infographic"],
  ["BRD", "whiteboard"],
] as const;

function StudioTray() {
  const [active, setActive] = useState(0);
  const [down, flash] = usePress();
  const press = (i: number) => {
    flash(String(i));
    setActive(i);
  };
  // Farther keys first: row + column ascending.
  const order = TOOLS.map((_, i) => i).sort((a, b) => ((a % 3) + Math.floor(a / 3)) - ((b % 3) + Math.floor(b / 3)));
  return (
    <Frame
      n={3}
      bounds={[0, 0, 0, 176, 176, 18]}
      name="Studio"
      hint="keys · 1–9"
      readout={`${TOOLS[active][1]} · ${active + 1}/9`}
      label="A tray of nine keys, one for each Studio tool. Press 1 to 9 to pick one."
      onKey={(k) => {
        const i = Number(k) - 1;
        if (!Number.isInteger(i) || i < 0 || i > 8) return false;
        press(i);
        return true;
      }}
    >
      <Box x={0} y={0} z={0} w={176} d={176} h={6} r={10} />
      {order.map((i) => (
        <Key
          key={TOOLS[i][0]}
          x={10 + (i % 3) * 54}
          y={10 + Math.floor(i / 3) * 54}
          z={6}
          w={46}
          d={46}
          h={9}
          size={11}
          label={TOOLS[i][0]}
          on={active === i}
          down={down === String(i)}
          onPress={() => press(i)}
        />
      ))}
    </Frame>
  );
}

/* Fig 4: a row of provider keys, one lit at a time ------------------------ */

const PROVIDERS = [
  ["OAI", "openai · api key"],
  ["ANT", "anthropic · api key"],
  ["GEM", "google · api key"],
  ["OLL", "ollama · local"],
  ["LMS", "lm studio · local"],
] as const;

function ProviderRow() {
  const [active, setActive] = useState(1);
  const [down, flash] = usePress();
  const press = (i: number) => {
    flash(String(i));
    setActive(i);
  };
  return (
    <Frame
      n={4}
      bounds={[0, 0, 0, 236, 120, 30]}
      name="Model"
      hint="keys · 1–5"
      readout={PROVIDERS[active][1]}
      label="A row of five keys for OpenAI, Anthropic, Google, Ollama and LM Studio. Press 1 to 5 to switch provider."
      onKey={(k) => {
        const i = Number(k) - 1;
        if (!Number.isInteger(i) || i < 0 || i > 4) return false;
        press(i);
        return true;
      }}
    >
      {/* Your API key, lying behind the deck: drawn first, since it is farther. */}
      <g transform={TOP(70, 4, 0)}>
        <circle className="iso-face" cx={14} cy={16} r={12} />
        <circle className="iso-detail" cx={14} cy={16} r={5} />
        <rect className="iso-face" x={24} y={12} width={52} height={8} rx={2} />
        <rect className="iso-face" x={62} y={20} width={6} height={8} />
        <rect className="iso-face" x={50} y={20} width={6} height={6} />
      </g>
      <Box x={0} y={40} z={0} w={236} d={80} h={6} r={8} />
      <g transform={TOP(0, 40, 6)}>
        <line className="iso-detail" x1={146} x2={146} y1={8} y2={72} strokeDasharray="2 3" />
        <text className="iso-label iso-dim" x={8} y={74} fontSize={6}>
          cloud
        </text>
        <text className="iso-label iso-dim" x={152} y={74} fontSize={6}>
          local
        </text>
      </g>
      {PROVIDERS.map(([label], i) => (
        <Key
          key={label}
          x={8 + i * 46}
          y={52}
          z={6}
          w={38}
          d={44}
          h={10}
          size={10}
          label={label}
          on={active === i}
          down={down === String(i)}
          onPress={() => press(i)}
        />
      ))}
    </Frame>
  );
}

/* Fig 5: a vault in the browser, its lid lifting off the notebooks -------- */

function Vault() {
  const [open, setOpen] = useState(false);
  const [down, flash] = usePress();
  const toggle = () => {
    flash("lid");
    setOpen((v) => !v);
  };
  const lift = P(0, 0, 30);
  return (
    <Frame
      n={5}
      bounds={[20, 10, 0, 180, 110, 80]}
      name="Storage"
      hint="lid · space"
      readout={open ? "3 notebooks · this browser" : "0 bytes on our servers"}
      label="A box standing for your browser, with notebooks inside. Press space to lift the lid and see them. Nothing is stored on a server."
      onKey={(k) => {
        if (k !== " " && k !== "Enter") return false;
        toggle();
        return true;
      }}
    >
      <g className={cx("iso-press", down === "lid" && "down", open && "on")} onClick={toggle}>
        <Box x={20} y={10} z={0} w={160} d={100} h={36} r={6} />
        <g transform={TOP(20, 10, 36)}>
          <rect className="iso-face iso-glass" x={8} y={8} width={144} height={84} rx={4} />
        </g>
        {[0, 1, 2].map((i) => (
          <Box key={i} x={36 + i * 44} y={28} z={36} w={36} d={56} h={6 + i * 3} r={3} />
        ))}
        <g transform={FRONT(20, 110, 36)}>
          <text className="iso-label iso-dim" x={10} y={22} fontSize={7}>
            indexeddb
          </text>
          <circle className={open ? "iso-fill-live" : "iso-bar"} cx={148} cy={18} r={3} />
        </g>
        <g className="iso-anim" style={{ transform: open ? `translate(${lift[0]}px, ${lift[1]}px)` : "translate(0px, 0px)" }}>
          <Box x={20} y={10} z={36} w={160} d={100} h={8} r={6} />
          <g transform={TOP(20, 10, 44)}>
            <rect className="iso-detail" x={66} y={40} width={28} height={20} rx={4} />
            <rect className="iso-detail" x={72} y={32} width={16} height={12} rx={8} />
          </g>
        </g>
      </g>
    </Frame>
  );
}

/* Fig 6: a stack of export files, one lifted at a time -------------------- */

const FILES = [
  ["DOCX", "report.docx · footnotes"],
  ["PPTX", "deck.pptx · speaker notes"],
  ["CSV", "cards.csv · anki"],
  ["XLSX", "table.xlsx"],
  ["SVG", "map.svg"],
] as const;

function FileStack() {
  const [active, setActive] = useState(1);
  const [down, flash] = usePress();
  const press = (i: number) => {
    flash(String(i));
    setActive(i);
  };
  return (
    <Frame
      n={6}
      bounds={[0, 0, 0, 200, 110, 46]}
      name="Export"
      hint="files · 1–5"
      readout={FILES[active][1]}
      label="Five export files side by side: Word, PowerPoint, CSV, Excel and SVG. Press 1 to 5 to lift one."
      onKey={(k) => {
        const i = Number(k) - 1;
        if (!Number.isInteger(i) || i < 0 || i > 4) return false;
        press(i);
        return true;
      }}
    >
      <Box x={0} y={0} z={0} w={200} d={110} h={4} r={8} />
      {FILES.map(([label], i) => {
        const lifted = active === i;
        const up = P(0, 0, lifted ? 14 : 0);
        return (
          <g
            key={label}
            className={cx("iso-press iso-anim", down === String(i) && "down", lifted && "on")}
            style={{ transform: `translate(${up[0]}px, ${up[1]}px)` }}
            onClick={() => press(i)}
          >
            <Box x={10 + i * 38} y={18} z={4} w={30} d={74} h={6} r={3} />
            <g transform={TOP(10 + i * 38, 18, 10)}>
              <rect className="iso-face iso-glass" x={4} y={4} width={22} height={18} rx={2} />
              <rect className="iso-bar" x={5} y={30} width={20} height={3} />
              <rect className="iso-bar" x={5} y={37} width={14} height={3} />
              <rect className="iso-bar" x={5} y={44} width={18} height={3} />
              <text
                className="iso-label"
                x={15}
                y={16}
                fontSize={6.5}
                textAnchor="middle"
              >
                {label}
              </text>
            </g>
          </g>
        );
      })}
    </Frame>
  );
}

const FIGURES = {
  citations: Citations,
  web: WebSwitch,
  studio: StudioTray,
  providers: ProviderRow,
  vault: Vault,
  exports: FileStack,
} as const;

export type IsoFigureKind = keyof typeof FIGURES;

export function IsoFigure({ kind }: { kind: IsoFigureKind }) {
  const Figure = FIGURES[kind];
  return (
    <>
      {/* Hoisted and de-duplicated by React, so the figures share one sheet. */}
      <style href="iso-figures" precedence="default">
        {CSS}
      </style>
      <Figure />
    </>
  );
}

const CSS = `
.iso-figure {
  --iso-body: var(--card);
  --iso-deck: color-mix(in srgb, var(--foreground) 5%, var(--card));
  --iso-glass: color-mix(in srgb, var(--foreground) 3%, var(--card));
  --iso-line: color-mix(in srgb, var(--foreground) 38%, var(--card));
  --iso-detail: color-mix(in srgb, var(--foreground) 20%, var(--card));
  --iso-live: var(--foreground);
}
.iso-face { fill: var(--iso-body); stroke: var(--iso-line); stroke-width: 1; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
.iso-face.iso-top { fill: var(--iso-deck); }
.iso-face.iso-glass { fill: var(--iso-glass); stroke: var(--iso-detail); }
.iso-detail { fill: none; stroke: var(--iso-detail); stroke-width: 1; vector-effect: non-scaling-stroke; }
.iso-ring { fill: none; stroke: var(--iso-live); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.iso-bar { fill: var(--iso-detail); }
.iso-fill-live, .iso-face.iso-fill-live { fill: var(--iso-live); }
.iso-label { fill: var(--iso-live); font-family: var(--font-mono), ui-monospace, monospace; font-weight: 500; letter-spacing: 0.02em; }
.iso-dim { fill: var(--iso-line); }
.iso-press { cursor: pointer; transition: transform 60ms ease-out; }
.iso-press.down { transform: translateY(3px); }
.iso-press.down .iso-face, .iso-press.on .iso-top { stroke: var(--iso-live); }
.iso-press.off .iso-label { fill: var(--iso-line); }
.iso-anim { transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), fill 160ms ease-out; }
@media (prefers-reduced-motion: reduce) {
  .iso-press, .iso-anim { transition: none; }
  .iso-press.down { transform: none; }
}
`;
