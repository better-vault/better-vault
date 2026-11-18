/**
 * One animation loop and one pointer listener for every character on the
 * page. Subscribers draw a frame and say whether they want another; the loop
 * stops when nobody does, and starts again on the next change.
 */

export type FrameCallback = (time: number, dt: number) => boolean;

const subscribers = new Set<FrameCallback>();
let handle: number | null = null;
let last = 0;

function tick(now: number) {
  const time = now / 1000;
  const dt = last ? Math.min(0.1, time - last) : 1 / 60;
  last = time;
  let more = false;
  for (const draw of [...subscribers]) if (draw(time, dt)) more = true;
  handle = more ? requestAnimationFrame(tick) : null;
  if (!more) last = 0;
}

/** Asks for frames; returns how to stop. */
export function subscribe(draw: FrameCallback): () => void {
  subscribers.add(draw);
  wake();
  return () => subscribers.delete(draw);
}

/** Starts the loop again after something changed. */
export function wake() {
  if (handle === null && typeof requestAnimationFrame !== "undefined")
    handle = requestAnimationFrame(tick);
}

let pointer: { x: number; y: number } | null = null;
let listening = false;

/** The pointer's last position on the page, once it has moved. */
export function pointerPosition(): { x: number; y: number } | null {
  if (!listening && typeof window !== "undefined") {
    listening = true;
    const move = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      wake();
    };
    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerdown", move, { passive: true });
    document.addEventListener("pointerleave", () => {
      pointer = null;
      wake();
    });
  }
  return pointer;
}

let reduced: MediaQueryList | null = null;

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  reduced ??= window.matchMedia("(prefers-reduced-motion: reduce)");
  return reduced.matches;
}
