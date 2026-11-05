export interface TimelineAxisInfo {
  canvas: HTMLElement;
  startMs: number;
  slotMinutes: number;
  slotPx: number;
}

export function timelineAxisOf(scope: ParentNode | null): TimelineAxisInfo | null {
  const canvas = (scope ?? document).querySelector<HTMLElement>('[data-slot="timeline-canvas"]');
  if (!canvas) return null;
  const startMs = Number(canvas.dataset.windowStart);
  const slotMinutes = Number(canvas.dataset.slotMinutes);
  const slotPx = Number(canvas.dataset.slotPx);
  if (!Number.isFinite(startMs) || !(slotMinutes > 0) || !(slotPx > 0)) return null;
  return { canvas, startMs, slotMinutes, slotPx };
}
