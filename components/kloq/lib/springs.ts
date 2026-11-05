export function springLinear(stiffness = 380, damping = 30, samples = 40): string {
  const frames = springSamples(stiffness, damping);
  const step = Math.max(1, Math.floor(frames.length / samples));
  const stops: string[] = [];
  for (let i = 0; i < frames.length; i += step) stops.push(frames[i].toFixed(4));
  stops.push("1");
  return `linear(0, ${stops.join(", ")})`;
}

/** The raw position curve at 60fps, until the spring settles (≤ 2s). */
export function springSamples(stiffness: number, damping: number): number[] {
  const frames: number[] = [];
  let x = 0;
  let v = 0;
  const dt = 1 / 60;
  for (let i = 0; i < 120; i++) {
    const a = stiffness * (1 - x) - damping * v;
    v += a * dt;
    x += v * dt;
    frames.push(x);
    if (Math.abs(1 - x) < 0.001 && Math.abs(v) < 0.001) break;
  }
  return frames;
}

export interface SpringSpec {
  stiffness: number;
  damping: number;
  /** WAAPI duration the curve plays over */
  ms: number;
}

export interface MotionState {
  drag: SpringSpec;
  resize: SpringSpec;
  keyboard: SpringSpec;
  /** duration multiplier — 4 plays everything at quarter speed */
  scale: number;
  /** simulate `prefers-reduced-motion: reduce` regardless of the OS */
  reducedMotion: boolean;
}

export const MOTION_DEFAULTS: MotionState = {
  drag: { stiffness: 380, damping: 30, ms: 320 },
  resize: { stiffness: 300, damping: 19, ms: 320 },
  keyboard: { stiffness: 700, damping: 36, ms: 180 },
  scale: 1,
  reducedMotion: false,
};

let motion: MotionState = MOTION_DEFAULTS;
const listeners = new Set<() => void>();

// live bindings: importers see every `setMotion`
export let SPRING = springLinear();
export let SPRING_MS = MOTION_DEFAULTS.drag.ms;
export let RESIZE_SPRING = springLinear(300, 19);
export let KEYBOARD_SPRING = springLinear(700, 36);
export let KEYBOARD_SPRING_MS = MOTION_DEFAULTS.keyboard.ms;

export const ms = (n: number): number => n * motion.scale;

export function getMotion(): MotionState {
  return motion;
}

export function setMotion(patch: Partial<MotionState>): void {
  motion = { ...motion, ...patch };
  SPRING = springLinear(motion.drag.stiffness, motion.drag.damping);
  SPRING_MS = motion.drag.ms * motion.scale;
  RESIZE_SPRING = springLinear(motion.resize.stiffness, motion.resize.damping);
  KEYBOARD_SPRING = springLinear(motion.keyboard.stiffness, motion.keyboard.damping);
  KEYBOARD_SPRING_MS = motion.keyboard.ms * motion.scale;
  for (const l of listeners) l();
}

export function resetMotion(): void {
  setMotion(MOTION_DEFAULTS);
}

export function subscribeMotion(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function prefersReducedMotion(): boolean {
  if (motion.reducedMotion) return true;
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The house ease for UI motion — panels, rows, menus. */
export const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";
