export type DragKind = "create" | "move" | "resize-start" | "resize-end";

export interface DragFrame {
  kind: DragKind;
  id: string;
  velocity: number;
  rect: { x: number; y: number; width: number; height: number };
  startMin: number;
  endMin: number;
  dayIndex: number;
  /** inclusive last day — present on all-day lane drags (rect is in lane coords) */
  endDayIndex?: number;
  pointer: { x: number; y: number };
}

export type CraftEvent =
  | { type: "drag:start"; frame: DragFrame }
  | { type: "drag:frame"; frame: DragFrame }
  | { type: "drag:end"; frame: DragFrame; cancelled: boolean }
  | { type: "design-mode"; enabled: boolean };

type Listener = (e: CraftEvent) => void;

const listeners = new Set<Listener>();

let lastFrame: DragFrame | null = null;
let designMode = false;

export const craftBus = {
  emit(e: CraftEvent) {
    if (e.type === "drag:frame" || e.type === "drag:start") lastFrame = e.frame;
    if (e.type === "drag:end") lastFrame = null;
    if (e.type === "design-mode") designMode = e.enabled;
    for (const l of listeners) l(e);
  },
  subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  get frame() {
    return lastFrame;
  },
  get designMode() {
    return designMode;
  },
};
