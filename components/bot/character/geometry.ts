/**
 * The character's head: a superellipsoid, |x|ⁿ + |y|ⁿ + |z/d|ⁿ = 1, the soft
 * rounded cube of the bot avatars. Object space has x to the right, y up and
 * z toward the viewer; the head spans -1..1 in x and y. The view is an
 * orthographic projection of the head turned by yaw, pitch and roll, so the
 * silhouette is the convex hull of the projected surface (the head is convex).
 */

export type V3 = readonly [number, number, number];
export type V2 = readonly [number, number];

/** How square the head is: 2 is a sphere, higher is boxier. */
export const EXPONENT = 3.2;
/** Front-to-back depth of the head, relative to its width. */
export const DEPTH = 0.86;

export interface View {
  yaw: number;
  pitch: number;
  roll: number;
}

/** A rotation as a 3×3 matrix (rows), from yaw (about y), then pitch (about x), then roll (about z). */
export type Matrix = readonly [V3, V3, V3];

export function rotation({ yaw, pitch, roll }: View): Matrix {
  const [cy, sy] = [Math.cos(yaw), Math.sin(yaw)];
  const [cp, sp] = [Math.cos(pitch), Math.sin(pitch)];
  const [cr, sr] = [Math.cos(roll), Math.sin(roll)];
  // R = Rz(roll) · Rx(pitch) · Ry(yaw). Positive pitch tips the face down (the top shows).
  const ry: Matrix = [
    [cy, 0, sy],
    [0, 1, 0],
    [-sy, 0, cy],
  ];
  const rx: Matrix = [
    [1, 0, 0],
    [0, cp, -sp],
    [0, sp, cp],
  ];
  const rz: Matrix = [
    [cr, -sr, 0],
    [sr, cr, 0],
    [0, 0, 1],
  ];
  return multiply(rz, multiply(rx, ry));
}

function multiply(a: Matrix, b: Matrix): Matrix {
  const row = (r: V3): V3 => [
    r[0] * b[0][0] + r[1] * b[1][0] + r[2] * b[2][0],
    r[0] * b[0][1] + r[1] * b[1][1] + r[2] * b[2][1],
    r[0] * b[0][2] + r[1] * b[1][2] + r[2] * b[2][2],
  ];
  return [row(a[0]), row(a[1]), row(a[2])];
}

export function apply(m: Matrix, v: V3): V3 {
  return [
    m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
    m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
    m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
  ];
}

const signedPow = (value: number, power: number) => Math.sign(value) * Math.abs(value) ** power;

export function normalize(v: V3): V3 {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

/** Sample points over the whole surface, by latitude and longitude. */
export function surfaceSamples(rings: number, segments: number): V3[] {
  const points: V3[] = [];
  const e = 2 / EXPONENT;
  for (let i = 0; i <= rings; i++) {
    const lat = -Math.PI / 2 + (Math.PI * i) / rings;
    const [cl, sl] = [Math.cos(lat), Math.sin(lat)];
    for (let j = 0; j < segments; j++) {
      const lon = (2 * Math.PI * j) / segments;
      points.push([
        signedPow(cl, e) * signedPow(Math.cos(lon), e),
        signedPow(sl, e),
        signedPow(cl, e) * signedPow(Math.sin(lon), e) * DEPTH,
      ]);
    }
  }
  return points;
}

/** The point on the front of the head in front of (x, y), and its outward normal. */
export function frontPoint(x: number, y: number): { point: V3; normal: V3 } {
  const n = EXPONENT;
  const rest = Math.max(0, 1 - Math.abs(x) ** n - Math.abs(y) ** n);
  const z = DEPTH * rest ** (1 / n);
  return { point: [x, y, z], normal: surfaceNormal([x, y, z]) };
}

export function surfaceNormal(p: V3): V3 {
  const n = EXPONENT;
  return normalize([
    signedPow(p[0], n - 1),
    signedPow(p[1], n - 1),
    signedPow(p[2] / DEPTH, n - 1) / DEPTH,
  ]);
}

/** Orthographic projection to the drawing: x right, y down, in drawing units. */
export interface Projection {
  cx: number;
  cy: number;
  /** Drawing units per object unit. */
  scale: number;
}

export function project(v: V3, { cx, cy, scale }: Projection): V2 {
  return [cx + v[0] * scale, cy - v[1] * scale];
}

/** A direction in object space as seen in the drawing (no translation), per object unit. */
export function projectDirection(v: V3, scale: number): V2 {
  return [v[0] * scale, -v[1] * scale];
}

/** The convex hull of points, counter-clockwise (Andrew's monotone chain). */
export function convexHull(points: V2[]): V2[] {
  const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (sorted.length < 3) return sorted;
  const turn = (o: V2, a: V2, b: V2) =>
    (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: V2[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], p) <= 0)
      lower.pop();
    lower.push(p);
  }
  const upper: V2[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], p) <= 0)
      upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

const round = (value: number) => Math.round(value * 100) / 100;

/** A closed, smooth path through points (Catmull-Rom as cubic Béziers). */
export function smoothClosedPath(points: V2[]): string {
  const count = points.length;
  if (count < 3) return "";
  const at = (i: number) => points[(i + count) % count];
  let d = `M${round(at(0)[0])} ${round(at(0)[1])}`;
  for (let i = 0; i < count; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1: V2 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: V2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p2[0])} ${round(p2[1])}`;
  }
  return `${d}Z`;
}

/** The head's outline in the drawing, for a turned head. */
export function silhouette(m: Matrix, samples: V3[], projection: Projection): string {
  return smoothClosedPath(convexHull(samples.map((p) => project(apply(m, p), projection))));
}

/**
 * A 2D frame on the turned head, as an SVG matrix: drawings made in local
 * units (x right, y down, 1 unit = 1 drawing unit when seen head on) follow
 * the surface, foreshortening as it turns away.
 */
export interface Frame {
  /** SVG `matrix(a b c d e f)` values. */
  matrix: readonly [number, number, number, number, number, number];
  /** How much the frame faces the viewer: 1 head on, 0 edge on, below 0 turned away. */
  facing: number;
  /** Depth of its anchor after turning; larger is nearer. */
  depth: number;
}

export const toTransform = (frame: Frame) =>
  `matrix(${frame.matrix.map((value) => round(value * 1000) / 1000).join(" ")})`;

function frameFrom(origin: V2, ex: V2, ey: V2, facing: number, depth: number): Frame {
  return { matrix: [ex[0], ex[1], ey[0], ey[1], origin[0], origin[1]], facing, depth };
}

/** A frame lying on the front surface at (x, y): for eyes and anything worn on the face. */
export function faceFrame(m: Matrix, x: number, y: number, projection: Projection): Frame {
  const { point, normal } = frontPoint(x, y);
  const tangent = normalize(cross([0, 1, 0], normal));
  const up = normalize(cross(normal, tangent));
  const unit = 1 / projection.scale;
  const ex = projectDirection(apply(m, tangent), projection.scale * unit);
  const ey = projectDirection(apply(m, [-up[0], -up[1], -up[2]]), projection.scale * unit);
  const turned = apply(m, point);
  return frameFrom(project(turned, projection), ex, ey, apply(m, normal)[2], turned[2]);
}

/**
 * An upright frame at an object point, for things that stand on the head
 * (hats, an antenna): its width stays as seen, its height and lean follow
 * the head's up axis.
 */
export function uprightFrame(m: Matrix, point: V3, projection: Projection): Frame {
  const unit = 1 / projection.scale;
  const ey = projectDirection(apply(m, [0, -1, 0]), projection.scale * unit);
  const length = Math.hypot(ey[0], ey[1]) || 1;
  const ex: V2 = [ey[1] / length, -ey[0] / length];
  const turned = apply(m, point);
  return frameFrom(project(turned, projection), ex, ey, 1, turned[2]);
}

/**
 * A frame in a plane of the head through an object point, spanned by two
 * object axes: a hat's brim (x and z) or a headphone cup on a side (z and y).
 */
export function planeFrame(
  m: Matrix,
  point: V3,
  xAxis: V3,
  yAxis: V3,
  projection: Projection,
): Frame {
  const unit = 1 / projection.scale;
  const ex = projectDirection(apply(m, xAxis), projection.scale * unit);
  const ey = projectDirection(apply(m, yAxis), projection.scale * unit);
  const normal = normalize(cross(xAxis, yAxis));
  const turned = apply(m, point);
  return frameFrom(project(turned, projection), ex, ey, Math.abs(apply(m, normal)[2]), turned[2]);
}

/** Where the key light falls on the head, in the drawing: up and to the left of the viewer. */
export function highlight(projection: Projection): V2 {
  return [projection.cx - projection.scale * 0.34, projection.cy - projection.scale * 0.42];
}
