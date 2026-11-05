export interface EdgeVelocityOptions {
  /** pointer position along the axis, in client px */
  pointer: number;
  /** the container's low edge along the axis */
  near: number;
  /** the container's high edge along the axis */
  far: number;
  /** how deep the trigger zone reaches, in px */
  zone: number;
  /** px per frame at the boundary */
  max: number;
}

// Fixed at 40px regardless of `zone` (shipped as a literal, not derived from
// EDGE_ZONE/EDGE_MAX_V) so a pointer flung well outside the container stops
// auto-scrolling instead of running away at full speed forever; it is not a
// saturation point, it is a disengage threshold.
const OVERSHOOT_CUTOFF_PX = 40;

export function edgeVelocity({ pointer, near, far, zone, max }: EdgeVelocityOptions): number {
  const nearD = pointer - near;
  const farD = far - pointer;
  if (nearD < zone && nearD > -OVERSHOOT_CUTOFF_PX) {
    const t = 1 - Math.max(0, nearD) / zone;
    return -max * t * t;
  }
  if (farD < zone && farD > -OVERSHOOT_CUTOFF_PX) {
    const t = 1 - Math.max(0, farD) / zone;
    return max * t * t;
  }
  return 0;
}

/** The same ramp, reading whichever pair of edges the axis names. */
export function autoScrollDelta(
  rect: DOMRect,
  pointer: { x: number; y: number },
  axis: "x" | "y",
  zone: number,
  max: number,
): number {
  return axis === "x"
    ? edgeVelocity({ pointer: pointer.x, near: rect.left, far: rect.right, zone, max })
    : edgeVelocity({ pointer: pointer.y, near: rect.top, far: rect.bottom, zone, max });
}
