import type { KloqSettings } from "../calendar-config";
import type { Constraints } from "../constraints";
import type { JiggleState } from "../drag-physics";
import type { LongPressState } from "../long-press";
import type { PlacedEvent } from "../placement";
import type { ViewDescriptor } from "../view";

export interface CreateDrag {
  kind: "create";
  pointerId: number;
  captureEl: HTMLElement;
  downX: number;
  downY: number;
  dayIndex: number;
  anchorRawY: number;
  moved: boolean;
  mode: "timed" | "allday";
  curDay: number;
  /** whole days the growing edge has crossed past midnight (−1, 0 or 1) */
  dayDelta: number;
  /** the welded ghost drawn in the neighbouring column past midnight */
  overflow: HTMLElement | null;
  vTop: number;
  vHeight: number;
  vLeft: number;
  vWidth: number;
  /** last span the constraints accepted */
  okStart: number;
  okEnd: number;
  everOk: boolean;
}

export interface LaneCreateDrag {
  kind: "lane-create";
  pointerId: number;
  captureEl: HTMLElement;
  downX: number;
  downY: number;
  anchorDay: number;
  curDay: number;
  moved: boolean;
  everOk: boolean;
  vLeft: number;
  vWidth: number;
}

export interface LaneMoveDrag {
  kind: "lane-move";
  pointerId: number;
  captureEl: HTMLElement;
  downX: number;
  downY: number;
  event: PlacedEvent;
  node: HTMLElement;
  ghost: HTMLElement | null;
  grabOffsetDays: number;
  moved: boolean;
  cancelled: boolean;
  vDx: number;
  jiggle: JiggleState;
  jiggleT: number;
  targetStartDay: number;
}

export interface LaneResizeDrag {
  kind: "lane-resize";
  edge: "left" | "right";
  pointerId: number;
  captureEl: HTMLElement;
  downX: number;
  downY: number;
  event: PlacedEvent;
  node: HTMLElement;
  moved: boolean;
  cancelled: boolean;
  vLeft: number;
  vWidth: number;
  targetStartDay: number;
  targetEndDay: number;
}

export interface MoveDrag {
  kind: "move";
  pointerId: number;
  captureEl: HTMLElement;
  downX: number;
  downY: number;
  event: PlacedEvent;
  node: HTMLElement;
  /** the other segments of a midnight split — they take the same `translate()` */
  siblings: HTMLElement[];
  ghost: HTMLElement | null;
  timeEl: HTMLElement | null;
  originTop: number;
  originLeft: number;
  grabOffsetY: number;
  moved: boolean;
  cancelled: boolean;
  dup: boolean;
  vDx: number;
  vDy: number;
  jiggle: JiggleState;
  jiggleT: number;
  targetDayIndex: number;
  targetStartMin: number;
}

export interface ResizeDrag {
  kind: "resize";
  edge: "start" | "end";
  pointerId: number;
  captureEl: HTMLElement;
  downX: number;
  downY: number;
  event: PlacedEvent;
  node: HTMLElement;
  timeEl: HTMLElement | null;
  moved: boolean;
  cancelled: boolean;
  vTop: number;
  vHeight: number;
  // minutes may leave [0,1440] when the dragged edge crosses midnight
  targetStartMin: number;
  targetEndMin: number;
  overflow: HTMLElement | null;
}

export type Drag =
  | CreateDrag
  | MoveDrag
  | ResizeDrag
  | LaneCreateDrag
  | LaneMoveDrag
  | LaneResizeDrag;

// "create": press on empty grid/lane arms a create; "yield": press on a block — base-ui's menu wins
export type PressMode = "create" | "yield";

export interface Shared {
  drag: Drag | null;
  raf: number;
  pointer: { x: number; y: number };
  lastPointer: { x: number; y: number; t: number };
  velocity: number; // EMA px/s
  vx: number;
  vy: number;
  altHeld: boolean;
  reduced: boolean;
  pointerType: string;
  press: LongPressState | null;
  pressMode: PressMode | null;
  /** minimum span a long-press create shows before the finger moves; 0 on every other path */
  holdSpan: number;
  /** `hourHeight` the live drag's origin geometry was computed against */
  scale: number;
  refused: boolean;
  refusedSaid: boolean;
  alignCands: number[] | null;
}

/**
 * `void` = store updated synchronously. A promise leaves the block welded where it
 * dropped until it resolves: `true` once the store is updated and flushed, `false` to decline.
 */
export type CommitResult = void | Promise<boolean>;

export interface DragEngineOpts {
  /** the engine works in column space; the caller materialises instants at commit */
  view: ViewDescriptor;
  /** a prop, not `useKloqSettings()`: the rAF loop reads it via `optsRef` and must see changes */
  settings: KloqSettings;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  draftRef: React.RefObject<HTMLDivElement | null>;
  laneRef: React.RefObject<HTMLDivElement | null>;
  laneDraftRef: React.RefObject<HTMLDivElement | null>;
  openEditor: (id: string) => void;
  /** a true click on empty grid — the gesture never crossed the threshold */
  onCanvasClick?: (at?: { clientX: number; clientY: number }) => void;
  commitCreate: (draft: {
    dayIndex: number;
    startMin: number;
    endMin: number;
    allDay?: boolean;
    endDayIndex?: number;
  }) => string;
  commitMove: (id: string, patch: { dayIndex: number; startMin: number }) => CommitResult;
  commitResize: (id: string, patch: { startMin: number; endMin: number }) => CommitResult;
  commitSpan: (id: string, patch: { dayIndex: number; endDayIndex: number }) => CommitResult;
  /** ⌥-drag: clone `sourceId` at the drop target */
  commitDuplicate: (sourceId: string, patch: { dayIndex: number; startMin: number }) => string;
  /** called per frame — must return a stable array */
  getTimedEvents: () => PlacedEvent[];
  constraints?: Constraints;
  /** refusals only — at most one polite sentence per gesture, one assertive on a refused release */
  announce?: (message: string, politeness?: "polite" | "assertive") => void;
}
