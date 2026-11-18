/**
 * How the character moves: a pose is a pure function of time, mood, where it
 * looks and a per-bot seed, so any frame can be drawn again exactly (tests,
 * stills, reduced motion). Springs (below) smooth what is not deterministic:
 * the pointer, and accessories trailing the head.
 */

export type Mood = "idle" | "thinking" | "happy" | "waiting";

export interface Pose {
  /** Head turn in radians: yaw right, pitch down (the top shows), roll counter-clockwise. */
  yaw: number;
  pitch: number;
  roll: number;
  /** Vertical offset in drawing units (negative is up). */
  lift: number;
  /** Squash and stretch, about the base of the head. */
  sx: number;
  sy: number;
  /** Where the eyes look, -1..1 per axis (x right, y down). */
  gazeX: number;
  gazeY: number;
  /** 0 open, 1 closed. */
  blink: number;
  /** Narrowed eyes, 0..1. */
  squint: number;
  /** Happy arc eyes, 0..1. */
  happy: number;
}

/** Resting view: facing the viewer, as in the design; it turns when it looks at something. */
export const REST_YAW = 0;
export const REST_PITCH = 0.04;
/** How far the head turns toward what it looks at, at full deflection: a lot, as in the design. */
const LOOK_YAW = 0.62;
const LOOK_PITCH = 0.42;

export function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let at = 0; at < text.length; at++) {
    hash ^= text.charCodeAt(at);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Stateless noise in [0, 1). */
export function noise(seed: number, n: number): number {
  let h = (seed ^ Math.imul(n | 0, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const TAU = Math.PI * 2;
const smooth = (x: number) => x * x * (3 - 2 * x);

/** A blink: closes fast, opens a little slower, over 0.17 s. */
function blinkAt(since: number): number {
  if (since < 0 || since > 0.17) return 0;
  return since < 0.06 ? since / 0.06 : 1 - (since - 0.06) / 0.11;
}

/** Blinks every 2.6–5.4 s, sometimes twice. */
export function blinking(time: number, seed: number): number {
  const period = 4;
  const shift = ((seed % 997) / 997) * period;
  const k = Math.floor((time + shift) / period);
  let value = 0;
  for (const each of [k - 1, k]) {
    const start = each * period - shift + 0.3 + noise(seed, each) * 2.8;
    value = Math.max(value, blinkAt(time - start));
    if (noise(seed, each + 7919) > 0.75) value = Math.max(value, blinkAt(time - start - 0.3));
  }
  return value;
}

/** Now and then a quick look aside, held for about a second. */
function glance(time: number, seed: number): number {
  const period = 7;
  const k = Math.floor(time / period);
  if (noise(seed, k + 104729) < 0.55) return 0;
  const start = k * period + 1 + noise(seed, k + 3) * 4;
  const since = time - start;
  if (since < 0 || since > 1.2) return 0;
  const amount = since < 0.2 ? smooth(since / 0.2) : since > 0.9 ? smooth((1.2 - since) / 0.3) : 1;
  return (noise(seed, k + 11) > 0.5 ? 1 : -1) * amount;
}

/** Now and then the head tips to one side, curious, for a couple of seconds. */
function tilt(time: number, seed: number): number {
  const period = 9;
  const k = Math.floor(time / period);
  if (noise(seed, k + 15485863) < 0.45) return 0;
  const start = k * period + 2 + noise(seed, k + 17) * 4;
  const since = time - start;
  if (since < 0 || since > 2.2) return 0;
  const amount =
    since < 0.35 ? smooth(since / 0.35) : since > 1.7 ? smooth((2.2 - since) / 0.5) : 1;
  return (noise(seed, k + 23) > 0.5 ? 0.16 : -0.16) * amount;
}

/** The start of this period's hop, if it has one. */
function hopStart(time: number, seed: number): number | null {
  const period = 11;
  const k = Math.floor(time / period);
  if (noise(seed, k + 32452843) < 0.5) return null;
  return k * period + 3 + noise(seed, k + 29) * 6;
}

/** A small hop, 0..1 high, over 0.5 s. */
function hopAt(time: number, seed: number): number {
  const start = hopStart(time, seed);
  if (start === null) return 0;
  const since = time - start;
  return since < 0 || since > 0.5 ? 0 : Math.sin((Math.PI * since) / 0.5);
}

/** The squash as it lands, 0..1, over 0.18 s after the hop. */
function landing(time: number, seed: number): number {
  const start = hopStart(time, seed);
  if (start === null) return 0;
  const since = time - start - 0.5;
  return since < 0 || since > 0.18 ? 0 : Math.sin((Math.PI * since) / 0.18);
}

export interface PoseInput {
  time: number;
  mood: Mood;
  seed: number;
  /** Where to look, -1..1 per axis (x right, y down), e.g. the pointer; idle wander when missing. */
  look?: { x: number; y: number } | null;
  reducedMotion?: boolean;
}

export function pose({ time: t, mood, seed, look, reducedMotion = false }: PoseInput): Pose {
  const phase = ((seed % 1000) / 1000) * TAU;
  const p: Pose = {
    yaw: REST_YAW,
    pitch: REST_PITCH,
    roll: 0,
    lift: 0,
    sx: 1,
    sy: 1,
    gazeX: 0,
    gazeY: 0,
    blink: 0,
    squint: 0,
    happy: 0,
  };

  if (reducedMotion) {
    if (mood === "happy") p.happy = 1;
    if (mood === "thinking") {
      p.gazeX = 0.5;
      p.gazeY = -0.6;
    }
  } else {
    // Breathing, and a wander of the eyes and head, so it always looks alive.
    const breath = Math.sin((TAU * t) / 3.4 + phase);
    p.sy = 1 + 0.018 * breath;
    p.sx = 1 - 0.009 * breath;
    p.lift = -0.6 * breath;
    const aside = glance(t, seed);
    p.gazeX =
      0.35 * Math.sin(t * 0.43 + phase) + 0.14 * Math.sin(t * 1.27 + phase * 2) + 0.75 * aside;
    p.gazeY = 0.22 * Math.sin(t * 0.37 + phase * 3);
    p.yaw += 0.14 * Math.sin(t * 0.31 + phase) + 0.38 * aside;
    p.pitch += 0.07 * Math.sin(t * 0.27 + phase) - 0.05 * Math.abs(aside);
    p.roll = 0.05 * Math.sin(t * 0.23 + phase * 1.7) + tilt(t, seed);
    p.blink = blinking(t, seed);
    // Now and then a little hop, as if it has had an idea.
    const bounce = hopAt(t, seed);
    p.lift -= 4 * bounce;
    p.sy += 0.04 * bounce - 0.05 * landing(t, seed);
    p.sx -= 0.02 * bounce - 0.04 * landing(t, seed);

    if (mood === "thinking") {
      // Looks up and aside, sways slowly, eyes narrowed.
      p.yaw = REST_YAW + 0.3 + 0.05 * Math.sin(t * 0.9 + phase);
      p.pitch = -0.12 + 0.03 * Math.sin(t * 1.3);
      p.roll = 0.07 * Math.sin(t * 0.8 + phase);
      p.gazeX = 0.55 + 0.1 * Math.sin(t * 2.1);
      p.gazeY = -0.75;
      p.squint = 0.3;
      p.lift = -0.9 * Math.sin(t * 1.9 + phase);
    } else if (mood === "happy") {
      // Hops, squashing as it lands, with happy arc eyes.
      const hop = Math.abs(Math.sin((Math.PI * t) / 0.55));
      p.lift = -5.5 * hop;
      const land = (1 - hop) ** 6;
      p.sy = 1 - 0.08 * land + 0.03 * hop;
      p.sx = 1 + 0.06 * land - 0.015 * hop;
      p.roll = 0.08 * Math.sin((TAU * t) / 1.1);
      p.yaw = REST_YAW * 0.4;
      p.gazeX = 0;
      p.gazeY = -0.2;
      p.happy = 1;
      p.blink = 0;
    } else if (mood === "waiting") {
      // Faces the viewer with a small, patient nod.
      p.yaw = REST_YAW * 0.3;
      p.pitch = REST_PITCH + 0.08 * Math.max(0, Math.sin((TAU * t) / 1.8)) ** 3;
      p.gazeX = 0;
      p.gazeY = 0.05;
    }
  }

  if (look && mood !== "happy") {
    const x = Math.max(-1, Math.min(1, look.x));
    const y = Math.max(-1, Math.min(1, look.y));
    const weight = mood === "thinking" ? 0.35 : 1;
    p.yaw = p.yaw * (1 - weight * 0.6) + x * LOOK_YAW * weight;
    p.pitch = p.pitch * (1 - weight * 0.5) + y * LOOK_PITCH * weight;
    p.gazeX = p.gazeX * (1 - weight) + x * 0.85 * weight;
    p.gazeY = p.gazeY * (1 - weight) + y * 0.7 * weight;
  }
  return p;
}

const keys = [
  "yaw",
  "pitch",
  "roll",
  "lift",
  "sx",
  "sy",
  "gazeX",
  "gazeY",
  "blink",
  "squint",
  "happy",
] as const satisfies readonly (keyof Pose)[];

/** Between two poses, `t` 0..1. */
export function blendPoses(a: Pose, b: Pose, t: number): Pose {
  const out = { ...b };
  for (const key of keys) out[key] = a[key] + (b[key] - a[key]) * t;
  return out;
}

/** A critically damped spring toward a target, for one number. */
export interface Spring {
  value: number;
  velocity: number;
}

export function stepSpring(spring: Spring, target: number, dt: number, stiffness: number) {
  // Exact solution of the critically damped oscillator over dt.
  const omega = Math.sqrt(stiffness);
  const x0 = spring.value - target;
  const decay = Math.exp(-omega * dt);
  const value = target + (x0 + (spring.velocity + omega * x0) * dt) * decay;
  const velocity = (spring.velocity - omega * (spring.velocity + omega * x0) * dt) * decay;
  spring.value = value;
  spring.velocity = velocity;
}
