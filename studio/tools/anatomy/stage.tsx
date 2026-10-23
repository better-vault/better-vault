"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  FIGURE_HEIGHT,
  FIGURE_WIDTH,
  fitFigure,
  groundOf,
  haloSvg,
  largestFootprint,
  orderFor,
  partSvg,
  poseFor,
  transformFor,
  type PartPose,
  type Pose,
} from "./geometry";
import type { Scene } from "./scene";

interface StageProps {
  scene: Scene;
  step: number;
  exploded: boolean;
  /** The parts drawn with the lit accent. */
  lit: ReadonlySet<string>;
  label: string;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

const SVG = "http://www.w3.org/2000/svg";
/** Seconds for a move to get most of the way there. */
const EASE = 0.3;

const copyPose = (pose: Pose): Pose =>
  new Map(
    [...pose].map(([id, at]) => [
      id,
      { offset: [...at.offset], turn: at.turn, stretch: at.stretch },
    ]),
  );

/**
 * The drawing. Parts are drawn once into the SVG and moved by writing their
 * transforms each frame, so nothing re-renders while the figure moves.
 */
export function AnatomyStage({ scene, step, exploded, lit, label, onHover, onSelect }: StageProps) {
  const halosRef = useRef<SVGGElement>(null);
  const partsRef = useRef<SVGGElement>(null);
  const figure = useMemo(
    () => ({
      projection: fitFigure(scene),
      ground: groundOf(scene),
      largest: largestFootprint(scene),
      byId: new Map(scene.parts.map((part) => [part.id, part])),
    }),
    [scene],
  );
  const target = useMemo(() => poseFor(scene, step, exploded ? 1 : 0), [scene, step, exploded]);
  const live = useRef<{
    current: Pose;
    drawn: Map<string, { turn: number; stretch: number }>;
    parts: Map<string, SVGGElement>;
    halos: Map<string, SVGGElement>;
    order: string[];
    frame: number;
  } | null>(null);
  const targetRef = useRef(target);
  const litRef = useRef(lit);

  // Draw every part where the figure is now, whenever the scene changes.
  useEffect(() => {
    const partsLayer = partsRef.current;
    const halosLayer = halosRef.current;
    if (!partsLayer || !halosLayer) return;
    const { projection, ground, largest } = figure;
    const current = copyPose(targetRef.current);
    const parts = new Map<string, SVGGElement>();
    const halos = new Map<string, SVGGElement>();
    const drawn = new Map<string, { turn: number; stretch: number }>();
    partsLayer.replaceChildren();
    halosLayer.replaceChildren();
    for (const part of scene.parts) {
      const at = current.get(part.id)!;
      const node = document.createElementNS(SVG, "g");
      node.setAttribute("class", "anatomy-part");
      node.dataset.part = part.id;
      node.innerHTML = partSvg(part, projection, { turn: at.turn, stretch: at.stretch });
      parts.set(part.id, node);
      drawn.set(part.id, { turn: at.turn, stretch: at.stretch });
      const halo = haloSvg(part, projection, ground, largest);
      if (halo) {
        const group = document.createElementNS(SVG, "g");
        group.innerHTML = halo;
        halos.set(part.id, group);
        halosLayer.append(group);
      }
      const transform = transformFor(projection, at.offset);
      if (transform) {
        node.setAttribute("transform", transform);
        halos.get(part.id)?.setAttribute("transform", transform);
      }
      if (litRef.current.has(part.id)) node.dataset.lit = "";
    }
    const order = orderFor(scene, current, projection);
    partsLayer.append(...order.map((id) => parts.get(id)!));
    live.current = { current, drawn, parts, halos, order, frame: 0 };
    return () => {
      if (live.current?.frame) cancelAnimationFrame(live.current.frame);
      live.current = null;
    };
  }, [figure, scene]);

  // Move toward the pose of the step, together or apart.
  useEffect(() => {
    targetRef.current = target;
    const state = live.current;
    const partsLayer = partsRef.current;
    if (!state || !partsLayer) return;
    const { projection, byId } = figure;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let last = 0;

    const apply = (id: string, at: PartPose) => {
      const node = state.parts.get(id);
      if (!node) return;
      const transform = transformFor(projection, at.offset);
      if (transform) node.setAttribute("transform", transform);
      else node.removeAttribute("transform");
      const halo = state.halos.get(id);
      if (halo) {
        if (transform) halo.setAttribute("transform", transform);
        else halo.removeAttribute("transform");
      }
      const drawn = state.drawn.get(id)!;
      if (Math.abs(drawn.turn - at.turn) > 0.05 || Math.abs(drawn.stretch - at.stretch) > 0.02) {
        node.innerHTML = partSvg(byId.get(id)!, projection, { turn: at.turn, stretch: at.stretch });
        state.drawn.set(id, { turn: at.turn, stretch: at.stretch });
      }
    };

    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
      last = now;
      const share = still ? 1 : 1 - Math.exp(-dt / EASE);
      let moving = false;
      for (const [id, goal] of target) {
        const at = state.current.get(id);
        if (!at) continue;
        let changed = false;
        const follow = (from: number, to: number, close: number) => {
          if (from === to) return from;
          changed = true;
          const next = from + (to - from) * share;
          return Math.abs(to - next) < close ? to : next;
        };
        at.offset = [
          follow(at.offset[0], goal.offset[0], 0.01),
          follow(at.offset[1], goal.offset[1], 0.01),
          follow(at.offset[2], goal.offset[2], 0.01),
        ];
        at.turn = follow(at.turn, goal.turn, 0.02);
        at.stretch = follow(at.stretch, goal.stretch, 0.01);
        if (changed) {
          moving = true;
          apply(id, at);
        }
      }
      if (moving) {
        const order = orderFor(scene, state.current, projection);
        if (order.some((id, index) => id !== state.order[index])) {
          state.order = order;
          partsLayer.append(...order.map((id) => state.parts.get(id)!));
        }
      }
      state.frame = moving ? requestAnimationFrame(tick) : 0;
    };

    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = requestAnimationFrame(tick);
  }, [target, figure, scene]);

  // The lit accent.
  useEffect(() => {
    litRef.current = lit;
    const state = live.current;
    if (!state) return;
    for (const [id, node] of state.parts) {
      if (lit.has(id)) node.setAttribute("data-lit", "");
      else node.removeAttribute("data-lit");
    }
  }, [lit, figure]);

  const partAt = (target: EventTarget | null) =>
    target instanceof Element
      ? (target.closest<SVGGElement>("[data-part]")?.dataset.part ?? null)
      : null;

  return (
    <svg
      className="iso-svg mx-auto max-h-[max(16rem,calc(100dvh-19rem))]"
      viewBox={`0 0 ${FIGURE_WIDTH} ${FIGURE_HEIGHT}`}
      role="img"
      aria-label={label}
      onPointerOver={(event) => onHover(partAt(event.target))}
      onPointerLeave={() => onHover(null)}
      onClick={(event) => {
        const id = partAt(event.target);
        if (id) onSelect(id);
      }}
    >
      <g ref={halosRef} />
      <g ref={partsRef} />
    </svg>
  );
}
