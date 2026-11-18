import type { Look } from "@/lib/bot/look";
import { faceParts, headParts, neckParts, type Part } from "./accessories";
import { prefersReducedMotion, pointerPosition, subscribe, wake } from "./clock";
import {
  DEPTH,
  apply,
  convexHull,
  faceFrame,
  planeFrame,
  project,
  rotation,
  silhouette,
  smoothClosedPath,
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
function projectionFor(look: Look): Projection {
  const hat = look.head !== "none";
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
  let projection = projectionFor(options.look);
  let samples: V3[] = [];
  let front: V3[] = [];

  const svg = el("svg", { viewBox: "0 0 100 100", width: "100%", height: "100%" });
  svg.style.display = "block";
  svg.style.overflow = "visible";

  const defs = el("defs");
  // The face's edge into the darker sides, softened, so the turn reads as volume.
  const soft = el("filter", {
    id: `${id}-soft`,
    x: "-10%",
    y: "-10%",
    width: "120%",
    height: "120%",
  });
  soft.append(el("feGaussianBlur", { stdDeviation: "1.1" }));
  defs.append(soft);

  const figure = el("g");
  const back = el("g");
  const head = el("g");
  const frontLayer = el("g");
  // The whole head in the side colour, then its front face in the body colour on top:
  // head on, the sides show only as a thin bevel; turned, they show as it turns.
  const body = el("path");
  const face = el("path", { filter: `url(#${id}-soft)` });
  const rim = el("path", {
    fill: "none",
    stroke: "var(--bot-ink)",
    "stroke-opacity": ".12",
    "stroke-width": ".7",
  });
  const eyes = ([-1, 1] as const).map(() => {
    const group = el("g");
    const pill = el("rect");
    const arc = el("path", {
      d: `M${-EYE_W * 0.75} 1.6 Q0 ${-EYE_H * 0.42} ${EYE_W * 0.75} 1.6`,
      fill: "none",
      "stroke-width": "2.6",
      "stroke-linecap": "round",
    });
    group.append(pill, arc);
    return { group, pill, arc };
  });
  head.append(body, face, rim, ...eyes.map((eye) => eye.group));
  figure.append(back, head, frontLayer);
  svg.append(defs, figure);
  host.append(svg);

  let parts: PlacedPart[] = [];

  function build() {
    projection = projectionFor(options.look);
    const dense = !options.still && host.clientWidth >= 40;
    samples = surfaceSamples(dense ? 16 : 10, dense ? 32 : 20);
    front = samples.filter((point) => point[2] > DEPTH * 0.42);
    for (const placed of parts) placed.node.remove();
    const look = options.look;
    parts = [...headParts[look.head], ...faceParts[look.face], ...neckParts[look.neck]].map(
      (part) => {
        const node = el("g");
        node.innerHTML = part.svg;
        const layer = part.layer === "back" ? "back" : "front";
        (layer === "back" ? back : frontLayer).append(node);
        return { part, node, layer };
      },
    );
    body.style.fill = `color-mix(in oklab, ${options.body} 74%, var(--bot-ink))`;
    face.style.fill = options.body;
    if (!dense) face.removeAttribute("filter");
    else face.setAttribute("filter", `url(#${id}-soft)`);
    for (const eye of eyes) {
      eye.pill.setAttribute("fill", options.eyes);
      eye.arc.setAttribute("stroke", options.eyes);
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
    const outline = silhouette(m, samples, projection);
    body.setAttribute("d", outline);
    rim.setAttribute("d", outline);
    face.setAttribute(
      "d",
      smoothClosedPath(convexHull(front.map((point) => project(apply(m, point), projection)))),
    );

    // Eyes slide across the face toward where they look, and fold away as it turns.
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
      const open = Math.max(0.09, (1 - current.blink) * (1 - 0.38 * current.squint));
      const h = EYE_H * open;
      eye.pill.setAttribute("x", String(-EYE_W / 2));
      eye.pill.setAttribute("width", String(EYE_W));
      eye.pill.setAttribute("y", (-h / 2).toFixed(2));
      eye.pill.setAttribute("height", h.toFixed(2));
      eye.pill.setAttribute("rx", String(Math.min(EYE_W / 2, h / 2)));
      eye.pill.setAttribute("opacity", (1 - current.happy).toFixed(3));
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
        (change.still !== undefined && change.still !== options.still);
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
