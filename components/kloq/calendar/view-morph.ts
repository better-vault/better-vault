import type { StepDirection } from "../lib/navigation";
import { masterIdOf } from "../lib/recurrence";
import { EASE_OUT, ms, prefersReducedMotion, SPRING } from "../lib/springs";

export interface Snapshot {
  rects: Map<string, DOMRect>;
  headerRects: DOMRect[];
  /** a commit morph: the blocks around a landed drop make room on a spring */
  commit?: boolean;
  /** master id of the event that landed — it animates itself; only its neighbours morph */
  except?: string;
  at: number;
}

// a commit snapshot older than this (scope dialog left open) would glide from stale rects
const SNAPSHOT_TTL_MS = 1500;
const COMMIT_SPRING_MS = 260;
// past this many blocks the morph is noise, and measuring them all is the cost
const MORPH_CAP = 150;
// above everything the surface draws; the surface is its own stacking context
const MORPH_Z = "50";

export function captureSnapshot(
  root: HTMLElement | null,
  commit = false,
  except?: string,
): Snapshot {
  const rects = new Map<string, DOMRect>();
  const blocks = root?.querySelectorAll<HTMLElement>("[data-cal-event]:not([data-cal-lifted])");
  if (blocks) {
    const n = Math.min(blocks.length, MORPH_CAP);
    for (let i = 0; i < n; i++)
      rects.set(blocks[i].dataset.calEvent!, blocks[i].getBoundingClientRect());
  }
  const headerRects: DOMRect[] = [];
  root
    ?.querySelectorAll<HTMLElement>("[data-cal-day-header]")
    .forEach((el) => headerRects.push(el.getBoundingClientRect()));
  return { rects, headerRects, commit, except, at: performance.now() };
}

const touches = (r: DOMRect, box: DOMRect) =>
  r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.bottom;

/** A static copy of `el` that flies in its place; inert, and invisible to every event query. */
function ghostOf(el: HTMLElement, now: DOMRect, stage: DOMRect, hatch: string | null): HTMLElement {
  const ghost = el.cloneNode(true) as HTMLElement;
  for (const name of ["data-cal-event", "id", "role", "aria-label", "aria-pressed", "tabindex"])
    ghost.removeAttribute(name);
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("inert", "");
  Object.assign(ghost.style, {
    position: "absolute",
    left: `${now.left - stage.left}px`,
    top: `${now.top - stage.top}px`,
    width: `${now.width}px`,
    height: `${now.height}px`,
    margin: "0",
    transformOrigin: "left top",
    pointerEvents: "none",
  } satisfies Partial<CSSStyleDeclaration>);
  // the free/busy hatch is keyed on `[data-cal-event]`, which the ghost no longer carries
  if (hatch) ghost.style.backgroundImage = hatch;
  return ghost;
}

/**
 * FLIP between two renders. The real blocks never leave their new layout position — they are
 * only hidden while a ghost flies from the old rect — so a pointer or a test that asks where a
 * block is mid-morph gets the place it actually is.
 */
export function playViewMorph(root: HTMLElement | null, before: Snapshot) {
  if (!root || prefersReducedMotion()) return;
  if (before.commit && performance.now() - before.at > SNAPSHOT_TTL_MS) return;
  const EASE = before.commit ? SPRING : EASE_OUT;
  const MS = ms(before.commit ? COMMIT_SPRING_MS : 220);

  // every read first, then every write: interleaving them re-runs style per block
  const surface = root.querySelector<HTMLElement>(':scope > [role="region"]') ?? root;
  const stage = surface.getBoundingClientRect();
  const blocks = root.querySelectorAll<HTMLElement>("[data-cal-event]");
  const n = Math.min(blocks.length, MORPH_CAP);
  const moves: {
    el: HTMLElement;
    old: DOMRect | undefined;
    now: DOMRect;
    hatch: string | null;
  }[] = [];
  for (let i = 0; i < n; i++) {
    const el = blocks[i];
    // after a commit the landed block has already been animated into place
    if (
      before.commit &&
      (masterIdOf(el.dataset.calEvent!) === before.except ||
        el.hasAttribute("data-dragging") ||
        el.hasAttribute("data-resizing") ||
        el.getAnimations().some((a) => a.playState === "running"))
    )
      continue;
    moves.push({
      el,
      old: before.rects.get(el.dataset.calEvent!),
      now: el.getBoundingClientRect(),
      hatch: el.hasAttribute("data-free") ? getComputedStyle(el).backgroundImage : null,
    });
  }

  let layer: HTMLElement | null = null;
  let flying = 0;
  for (const { el, old, now, hatch } of moves) {
    if (!old) {
      if (before.commit) continue;
      el.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: ms(200),
        easing: "ease-out",
      });
      continue;
    }
    const dx = old.left - now.left;
    const dy = old.top - now.top;
    const sw = now.width > 0 ? old.width / now.width : 1;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sw - 1) < 0.01) continue;
    // both ends out of sight: nothing to watch
    if (!touches(old, stage) && !touches(now, stage)) continue;

    if (!layer) {
      layer = document.createElement("div");
      layer.setAttribute("data-cal-morph", "");
      layer.setAttribute("aria-hidden", "true");
      Object.assign(layer.style, {
        position: "absolute",
        inset: "0",
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: MORPH_Z,
      } satisfies Partial<CSSStyleDeclaration>);
      surface.appendChild(layer);
    }
    const stageLayer = layer;
    const ghost = ghostOf(el, now, stage, hatch);
    stageLayer.appendChild(ghost);
    ghost.animate(
      [{ transform: `translate(${dx}px, ${dy}px) scaleX(${sw})` }, { transform: "none" }],
      { duration: MS, easing: EASE, fill: "forwards" },
    );
    flying++;
    const hidden = el.animate([{ opacity: 0 }, { opacity: 0 }], { duration: MS });
    const land = () => {
      ghost.remove();
      if (--flying === 0) stageLayer.remove();
    };
    hidden.onfinish = land;
    hidden.oncancel = land;
  }
}

// Range step: a slide, not the view morph — a step swaps the whole event set, so blocks don't correspond.
export function playRangeSlide(surface: HTMLElement | null, dir: StepDirection) {
  if (!surface || prefersReducedMotion()) return;
  surface.animate(
    [
      { transform: `translateX(${dir * 12}px)`, opacity: 0.4 },
      { transform: "none", opacity: 1 },
    ],
    { duration: ms(220), easing: EASE_OUT },
  );
}

/** Where a demoted all-day event lands, clamped into the drawn day window. */
