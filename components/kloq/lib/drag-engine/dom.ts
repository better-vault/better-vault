import { type JiggleState, liftOf } from "../drag-physics";
import type { PlacedEvent } from "../placement";
import { withoutSegment } from "../recurrence";
import { SPRING, SPRING_MS } from "../springs";
import type { CommitResult } from "./types";

export const capturePointer = (el: Element, pointerId: number) => {
  try {
    el.setPointerCapture(pointerId);
  } catch {
    /* uncapturable pointer */
  }
};

export function landCommit(result: CommitResult, settled: () => void, declined: () => void): void {
  if (result && typeof (result as Promise<boolean>).then === "function") {
    void (result as Promise<boolean>).then(
      (ok) => (ok ? settled() : declined()),
      () => declined(),
    );
    return;
  }
  settled();
}

// DOM-level lookup of a split event's other segments — no registry, usable from pointerdown
export function segmentSiblings(event: PlacedEvent, node: HTMLElement): HTMLElement[] {
  if (event.segment.n <= 1) return [];
  const base = withoutSegment(event.id);
  const root = node.closest("[data-craft='intent-threshold']") ?? node.ownerDocument;
  const out: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>("[data-cal-event]").forEach((el) => {
    const id = el.dataset.calEvent;
    if (el !== node && id && withoutSegment(id) === base) out.push(el);
  });
  return out;
}

export function setTransformAll(
  node: HTMLElement,
  siblings: readonly HTMLElement[],
  value: string,
): void {
  node.style.transform = value;
  for (const sib of siblings) sib.style.transform = value;
}

// returns the node's own animation — the one whose `onfinish` drives the commit
export function animateAll(
  node: HTMLElement,
  siblings: readonly HTMLElement[],
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Animation {
  for (const sib of siblings) sib.animate(keyframes, options);
  return node.animate(keyframes, options);
}

export function springHomeFrom(
  node: HTMLElement,
  from: string,
  done: () => void,
  siblings: readonly HTMLElement[] = [],
): void {
  const anim = animateAll(
    node,
    siblings,
    [
      { transform: from, "--kloq-lift": node.style.getPropertyValue("--kloq-lift") || "1" },
      { transform: "none", "--kloq-lift": "0" },
    ],
    { duration: SPRING_MS, easing: SPRING },
  );
  anim.onfinish = () => {
    setTransformAll(node, siblings, "");
    done();
  };
}

export const liftFrom = (j: JiggleState) => ({ "--kloq-lift": liftOf(j).toFixed(3) });
export const LIFT_REST = { "--kloq-lift": "0" };
