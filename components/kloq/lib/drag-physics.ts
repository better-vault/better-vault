import { clamp } from "./date-math";
export interface JiggleState {
  scale: number;
  rotate: number;
  scaleV: number;
  rotateV: number;
}

interface JiggleInput {
  vx: number;
  vy: number;
  dt: number;
  /** false for wide chips, which only lift — a rotated banner reads wrong */
  tilt?: boolean;
}

export const LIFT_SCALE = 1.03;
const SPEED_SCALE = 0.03;
const TILT_DEG = 6;
const SPEED_REF = 1400;
const MAX_TILT_DEG = 8;

// rotate is underdamped (ζ≈0.45) so a stop wobbles; scale is near-critical so the lift never pulses
const ROTATE_K = 320;
const ROTATE_C = 16;
const SCALE_K = 380;
const SCALE_C = 30;

const MIN_DT = 1 / 240;
const MAX_DT = 1 / 30;

export const createJiggle = (): JiggleState => ({
  scale: 1,
  rotate: 0,
  scaleV: 0,
  rotateV: 0,
});

export function jiggleTargets({ vx, vy, tilt = true }: Pick<JiggleInput, "vx" | "vy" | "tilt">) {
  const speed = Math.hypot(vx, vy);
  return {
    scale: LIFT_SCALE + SPEED_SCALE * clamp(speed / SPEED_REF, 0, 1),
    rotate: tilt ? clamp((vx / SPEED_REF) * TILT_DEG, -MAX_TILT_DEG, MAX_TILT_DEG) : 0,
  };
}

const DETENT_KICK = 1.4;
export const kickJiggle = (s: JiggleState, amount = DETENT_KICK): void => {
  s.scaleV += amount;
};

/** 0 at rest, 1 at the held lift, above 1 mid-fling — drives the shadow. */
export const liftOf = (s: JiggleState): number => clamp((s.scale - 1) / (LIFT_SCALE - 1), 0, 1.6);

/** Advance one frame; mutates and returns `state`. */
export function stepJiggle(state: JiggleState, input: JiggleInput): JiggleState {
  const dt = clamp(input.dt, MIN_DT, MAX_DT);
  const t = jiggleTargets(input);

  state.scaleV += (SCALE_K * (t.scale - state.scale) - SCALE_C * state.scaleV) * dt;
  state.scale += state.scaleV * dt;

  state.rotateV += (ROTATE_K * (t.rotate - state.rotate) - ROTATE_C * state.rotateV) * dt;
  state.rotate += state.rotateV * dt;
  return state;
}

export const jiggleTransform = (s: JiggleState): string =>
  ` rotate(${s.rotate.toFixed(3)}deg) scale(${s.scale.toFixed(4)})`;

/** True once a drop needs no settle animation for the lift itself. */
export const jiggleAtRest = (s: JiggleState): boolean =>
  Math.abs(s.scale - 1) < 0.005 && Math.abs(s.rotate) < 0.1;

export const JIGGLE_REST = " rotate(0deg) scale(1)";
