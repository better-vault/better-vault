import type { Point } from "../geometry";
import type { BoardElement } from "../schema";
import { measureText } from "../text";
import type { DrawOp } from "./layout";

/**
 * Writes a board's answer the way a hand would: each text grows letter by
 * letter and each stroke point by point, one after another, with the pen
 * moving between them. Ops may keep arriving while it writes (the model is
 * still answering). It only shows things; the board saves them at the end.
 */

const LETTERS_PER_SECOND = 34;
const HEADING_LETTERS_PER_SECOND = 20;
const STROKE_SPEED = 900; // world units a second
const TRAVEL = 140; // ms between strokes, as the pen moves

export interface AnimatorHooks {
  /** Puts an element on the board (or replaces it), without recording a change. */
  put: (element: BoardElement) => void;
  /** Where the pen is, in world units; null when it is lifted away. */
  pen: (at: Point | null) => void;
  /** Called once everything queued is written and `finish` was called. */
  done: (written: BoardElement[]) => void;
}

export function createAnimator(hooks: AnimatorHooks) {
  const queue: DrawOp[] = [];
  const written: BoardElement[] = [];
  let current: { op: DrawOp; started: number } | null = null;
  let finished = false;
  let stopped = false;
  let frame = 0;
  let pause = 0;

  const reduced =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function complete(op: DrawOp) {
    hooks.put(op.element);
    written.push(op.element);
  }

  function step(now: number) {
    frame = 0;
    if (stopped) return;
    if (!current) {
      if (now < pause) return schedule();
      const next = queue.shift();
      if (!next) {
        if (finished) {
          hooks.pen(null);
          hooks.done(written);
        }
        return;
      }
      current = { op: next, started: now };
      if (reduced) {
        complete(next);
        current = null;
        return schedule();
      }
    }
    const { op, started } = current;
    const elapsed = (now - started) / 1000;
    if (op.kind === "text") {
      const { element } = op;
      const letters = [...element.text];
      const speed = element.fontSize >= 36 ? HEADING_LETTERS_PER_SECOND : LETTERS_PER_SECOND;
      const count = Math.min(letters.length, Math.floor(elapsed * speed) + 1);
      const shown = letters.slice(0, count).join("");
      hooks.put({ ...element, text: shown });
      const width = measureText(shown, "hand", element.fontSize).width;
      const rtl = element.align === "end";
      hooks.pen([
        rtl ? element.x + element.width - width : element.x + width,
        element.y + element.fontSize * 0.9,
      ]);
      if (count >= letters.length) finish(op);
    } else {
      const { element } = op;
      const points = element.points;
      // Points are about 6 units apart (layout.ts samples them so).
      const count = Math.min(points.length, Math.max(2, Math.floor((elapsed * STROKE_SPEED) / 6)));
      hooks.put({ ...element, points: points.slice(0, count) });
      const [px, py] = points[count - 1];
      hooks.pen([element.x + px, element.y + py]);
      if (count >= points.length) finish(op);
    }
    schedule();
  }

  function finish(op: DrawOp) {
    complete(op);
    current = null;
    pause = performance.now() + TRAVEL;
  }

  function schedule() {
    if (!frame && !stopped) frame = requestAnimationFrame(step);
  }

  return {
    add(ops: DrawOp[]) {
      queue.push(...ops);
      schedule();
    },
    /** No more ops are coming: once the queue is written, `done` is called. */
    finish() {
      finished = true;
      schedule();
    },
    /** Stops now: what is being written is finished at once, the rest is dropped. */
    stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(frame);
      if (current) complete(current.op);
      current = null;
      queue.length = 0;
      hooks.pen(null);
      hooks.done(written);
    },
  };
}

export type Animator = ReturnType<typeof createAnimator>;
