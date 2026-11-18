import type { Look } from "@/lib/bot/look";
import { faceParts, HATCH, headParts, neckParts, type Part } from "./accessories";
import { prefersReducedMotion, pointerPosition, subscribe, wake } from "./clock";
import {
  faceFrame,
  planeFrame,
  rotation,
  silhouette,
  surfaceSamples,
  toTransform,
  uprightFrame,
  type Frame,
  type Projection,
  type V3,
  type View,
} from "./geometry";
import { blendPoses, hashSeed, pose, stepSpring, type Mood, type Pose, type Spring } from "./pose";

/**
 * Draws the character into an element and keeps it moving: an SVG whose
 * paths and transforms are updated each frame, so React renders it once.
 */

export interface CharacterOptions {
  look: Look;
  /** The body's colour and the eyes' colour, as CSS colours (theme variables). */
  body: string;
  eyes: string;
  mood?: Mood;
  /** Turns toward the pointer anywhere on the page. */
  followPointer?: boolean;
  /** One drawing of the resting pose, never animated (tiles, thumbnails). */
  still?: boolean;
  /** "figure" leaves room for what it wears; "head" fills the box with the head (small spots). */
  fit?: "figure" | "head";
  /** Varies blinks and wander between characters. */
  seed?: string;
  /** Accessible name; empty marks it decorative. */
  label?: string;
}

export interface MountedCharacter {
  update(options: Partial<CharacterOptions>): void;
  destroy(): void;
}

const SVG = "http://www.w3.org/2000/svg";
let instances = 0;

const el = <K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string> = {}) => {
  const node = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};

/** Where the head sits in the 100×100 drawing: smaller and lower when it wears a hat. */
function projectionFor(look: Look, fit: "figure" | "head" = "figure"): Projection {
  const hat = look.head !== "none";
  // Small spots (list rows, the chat header): the head fills the box, and a hat's top is cropped.
  if (fit === "head") return { cx: 50, cy: hat ? 55 : 50, scale: hat ? 37 : 41 };
  const neck = look.neck !== "none";
  return {
    cx: 50,
    cy: (hat ? 60 : 52) - (neck ? 3 : 0),
    scale: hat ? 26 : 31,
  };
}

/** The eyes, measured from the design: tall pills on the centre line, a little apart. */
const EYE_X = 0.29;
const EYE_Y = -0.03;
const EYE_W = 7.6;
const EYE_H = 16.5;
/** Control points round each eye. */
const EYE_POINTS = 14;

/** Evenly spaced points round a pill (a stadium) of width w and height h, centred on 0. */
function pillPoints(w: number, h: number, count: number): [number, number][] {
  const r = Math.min(w, h) / 2;
  const straight = Math.max(0, h - 2 * r);
  const length = 2 * straight + 2 * Math.PI * r;
  return Array.from({ length: count }, (_, at) => {
    let s = (at / count) * length;
    // Right side down, bottom arc, left side up, top arc.
    if (s < straight) return [r, -straight / 2 + s];
    s -= straight;
    if (s < Math.PI * r) {
      const a = s / r;
      return [r * Math.cos(a), straight / 2 + r * Math.sin(a)];
    }
    s -= Math.PI * r;
    if (s < straight) return [-r, straight / 2 - s];
    s -= straight;
    const a = Math.PI + s / r;
    return [r * Math.cos(a), -straight / 2 + r * Math.sin(a)];
  });
}
const DESIGN = 30;

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

interface PlacedPart {
  part: Part;
  node: SVGGElement;
  layer: "back" | "front";
}

export function mountCharacter(host: HTMLElement, initial: CharacterOptions): MountedCharacter {
  const id = `bvc${++instances}`;
  let options: CharacterOptions = { mood: "idle", ...initial };
  let projection = projectionFor(options.look, options.fit);
  let samples: V3[] = [];

  const svg = el("svg", { viewBox: "0 0 100 100", width: "100%", height: "100%" });
  svg.style.display = "block";
  svg.style.overflow = "visible";

  const defs = el("defs");
  // Hatching for the eyes and dark parts, in the bot's colour, as in the design.
  const hatch = el("pattern", {
    id: `${id}-hatch`,
    patternUnits: "userSpaceOnUse",
    width: "2.6",
    height: "2.6",
    patternTransform: "rotate(40)",
  });
  const hatchLine = el("path", { d: "M0 0 V2.6", stroke: "var(--bot-line)", "stroke-width": ".9" });
  hatch.append(hatchLine);
  defs.append(hatch);

  const surface = "var(--bot-surface, var(--card))";
  const line = "var(--bot-line)";
  const figure = el("g", { "stroke-linejoin": "round", "stroke-linecap": "round" });
  const back = el("g");
  const head = el("g");
  const frontLayer = el("g");
  // The head: its outline over the page colour.
  const body = el("path", { fill: surface, stroke: line });
  const eyes = ([-1, 1] as const).map(() => {
    const group = el("g");
    const pill = el("rect", { stroke: line });
    // The control points round each eye, as in the design.
    const points = el("g", { fill: surface, stroke: line });
    const dots = Array.from({ length: EYE_POINTS }, () => el("circle", { r: ".95" }));
    points.append(...dots);
    const arc = el("path", {
      d: `M${-EYE_W * 0.75} 1.6 Q0 ${-EYE_H * 0.42} ${EYE_W * 0.75} 1.6`,
      fill: "none",
      stroke: line,
    });
    group.append(pill, points, arc);
    return { group, pill, points, dots, arc };
  });
  head.append(body, ...eyes.map((eye) => eye.group));
  figure.append(back, head, frontLayer);
  svg.append(defs, figure);
  host.append(svg);

  let parts: PlacedPart[] = [];
  /** How much of the construction shows: all of it when large, less when small. */
  let detail: "full" | "mid" | "low" = "full";

  /** Strokes keep their width on screen, so lines stay fine at every size. */
  const fineStrokes = (root: Element, width: number) => {
    for (const node of [root, ...root.querySelectorAll("*")]) {
      if (node instanceof SVGGeometryElement)
        node.setAttribute("vector-effect", "non-scaling-stroke");
    }
    root.setAttribute("stroke-width", String(width));
  };

  function build() {
    projection = projectionFor(options.look, options.fit);
    const width = host.clientWidth || 64;
    // Detail follows the size of the head on screen, not of the box.
    const headSize = (width * projection.scale) / 31;
    detail = headSize >= 44 ? "full" : headSize >= 24 ? "mid" : "low";
    // Hatching keeps the same spacing on screen at every size, so small eyes still show it.
    const grain = Math.min(2.8, Math.max(1, 72 / headSize));
    hatch.setAttribute("width", (2.6 * grain).toFixed(2));
    hatch.setAttribute("height", (2.6 * grain).toFixed(2));
    hatchLine.setAttribute("d", `M0 0 V${(2.6 * grain).toFixed(2)}`);
    hatchLine.setAttribute("stroke-width", (0.9 * grain).toFixed(2));
    const dense = !options.still && width >= 40;
    samples = surfaceSamples(dense ? 16 : 10, dense ? 32 : 20);
    svg.style.setProperty("--bot-line", options.body);
    const fill = detail === "low" ? line : `url(#${id}-hatch)`;
    for (const placed of parts) placed.node.remove();
    const look = options.look;
    parts = [...headParts[look.head], ...faceParts[look.face], ...neckParts[look.neck]].map(
      (part) => {
        const node = el("g", { fill: surface, stroke: line });
        node.innerHTML = part.svg.replaceAll(`"${HATCH}"`, `"${fill}"`);
        fineStrokes(node, detail === "low" ? 1 : 1.25);
        const layer = part.layer === "back" ? "back" : "front";
        (layer === "back" ? back : frontLayer).append(node);
        return { part, node, layer };
      },
    );
    const outlineWidth = detail === "full" ? 1.6 : detail === "mid" ? 1.35 : 1.2;
    fineStrokes(body, outlineWidth);
    for (const eye of eyes) {
      eye.pill.setAttribute("fill", fill);
      fineStrokes(eye.pill, detail === "full" ? 1.25 : 1);
      fineStrokes(eye.points, 1);
      eye.points.style.display = detail === "full" ? "" : "none";
      fineStrokes(eye.arc, detail === "low" ? 1.4 : 2);
    }
    if (options.label) {
      svg.setAttribute("role", "img");
      svg.setAttribute("aria-label", options.label);
      svg.removeAttribute("aria-hidden");
    } else {
      svg.setAttribute("aria-hidden", "true");
      svg.removeAttribute("role");
      svg.removeAttribute("aria-label");
    }
  }

  // Motion state.
  const seed = hashSeed(options.seed ?? id);
  const look = { x: { value: 0, velocity: 0 }, y: { value: 0, velocity: 0 } };
  const trail: Record<keyof View, Spring> = {
    yaw: { value: 0, velocity: 0 },
    pitch: { value: 0, velocity: 0 },
    roll: { value: 0, velocity: 0 },
  };
  let looking = 0;
  let blend: { from: Pose; start: number } | null = null;
  let lastPose: Pose | null = null;
  let mood = options.mood ?? "idle";
  let visible = true;
  let dirty = true;
  let lastDraw = 0;

  function frameFor(spec: Part["frame"], view: View): Frame {
    const m = rotation(view);
    if (spec.kind === "face") return faceFrame(m, spec.x, spec.y, projection);
    if (spec.kind === "upright") return uprightFrame(m, spec.point, projection);
    return planeFrame(m, spec.point, spec.xAxis, spec.yAxis, projection);
  }

  /** A frame's transform, with the drawing's units scaled to this head. */
  function placed(frame: Frame): string {
    const k = projection.scale / DESIGN;
    const [a, b, c, d, e, f] = frame.matrix;
    return toTransform({ ...frame, matrix: [a * k, b * k, c * k, d * k, e, f] });
  }

  function draw(time: number, dt: number) {
    const reduced = prefersReducedMotion();
    // Where to look: the pointer, relative to where the character is on the page.
    let target: { x: number; y: number } | null = null;
    const pointer = options.followPointer ? pointerPosition() : null;
    if (pointer) {
      const box = host.getBoundingClientRect();
      const reach = Math.max(240, Math.min(window.innerWidth, window.innerHeight) * 0.45);
      target = {
        x: clamp((pointer.x - (box.left + box.width / 2)) / reach, -1, 1),
        y: clamp((pointer.y - (box.top + box.height / 2)) / reach, -1, 1),
      };
    }
    const steps = reduced || options.still ? 1e3 : dt;
    stepSpring(look.x, target?.x ?? 0, steps, 70);
    stepSpring(look.y, target?.y ?? 0, steps, 70);
    const wantLook = target ? 1 : 0;
    looking += (wantLook - looking) * (reduced ? 1 : 1 - Math.exp(-dt * 6));

    let current = pose({
      time: options.still ? 0 : time,
      mood,
      seed,
      look: looking > 0.01 ? { x: look.x.value * looking, y: look.y.value * looking } : null,
      reducedMotion: reduced || options.still,
    });
    if (blend) {
      const t = (time - blend.start) / 0.32;
      if (t >= 1 || reduced) blend = null;
      else current = blendPoses(blend.from, current, easeInOut(t));
    }
    lastPose = current;

    const view: View = { yaw: current.yaw, pitch: current.pitch, roll: current.roll };
    for (const key of ["yaw", "pitch", "roll"] as const)
      stepSpring(trail[key], view[key], reduced || options.still ? 1e3 : dt, 90);
    const m = rotation(view);

    // Squash and stretch about the base, and the hop.
    const base = projection.cy + projection.scale;
    figure.setAttribute(
      "transform",
      `translate(0 ${current.lift.toFixed(2)}) translate(${projection.cx} ${base}) scale(${current.sx.toFixed(4)} ${current.sy.toFixed(4)}) translate(${-projection.cx} ${-base})`,
    );
    body.setAttribute("d", silhouette(m, samples, projection));
    // Eyes slide across the face toward where they look, and fold away as it turns.
    const open = Math.max(0.09, (1 - current.blink) * (1 - 0.38 * current.squint));
    const h = EYE_H * open;
    const ring = pillPoints(EYE_W, h, EYE_POINTS);
    eyes.forEach((eye, index) => {
      const side = index === 0 ? -1 : 1;
      const frame = faceFrame(
        m,
        side * EYE_X + current.gazeX * 0.07,
        EYE_Y - current.gazeY * 0.06,
        projection,
      );
      eye.group.setAttribute("transform", placed(frame));
      eye.group.setAttribute("opacity", clamp(frame.facing * 4, 0, 1).toFixed(3));
      eye.pill.setAttribute("x", String(-EYE_W / 2));
      eye.pill.setAttribute("width", String(EYE_W));
      eye.pill.setAttribute("y", (-h / 2).toFixed(2));
      eye.pill.setAttribute("height", h.toFixed(2));
      eye.pill.setAttribute("rx", String(Math.min(EYE_W / 2, h / 2)));
      const shown = (1 - current.happy).toFixed(3);
      eye.pill.setAttribute("opacity", shown);
      eye.points.setAttribute("opacity", open < 0.35 ? "0" : shown);
      if (detail === "full")
        eye.dots.forEach((dot, at) => {
          dot.setAttribute("cx", ring[at][0].toFixed(2));
          dot.setAttribute("cy", ring[at][1].toFixed(2));
        });
      eye.arc.setAttribute("opacity", current.happy.toFixed(3));
    });

    // Accessories follow a view that trails the head's, by how much each lags.
    for (const item of parts) {
      const lag = item.part.lag ?? 0;
      const partView: View = {
        yaw: view.yaw + (trail.yaw.value - view.yaw) * lag,
        pitch: view.pitch + (trail.pitch.value - view.pitch) * lag,
        roll: view.roll + (trail.roll.value - view.roll) * lag * 1.6,
      };
      const frame = frameFor(item.part.frame, partView);
      item.node.setAttribute("transform", placed(frame));
      if (item.part.facing)
        item.node.setAttribute("opacity", clamp(frame.facing * 4, 0, 1).toFixed(3));
      if (item.part.layer === "auto") {
        const layer = frame.depth >= 0 ? "front" : "back";
        if (layer !== item.layer) {
          item.layer = layer;
          (layer === "back" ? back : frontLayer).append(item.node);
        }
      }
    }

    // Small characters move at half the frame rate.
    lastDraw = time;
    const settling = Math.abs(look.x.velocity) + Math.abs(look.y.velocity) > 1e-3 || blend !== null;
    return !options.still && !reduced ? true : settling;
  }

  build();

  const observer =
    typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver(([entry]) => {
          visible = entry?.isIntersecting ?? true;
          if (visible) wake();
        })
      : null;
  observer?.observe(host);

  const unsubscribe = subscribe((time, dt) => {
    // Off screen, or a still that is drawn: no frames until something changes.
    if ((!visible || options.still) && !dirty) return false;
    if (!dirty && host.clientWidth < 40 && time - lastDraw < 1 / 30) return true;
    dirty = false;
    return draw(time, dt);
  });

  return {
    update(change) {
      const rebuild =
        (change.look &&
          (change.look.head !== options.look.head ||
            change.look.face !== options.look.face ||
            change.look.neck !== options.look.neck)) ||
        (change.body !== undefined && change.body !== options.body) ||
        (change.eyes !== undefined && change.eyes !== options.eyes) ||
        (change.label !== undefined && change.label !== options.label) ||
        (change.still !== undefined && change.still !== options.still) ||
        (change.fit !== undefined && change.fit !== options.fit);
      const nextMood = change.mood ?? options.mood ?? "idle";
      options = { ...options, ...change };
      if (nextMood !== mood) {
        if (lastPose) blend = { from: lastPose, start: performance.now() / 1000 };
        mood = nextMood;
      }
      if (rebuild) build();
      dirty = true;
      wake();
    },
    destroy() {
      unsubscribe();
      observer?.disconnect();
      svg.remove();
    },
  };
}
