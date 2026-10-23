import * as k from "./kit/iso-kit";
import type { Geometry, Part, PartDetail, Scene } from "./scene";

/** The size of the drawing, in SVG units. */
export const FIGURE_WIDTH = 640;
export const FIGURE_HEIGHT = 420;

type P3 = k.Point3;
type Plane = k.Plane;
type Flat = k.Flat;
type Projection = k.Projection;

export interface Bounds {
  min: P3;
  max: P3;
}

/** Where a part has moved from where it is drawn, and how far it has turned. */
export interface PartPose {
  offset: P3;
  turn: number;
  stretch: number;
}
export type Pose = Map<string, PartPose>;

const RADIANS = Math.PI / 180;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));
const has = (details: readonly PartDetail[], detail: PartDetail) => details.includes(detail);

/* ------------------------------------------------------------------ camera */

export const cameraLimits = { azimuth: [25, 65], elevation: [20, 50] } as const;

export function cameraOf(scene: Pick<Scene, "camera">) {
  return {
    azimuth: clamp(scene.camera.azimuth || 45, ...cameraLimits.azimuth),
    elevation: clamp(scene.camera.elevation || 30, ...cameraLimits.elevation),
  };
}

/** How depth grows toward the viewer, per world unit along x, y and z. */
function viewDirection(projection: Projection): P3 {
  return [
    k.depthOf([1, 0, 0], projection),
    k.depthOf([0, 1, 0], projection),
    k.depthOf([0, 0, 1], projection),
  ];
}

/* ------------------------------------------------------------------ bounds */

/** Turns a plan point around a centre, clockwise seen from above. */
function rotator(cx: number, cy: number, turn: number): (point: Plane) => Plane {
  if (!turn) return (point) => point;
  const cos = Math.cos(turn * RADIANS);
  const sin = Math.sin(turn * RADIANS);
  return ([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  };
}

type BoxGeometry = Extract<Geometry, { kind: "box" }>;

function planOf(g: BoxGeometry): k.Plan {
  return { x: g.x, y: g.y, w: g.w, d: g.d, r: clamp(g.corner, 0, Math.min(g.w, g.d) / 2) };
}

function boxRing(g: BoxGeometry, turn: number): Plane[] {
  const plan = planOf(g);
  const steps = plan.r > 0 ? clamp(Math.round(plan.r * 1.5), 2, 8) : 0;
  return k.roundedPlan(plan, steps).map(rotator(g.x + g.w / 2, g.y + g.d / 2, turn));
}

function needleEnds(g: Extract<Geometry, { kind: "needle" }>, turn: number): [Plane, Plane] {
  const angle = (g.angle + turn) * RADIANS;
  const dx = Math.sin(angle);
  const dy = -Math.cos(angle);
  const tail = g.length * 0.18;
  return [
    [g.x - dx * tail, g.y - dy * tail],
    [g.x + dx * g.length, g.y + dy * g.length],
  ];
}

function boundsOfPoints(points: P3[], pad = 0): Bounds {
  const min: P3 = [Infinity, Infinity, Infinity];
  const max: P3 = [-Infinity, -Infinity, -Infinity];
  for (const point of points) {
    for (let axis = 0; axis < 3; axis++) {
      min[axis] = Math.min(min[axis], point[axis] - pad);
      max[axis] = Math.max(max[axis], point[axis] + pad);
    }
  }
  return { min, max };
}

/** A part grown along its axis by `stretch`. */
export function stretched(g: Geometry, stretch: number): Geometry {
  if (!stretch) return g;
  switch (g.kind) {
    case "box":
    case "cylinder":
      return { ...g, h: Math.max(0.4, g.h + stretch) };
    case "rod":
    case "spring":
      return { ...g, length: Math.max(0.4, g.length + stretch) };
    case "needle":
      return { ...g, length: Math.max(0.4, g.length + stretch) };
    default:
      return g;
  }
}

/** The box a part fills, where it is drawn, turned by `turn` degrees. */
export function boundsOf(g: Geometry, turn = 0): Bounds {
  switch (g.kind) {
    case "box": {
      if (!turn) return { min: [g.x, g.y, g.z], max: [g.x + g.w, g.y + g.d, g.z + g.h] };
      const ring = boxRing(g, turn);
      return boundsOfPoints([
        ...ring.map(([x, y]): P3 => [x, y, g.z]),
        ...ring.map(([x, y]): P3 => [x, y, g.z + g.h]),
      ]);
    }
    case "cylinder":
      return {
        min: [g.x - g.radius, g.y - g.radius, g.z],
        max: [g.x + g.radius, g.y + g.radius, g.z + g.h],
      };
    case "rod":
      return g.axis === "x"
        ? {
            min: [g.x, g.y - g.radius, g.z - g.radius],
            max: [g.x + g.length, g.y + g.radius, g.z + g.radius],
          }
        : {
            min: [g.x - g.radius, g.y, g.z - g.radius],
            max: [g.x + g.radius, g.y + g.length, g.z + g.radius],
          };
    case "spring":
      if (g.axis === "z")
        return {
          min: [g.x - g.radius, g.y - g.radius, g.z],
          max: [g.x + g.radius, g.y + g.radius, g.z + g.length],
        };
      return g.axis === "x"
        ? {
            min: [g.x, g.y - g.radius, g.z - g.radius],
            max: [g.x + g.length, g.y + g.radius, g.z + g.radius],
          }
        : {
            min: [g.x - g.radius, g.y, g.z - g.radius],
            max: [g.x + g.radius, g.y + g.length, g.z + g.radius],
          };
    case "ball":
      return {
        min: [g.x - g.radius, g.y - g.radius, g.z - g.radius],
        max: [g.x + g.radius, g.y + g.radius, g.z + g.radius],
      };
    case "needle": {
      const [tail, tip] = needleEnds(g, turn);
      return boundsOfPoints([
        [tail[0], tail[1], g.z],
        [tip[0], tip[1], g.z + 0.3],
      ]);
    }
    case "cable":
      return boundsOfPoints(
        g.points.map((point): P3 => [point.x, point.y, point.z]),
        0.6,
      );
  }
}

export const moveBounds = ({ min, max }: Bounds, [dx, dy, dz]: P3): Bounds => ({
  min: [min[0] + dx, min[1] + dy, min[2] + dz],
  max: [max[0] + dx, max[1] + dy, max[2] + dz],
});

export const cornersOf = ({ min, max }: Bounds): P3[] => {
  const out: P3[] = [];
  for (const x of [min[0], max[0]])
    for (const y of [min[1], max[1]]) for (const z of [min[2], max[2]]) out.push([x, y, z]);
  return out;
};

/** Lines and pointers: drawn as strokes, never as solids. */
export const isLine = (g: Geometry) =>
  g.kind === "needle" || g.kind === "cable" || g.kind === "spring";

/** Long thin parts, which may run through a bushing, sleeve or hole. */
export function isSlender(g: Geometry): boolean {
  if (g.kind === "rod" || g.kind === "spring" || isLine(g)) return true;
  if (g.kind === "cylinder") return g.h >= g.radius * 4 && g.radius <= 6;
  if (g.kind === "box") {
    const sides = [g.w, g.d, g.h].sort((a, b) => a - b);
    return sides[2] >= sides[1] * 5 && sides[1] <= 6;
  }
  return false;
}

/* ------------------------------------------------------------------ poses */

/** Where every part is in a step, with the figure taken apart by `explode` (0 to 1). */
export function poseFor(scene: Scene, stepIndex: number, explode: number): Pose {
  const pose: Pose = new Map(
    scene.parts.map((part) => [part.id, { offset: [0, 0, 0], turn: 0, stretch: 0 }]),
  );
  const members = new Map<string, string[]>();
  for (const part of scene.parts)
    members.set(part.assembly, [...(members.get(part.assembly) ?? []), part.id]);
  const add = (id: string, [x, y, z]: P3, turn = 0, stretch = 0) => {
    const current = pose.get(id);
    if (!current) return;
    current.offset = [current.offset[0] + x, current.offset[1] + y, current.offset[2] + z];
    current.turn += turn;
    current.stretch += stretch;
  };
  for (const move of scene.steps[stepIndex]?.moves ?? []) {
    const offset: P3 = [move.offset.x, move.offset.y, move.offset.z];
    if (pose.has(move.target)) add(move.target, offset, move.turn, move.stretch);
    else for (const id of members.get(move.target) ?? []) add(id, offset);
  }
  if (explode > 0) {
    for (const assembly of scene.assemblies) {
      const offset: P3 = [
        assembly.explode.x * explode,
        assembly.explode.y * explode,
        assembly.explode.z * explode,
      ];
      for (const id of members.get(assembly.id) ?? []) add(id, offset);
    }
  }
  return pose;
}

/** A camera that keeps every part in view in every step: together, or also taken apart. */
export function fitFigure(scene: Scene, { apart = false }: { apart?: boolean } = {}): Projection {
  const points: P3[] = [];
  const steps = Math.max(1, scene.steps.length);
  for (let step = 0; step < steps; step++) {
    for (const explode of apart ? [0, 1] : [0]) {
      const pose = poseFor(scene, step, explode);
      for (const part of scene.parts) {
        const at = pose.get(part.id)!;
        points.push(
          ...cornersOf(
            moveBounds(boundsOf(stretched(part.geometry, at.stretch), at.turn), at.offset),
          ),
        );
      }
    }
  }
  const { azimuth, elevation } = cameraOf(scene);
  return k.fitProjection(points, FIGURE_WIDTH, FIGURE_HEIGHT, { pad: 28, azimuth, elevation });
}

/* ------------------------------------------------------------------ painter's order */

function hull(points: Flat[]): Flat[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const cross = (o: Flat, a: Flat, b: Flat) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Flat[] = [];
  for (const point of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0)
      lower.pop();
    lower.push(point);
  }
  const upper: Flat[] = [];
  for (let index = sorted.length - 1; index >= 0; index--) {
    const point = sorted[index];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0)
      upper.pop();
    upper.push(point);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Whether two convex outlines overlap by more than a hair. */
function overlaps(a: Flat[], b: Flat[]): boolean {
  if (a.length < 2 || b.length < 2) return false;
  for (const shape of [a, b]) {
    for (let index = 0; index < shape.length; index++) {
      const [x1, y1] = shape[index];
      const [x2, y2] = shape[(index + 1) % shape.length];
      const nx = y1 - y2;
      const ny = x2 - x1;
      const length = Math.hypot(nx, ny) || 1;
      const project = (points: Flat[]) => {
        let low = Infinity;
        let high = -Infinity;
        for (const [x, y] of points) {
          const value = (x * nx + y * ny) / length;
          low = Math.min(low, value);
          high = Math.max(high, value);
        }
        return [low, high];
      };
      const [aLow, aHigh] = project(a);
      const [bLow, bHigh] = project(b);
      if (aHigh <= bLow + 0.05 || bHigh <= aLow + 0.05) return false;
    }
  }
  return true;
}

export interface Placed {
  id: string;
  bounds: Bounds;
}

/**
 * Back to front, bottom to top. Where two parts overlap on screen, a plane
 * that separates their boxes decides which is nearer; parts that run through
 * each other fall back to the depth of their centres.
 */
export function paintOrder(items: readonly Placed[], projection: Projection): string[] {
  const view = viewDirection(projection);
  const centreDepth = items.map(({ bounds: { min, max } }) =>
    k.depthOf([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2], projection),
  );
  const outlines = items.map(({ bounds }) =>
    hull(cornersOf(bounds).map((point) => k.iso(point, projection))),
  );
  const after: number[][] = items.map(() => []);
  const before = items.map(() => 0);

  const inFront = (a: Bounds, b: Bounds, ia: number, ib: number): boolean => {
    for (let axis = 0; axis < 3; axis++) {
      if (Math.abs(view[axis]) < 1e-6) continue;
      if (a.min[axis] >= b.max[axis] - 0.01) return view[axis] > 0;
      if (b.min[axis] >= a.max[axis] - 0.01) return view[axis] < 0;
    }
    return centreDepth[ia] >= centreDepth[ib];
  };

  for (let a = 0; a < items.length; a++) {
    for (let b = a + 1; b < items.length; b++) {
      if (!overlaps(outlines[a], outlines[b])) continue;
      const [back, front] = inFront(items[a].bounds, items[b].bounds, a, b) ? [b, a] : [a, b];
      after[back].push(front);
      before[front]++;
    }
  }

  const order: number[] = [];
  const done = items.map(() => false);
  const ready = new Set(items.map((_, index) => index).filter((index) => before[index] === 0));
  while (order.length < items.length) {
    let pick = -1;
    const pool = ready.size
      ? [...ready]
      : items.map((_, index) => index).filter((index) => !done[index]);
    for (const index of pool) if (pick < 0 || centreDepth[index] < centreDepth[pick]) pick = index;
    ready.delete(pick);
    done[pick] = true;
    order.push(pick);
    for (const next of after[pick]) {
      before[next]--;
      if (before[next] <= 0 && !done[next]) ready.add(next);
    }
  }
  return order.map((index) => items[index].id);
}

/** The order to paint the parts in a pose. */
export function orderFor(scene: Scene, pose: Pose, projection: Projection): string[] {
  return paintOrder(
    scene.parts.map((part) => {
      const at = pose.get(part.id) ?? { offset: [0, 0, 0] as P3, turn: 0, stretch: 0 };
      return {
        id: part.id,
        bounds: moveBounds(boundsOf(stretched(part.geometry, at.stretch), at.turn), at.offset),
      };
    }),
    projection,
  );
}

/* ------------------------------------------------------------------ drawing */

const S = k.solidSvg;
const L = k.lineSvg;

/** A convex prism along `along`, from a cross-section ring: rods and bars on their side. */
function prism(ring: P3[], along: P3, projection: Projection): k.SolidPaths {
  const count = ring.length;
  const far = ring.map(([x, y, z]): P3 => [x + along[0], y + along[1], z + along[2]]);
  const centre = ring.reduce<P3>(
    (sum, [x, y, z]) => [sum[0] + x / count, sum[1] + y / count, sum[2] + z / count],
    [0, 0, 0],
  );
  const length = Math.hypot(...along) || 1;
  const axis: P3 = [along[0] / length, along[1] / length, along[2] / length];
  const facing = (normal: P3) => k.depthOf(normal, projection) > 1e-9;
  const near = ring.map((point) => k.iso(point, projection));
  const away = far.map((point) => k.iso(point, projection));
  const { sinA, cosA } = k.cameraOf(projection);
  const buckets: string[][] = Array.from({ length: k.SHADES }, () => []);

  for (let index = 0; index < count; index++) {
    const next = (index + 1) % count;
    const mid: P3 = [
      (ring[index][0] + ring[next][0]) / 2 - centre[0],
      (ring[index][1] + ring[next][1]) / 2 - centre[1],
      (ring[index][2] + ring[next][2]) / 2 - centre[2],
    ];
    const size = Math.hypot(...mid) || 1;
    const normal: P3 = [mid[0] / size, mid[1] / size, mid[2] / size];
    if (!facing(normal)) continue;
    const lit = clamp(
      0.5 +
        0.5 * (normal[0] * -sinA + normal[1] * cosA) * (1 - Math.abs(normal[2])) +
        0.5 * normal[2],
      0,
      0.999,
    );
    buckets[Math.floor(lit * k.SHADES)].push(
      k.pathOf([near[index], near[next], away[next], away[index]], true),
    );
  }

  const capNear = facing([-axis[0], -axis[1], -axis[2]]);
  const cap = capNear ? near : away;
  const outline = hull([...near, ...away]);
  return {
    fill: k.pathOf(outline, true),
    outline: k.pathOf(outline, true),
    crease: k.pathOf(cap, true),
    top: k.pathOf(cap, true),
    shades: buckets.map((paths) => paths.join("")),
    seamless: true,
  };
}

function crossSection([x, y, z]: P3, radius: number, axis: "x" | "y", steps = 24): P3[] {
  return Array.from({ length: steps }, (_, step) => {
    const angle = (step / steps) * Math.PI * 2;
    const u = radius * Math.cos(angle);
    const v = radius * Math.sin(angle);
    return axis === "x" ? [x, y + u, z + v] : [x + u, y, z + v];
  });
}

/** The half of a ring around a rod that faces the viewer. */
function frontArc(
  [x, y, z]: P3,
  radius: number,
  axis: "x" | "y",
  projection: Projection,
  steps = 24,
): string {
  const points: Flat[] = [];
  const runs: string[] = [];
  for (let step = 0; step <= steps; step++) {
    const angle = (step / steps) * Math.PI * 2;
    const u = Math.cos(angle);
    const v = Math.sin(angle);
    const normal: P3 = axis === "x" ? [0, u, v] : [u, 0, v];
    const point: P3 =
      axis === "x" ? [x, y + radius * u, z + radius * v] : [x + radius * u, y, z + radius * v];
    if (k.depthOf(normal, projection) > 0) points.push(k.iso(point, projection));
    else if (points.length) {
      runs.push(k.pathOf(points));
      points.length = 0;
    }
  }
  if (points.length) runs.push(k.pathOf(points));
  return runs.join("");
}

/** A spring standing up: the coil split into the half behind and the half in front. */
function upright(
  x: number,
  y: number,
  z: number,
  length: number,
  radius: number,
  turns: number,
  projection: Projection,
) {
  const count = Math.max(1, Math.round(turns * 16));
  const back: string[] = [];
  const front: string[] = [];
  let run: Flat[] = [];
  let near: boolean | null = null;
  for (let index = 0; index <= count; index++) {
    const share = index / count;
    const angle = share * turns * Math.PI * 2;
    const point = k.iso(
      [x + radius * Math.cos(angle), y + radius * Math.sin(angle), z + length * share],
      projection,
    );
    const facing = k.depthOf([Math.cos(angle), Math.sin(angle), 0], projection) > 0;
    if (near === null) near = facing;
    if (facing !== near) {
      run.push(point);
      (near ? front : back).push(k.pathOf(run));
      run = [point];
      near = facing;
      continue;
    }
    run.push(point);
  }
  if (run.length > 1) (near ? front : back).push(k.pathOf(run));
  return { back: back.join(""), front: front.join("") };
}

const hit = (d: string) => (d ? `<path class="anatomy-hit" d="${d}"/>` : "");

function boxSvg(
  part: Part & { geometry: BoxGeometry },
  projection: Projection,
  turn: number,
  lit: boolean,
): string {
  const g = part.geometry;
  const subject = part.role === "subject";
  const plan = planOf(g);
  const short = Math.min(g.w, g.d);
  const long = Math.max(g.w, g.d);
  const top = g.z + g.h;
  const place = rotator(g.x + g.w / 2, g.y + g.d / 2, turn);
  const onTop = (points: Plane[], closed = false) =>
    k.onTop(points.map(place), top, projection, closed);
  const bevel = g.h >= 3 && short >= 6 ? Math.min(1.2, g.h * 0.12, short * 0.06) : 0;
  const ring = boxRing(g, turn);
  const out = [
    S(k.extrude(ring, g.z, g.h, projection, { convex: true, bevel }), {
      tone: subject ? "hi" : "mid",
      crease: Math.min(short, g.h) < 3 ? "none" : subject ? "lo" : "faint",
      flat: g.h < 1,
      lit,
    }),
  ];
  const details = g.details;
  const toward = k.towardViewer(projection);

  if (has(details, "seam") && g.h >= 4)
    out.push(L(k.ringSeam(ring, g.z + g.h / 2, projection), { tone: "faint" }));
  if (has(details, "groove") && short >= 10) {
    const inset = clamp(short * 0.08, 1.5, 5);
    out.push(
      L(onTop(k.roundedPlan(k.insetPlan(plan, inset), plan.r > 0 ? 4 : 0), true), {
        tone: "faint",
      }),
    );
  }
  if (has(details, "ruler") && long >= 24 && short >= 6) {
    const alongX = g.w >= g.d;
    const from = (alongX ? g.x : g.y) + 4;
    const to = (alongX ? g.x + g.w : g.y + g.d) - 4;
    const front = alongX ? toward[1] >= 0 : toward[0] >= 0;
    const edge = alongX
      ? front
        ? g.y + g.d - 1.5
        : g.y + 1.5
      : front
        ? g.x + g.w - 1.5
        : g.x + 1.5;
    const inward = front ? -1 : 1;
    const spacing = long >= 60 ? 4 : Math.max(2, (to - from) / 15);
    const lengths = [Math.min(2, short * 0.14), Math.min(3.6, short * 0.24)];
    const minor: string[] = [];
    const major: string[] = [];
    for (let at = from, index = 0; at <= to + 1e-6; at += spacing, index++) {
      const length = lengths[index % 5 === 0 ? 1 : 0];
      const a: Plane = alongX ? [at, edge] : [edge, at];
      const b: Plane = alongX ? [at, edge + inward * length] : [edge + inward * length, at];
      (index % 5 === 0 ? major : minor).push(onTop([a, b]));
    }
    out.push(L(minor.join(""), { tone: "lo" }), L(major.join(""), { tone: "mid" }));
  }
  if (has(details, "vents") && short >= 10 && long >= 20) {
    const alongX = g.w >= g.d;
    const count = clamp(Math.floor((long * 0.5) / 5), 3, 10);
    const span = (count - 1) * 5;
    const centre: Plane = [g.x + g.w / 2, g.y + g.d / 2];
    const slots: string[] = [];
    for (let index = 0; index < count; index++) {
      const at = -span / 2 + index * 5;
      const across = short * 0.36;
      const slot: k.Plan = alongX
        ? { x: centre[0] + at - 1, y: centre[1] - across / 2, w: 2, d: across, r: 1 }
        : { x: centre[0] - across / 2, y: centre[1] + at - 1, w: across, d: 2, r: 1 };
      slots.push(onTop(k.roundedPlan(slot, 3), true));
    }
    out.push(L(slots.join(""), { tone: "lo" }));
  }
  if (has(details, "grid") && short >= 8) {
    const gap = clamp(short / 5, 3, 8);
    const columns = clamp(Math.floor((g.w - 6) / gap) + 1, 2, 16);
    const rows = clamp(Math.floor((g.d - 6) / gap) + 1, 2, 16);
    const x0 = g.x + (g.w - (columns - 1) * gap) / 2;
    const y0 = g.y + (g.d - (rows - 1) * gap) / 2;
    const dots: Flat[] = [];
    for (let column = 0; column < columns; column++) {
      for (let row = 0; row < rows; row++) {
        const [px, py] = place([x0 + column * gap, y0 + row * gap]);
        dots.push(k.iso([px, py, top], projection));
      }
    }
    out.push(k.dotsSvg(dots, { size: 0.55, tone: "mid" }));
  }
  if (has(details, "label") && g.w >= 24 && g.d >= 14) {
    const lw = Math.min(g.w * 0.35, 30);
    const ld = Math.min(g.d * 0.35, 11);
    const label: k.Plan = { x: g.x + g.w - 3 - lw, y: g.y + 3, w: lw, d: ld, r: 0.8 };
    out.push(
      S(k.extrude(k.roundedPlan(label, 2).map(place), top, 0.5, projection), {
        tone: "lo",
        crease: "none",
        flat: true,
      }),
    );
    const rules = [0.3, 0.5, 0.7].map((share, index) =>
      k.onTop(
        [
          place([label.x + 1.6, label.y + ld * share]),
          place([label.x + lw * (index === 0 ? 0.8 : 0.6), label.y + ld * share]),
        ],
        top + 0.5,
        projection,
      ),
    );
    out.push(L(rules.join(""), { tone: "lo", free: true }));
  }
  if (has(details, "screws") && short >= 10) {
    const inset = clamp(short * 0.12, 2.5, 8);
    const screws = k.corners(plan, inset).map(place);
    const size = Math.min(1.8, inset * 0.45);
    out.push(
      L(screws.map(([x, y]) => k.ring(x, y, size, top, projection, 16)).join(""), { tone: "lo" }),
    );
    out.push(
      k.dotsSvg(
        screws.map(([x, y]) => k.iso([x, y, top], projection)),
        { size: 0.45 },
      ),
    );
  }
  return out.join("");
}

function partBody(part: Part, projection: Projection, turn: number, lit: boolean): string {
  const g = part.geometry;
  const subject = part.role === "subject";
  const tone = subject ? "hi" : "mid";
  switch (g.kind) {
    case "box":
      return boxSvg(part as Part & { geometry: BoxGeometry }, projection, turn, lit);
    case "cylinder": {
      const { x, y, radius: r, z, h } = g;
      const top = z + h;
      const bevel = h >= 3 && r >= 4 ? Math.min(0.8, h * 0.1, r * 0.08) : 0;
      const out = [
        S(k.cylinder(x, y, r, z, h, projection, clamp(Math.round(r * 3), 20, 72), bevel), {
          tone,
          crease: r < 2.5 || h < 2 ? "none" : subject ? "lo" : "faint",
          lit,
        }),
      ];
      if (has(g.details, "seam") && h >= 4)
        out.push(L(k.sideArc(x, y, r, z + h / 2, projection, 24), { tone: "faint" }));
      if (has(g.details, "knurl") && h >= 2) {
        out.push(
          L(
            k.knurl(
              x,
              y,
              r,
              z,
              top,
              clamp(Math.round(r * 4.2), 12, 96),
              projection,
              Math.min(0.4, h * 0.1),
            ),
            { tone: "lo" },
          ),
        );
      }
      if (has(g.details, "ruler") && r >= 7) {
        out.push(L(k.ring(x, y, r * 0.89, top, projection, 64), { tone: "lo" }));
        const ticks = k.radialTicks(
          x,
          y,
          r * 0.85,
          r >= 14 ? 50 : 30,
          5,
          top,
          [Math.max(0.6, r * 0.065), Math.max(1.2, r * 0.14)],
          projection,
        );
        out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
      }
      if (has(g.details, "groove") && r >= 4)
        out.push(L(k.ring(x, y, r * 0.72, top, projection, 48), { tone: "faint" }));
      if (has(g.details, "screws")) {
        if (r >= 9) {
          const holes = Array.from({ length: 6 }, (_, index): P3 => {
            const angle = (index / 6) * Math.PI * 2 + Math.PI / 6;
            return [x + Math.cos(angle) * r * 0.62, y + Math.sin(angle) * r * 0.62, top];
          });
          out.push(
            k.dotsSvg(
              holes.map((point) => k.iso(point, projection)),
              { size: 0.45 },
            ),
          );
        }
        out.push(L(k.ring(x, y, Math.min(1.6, r * 0.3), top, projection, 16), { tone: "mid" }));
      }
      return out.join("");
    }
    case "rod": {
      const start: P3 = [g.x, g.y, g.z];
      const along: P3 = g.axis === "x" ? [g.length, 0, 0] : [0, g.length, 0];
      const out = [
        S(prism(crossSection(start, g.radius, g.axis), along, projection), {
          tone,
          crease: g.radius < 2 ? "none" : "faint",
          lit,
        }),
      ];
      const at = (share: number): P3 => [g.x + along[0] * share, g.y + along[1] * share, g.z];
      const arcs: string[] = [];
      if (has(g.details, "knurl")) {
        const count = clamp(Math.round(g.length / 4), 3, 24);
        for (let index = 1; index < count; index++)
          arcs.push(frontArc(at(index / count), g.radius, g.axis, projection));
      }
      if (has(g.details, "groove") && g.length > 8) {
        const inset = Math.min(1.5, g.length * 0.1) / g.length;
        arcs.push(
          frontArc(at(inset), g.radius, g.axis, projection),
          frontArc(at(1 - inset), g.radius, g.axis, projection),
        );
      }
      if (has(g.details, "seam")) arcs.push(frontArc(at(0.5), g.radius, g.axis, projection));
      if (arcs.length) out.push(L(arcs.join(""), { tone: "lo" }));
      return out.join("");
    }
    case "spring": {
      const turns = clamp(g.turns || 6, 1, 30);
      const coil =
        g.axis === "z"
          ? upright(g.x, g.y, g.z, g.length, g.radius, turns, projection)
          : g.axis === "x"
            ? k.coil(g.x, g.x + g.length, [g.y, g.z], g.radius, turns, "x", projection)
            : k.coil(g.y, g.y + g.length, [g.x, g.z], g.radius, turns, "y", projection);
      return [
        hit(coil.back + coil.front),
        L(coil.back, { tone: "lo", className: "anatomy-stroke" }),
        L(coil.front, { tone: lit ? "lit" : tone, className: "anatomy-stroke" }),
      ].join("");
    }
    case "ball": {
      const [cx, cy] = k.iso([g.x, g.y, g.z], projection);
      const radius = g.radius * k.cameraOf(projection).k;
      const circle = (rx: number, ry: number, size: number) =>
        k.pathOf(
          Array.from({ length: 48 }, (_, step): Flat => {
            const angle = (step / 48) * Math.PI * 2;
            return [rx + size * Math.cos(angle), ry + size * Math.sin(angle)];
          }),
          true,
        );
      const full = circle(cx, cy, radius);
      return S(
        {
          fill: full,
          outline: full,
          crease: "",
          top: circle(cx - radius * 0.22, cy - radius * 0.26, radius * 0.6),
          shades: ["", full, "", ""],
          seamless: true,
        },
        { tone, crease: "none", lit },
      );
    }
    case "needle": {
      const [tail, tip] = needleEnds(g, turn);
      const d = k.lineOnTop(tail, tip, g.z + 0.2, projection);
      const pivot = k.iso([g.x, g.y, g.z + 0.2], projection);
      return [
        hit(d),
        `<path class="iso-line anatomy-stroke" data-tone="${lit ? "lit" : "hi"}" data-free="start" d="${d}" style="stroke-width:1.1"/>`,
        k.dotsSvg([pivot], { size: Math.max(0.8, g.length * 0.06), tone: "hi" }),
      ].join("");
    }
    case "cable": {
      const points = g.points.map((point) => k.iso([point.x, point.y, point.z], projection));
      const d = k.pathOf(points);
      return [
        hit(d),
        `<g class="anatomy-stroke-group">${k.wireSvg(points[0], points[points.length - 1], { via: points.slice(1, -1), tone: lit ? "lit" : "lo" })}</g>`,
      ].join("");
    }
  }
}

/** Where a leader line meets a part: the middle of its top, in a pose. */
export function anchorOf(part: Part, at: PartPose): P3 {
  const g = stretched(part.geometry, at.stretch);
  if (g.kind === "cable") {
    const middle = g.points[Math.floor((g.points.length - 1) / 2)];
    return [middle.x + at.offset[0], middle.y + at.offset[1], middle.z + at.offset[2]];
  }
  const { min, max } = boundsOf(g, at.turn);
  return [
    (min[0] + max[0]) / 2 + at.offset[0],
    (min[1] + max[1]) / 2 + at.offset[1],
    max[2] + at.offset[2],
  ];
}

/** One part's drawing where it is drawn, turned and stretched. Moves are applied as a transform. */
export function partSvg(
  part: Part,
  projection: Projection,
  { turn = 0, stretch = 0, lit = false } = {},
): string {
  return partBody(
    stretch ? { ...part, geometry: stretched(part.geometry, stretch) } : part,
    projection,
    turn,
    lit,
  );
}

/** The ground everything stands on: the lowest bottom in the figure. */
export function groundOf(scene: Scene): number {
  return Math.min(...scene.parts.map((part) => boundsOf(part.geometry).min[2]));
}

/** A soft shadow under the base and under large parts standing on the ground. */
export function haloSvg(
  part: Part,
  projection: Projection,
  ground: number,
  largest: number,
): string {
  const g = part.geometry;
  if (g.kind !== "box" && g.kind !== "cylinder") return "";
  const bounds = boundsOf(g);
  if (bounds.min[2] > ground + 0.5) return "";
  const area = (bounds.max[0] - bounds.min[0]) * (bounds.max[1] - bounds.min[1]);
  if (part.role !== "base" && area < largest * 0.3) return "";
  const d =
    g.kind === "box"
      ? k.haloOf(planOf(g), g.z, g.h, projection)
      : k.cylinder(g.x, g.y, g.radius, g.z, g.h, projection, 40).fill;
  return `<path class="iso-halo" d="${d}"/>`;
}

export function largestFootprint(scene: Scene): number {
  return Math.max(
    0,
    ...scene.parts.map((part) => {
      const { min, max } = boundsOf(part.geometry);
      return (max[0] - min[0]) * (max[1] - min[1]);
    }),
  );
}

/**
 * The zoom from the camera of the figure put together to the camera of the
 * figure taken apart, `share` of the way (0 to 1), as an SVG transform. Both
 * cameras look the same way, so one scale and shift maps one onto the other.
 */
export function zoomBetween(together: Projection, apart: Projection, share: number): string {
  if (share <= 0) return "";
  const ratio = apart.scale / together.scale;
  const scale = 1 + (ratio - 1) * share;
  const dx = (apart.origin[0] - ratio * together.origin[0]) * share;
  const dy = (apart.origin[1] - ratio * together.origin[1]) * share;
  return `matrix(${scale} 0 0 ${scale} ${dx} ${dy})`;
}

export const transformFor = (projection: Projection, offset: P3) =>
  offset[0] || offset[1] || offset[2] ? k.translateAlong(projection, offset) : "";

/** The whole figure as one SVG, in a pose: for downloads. */
export function figureSvg(
  scene: Scene,
  {
    stepIndex = 0,
    explode = 0,
    theme = "light",
  }: { stepIndex?: number; explode?: number; theme?: k.Theme } = {},
): { svg: string; width: number; height: number } {
  const projection = fitFigure(scene, { apart: explode > 0 });
  const pose = poseFor(scene, stepIndex, explode);
  const ground = groundOf(scene);
  const largest = largestFootprint(scene);
  const focus = new Set(
    scene.steps[stepIndex]?.focus ??
      scene.parts.filter((part) => part.role === "subject").map((part) => part.id),
  );
  const byId = new Map(scene.parts.map((part) => [part.id, part]));
  const halos = scene.parts.map((part) => {
    const d = haloSvg(part, projection, ground, largest);
    const transform = transformFor(projection, pose.get(part.id)!.offset);
    return d && transform ? `<g transform="${transform}">${d}</g>` : d;
  });
  const body = orderFor(scene, pose, projection).map((id) => {
    const part = byId.get(id)!;
    const at = pose.get(id)!;
    const transform = transformFor(projection, at.offset);
    return `<g${transform ? ` transform="${transform}"` : ""}>${partSvg(part, projection, { turn: at.turn, stretch: at.stretch, lit: focus.has(id) })}</g>`;
  });
  const svg = k
    .figureSvg({
      width: FIGURE_WIDTH,
      height: FIGURE_HEIGHT,
      label: scene.object || scene.title,
      body: [...halos, ...body],
      standalone: theme,
    })
    .replace(/<path class="anatomy-hit"[^>]*\/>/g, "");
  return { svg, width: FIGURE_WIDTH, height: FIGURE_HEIGHT };
}
