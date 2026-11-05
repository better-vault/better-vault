export const EDGE_ZONE = 56; // px from scroll edge where auto-scroll engages
export const EDGE_MAX_V = 14; // px per frame at full ramp
export const EASE = 0.38; // per-frame lerp toward the snapped target
export const LABEL_FLIP_H = 28; // below this height the draft label moves outside
export const LANE_ROW_H = 22;

/** px of overshoot per px/s of release velocity, capped at ±10px */
export const RESIZE_PUSH = 0.012;

export const ALIGN_PX = 4;

// touch threshold sits above base-ui's 10px long-press cancel radius, so a drag and its menu are exclusive
export const TOUCH_THRESHOLD_PX = 12;
export const BASEUI_LONG_PRESS_MOVE_PX = 10;
// what a long-press create makes when you lift without dragging; same as ⌘K quick-add
export const TOUCH_CREATE_MIN = 30;
