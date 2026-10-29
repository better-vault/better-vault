"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  FIGURE_HEIGHT,
  FIGURE_WIDTH,
  anchorOf,
  fitFigure,
  groundOf,
  haloSvg,
  largestFootprint,
  orderFor,
  partSvg,
  poseFor,
  transformFor,
  zoomBetween,
  type PartPose,
  type Pose,
} from "./geometry";
import * as k from "./kit/iso-kit";
import type { Scene } from "./scene";

interface StageProps {
  scene: Scene;
  step: number;
  exploded: boolean;
  /** The parts drawn with the lit accent: the ones to watch in this step. */
  lit: ReadonlySet<string>;
  /** The part pointed at or chosen: tinted, with a leader line to its name. */
  active: string | null;
  label: string;
  onHover: (id: string | null) => void;
  /** A part, or null for a click on empty space. */
  onSelect: (id: string | null) => void;
}

const SVG = "http://www.w3.org/2000/svg";
/** Seconds for a move to get most of the way there. */
const EASE = 0.3;
/** The leader line: out from the part, then along to the label, in CSS pixels. */
const RISE = 30;
const RUN = 18;

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
export function AnatomyStage({
  scene,
  step,
  exploded,
  lit,
  active,
  label,
  onHover,
  onSelect,
}: StageProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const worldRef = useRef<SVGGElement>(null);
  const halosRef = useRef<SVGGElement>(null);
  const partsRef = useRef<SVGGElement>(null);
  const leaderRef = useRef<SVGPathElement>(null);
  const dotRef = useRef<SVGGElement>(null);
  const tagRef = useRef<HTMLSpanElement>(null);
  const figure = useMemo(
    () => ({
      projection: fitFigure(scene),
      apart: fitFigure(scene, { apart: true }),
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
    /** 0 with the camera on the figure put together, 1 on the figure taken apart. */
    zoom: number;
    frame: number;
  } | null>(null);
  const targetRef = useRef(target);
  const explodedRef = useRef(exploded);
  const litRef = useRef(lit);
  const activeRef = useRef(active);

  /** Puts the leader line and the name on the active part, wherever it is now. */
  const placeLeader = useCallback(() => {
    const box = boxRef.current;
    const svg = svgRef.current;
    const leader = leaderRef.current;
    const dot = dotRef.current;
    const tag = tagRef.current;
    const state = live.current;
    if (!box || !svg || !leader || !dot || !tag) return;
    const id = activeRef.current;
    const part = id ? figure.byId.get(id) : undefined;
    const at = id ? state?.current.get(id) : undefined;
    const matrix = partsRef.current?.getScreenCTM();
    if (!part || !at || !matrix) {
      leader.setAttribute("d", "");
      dot.style.display = "none";
      tag.style.display = "none";
      return;
    }
    const [vx, vy] = k.iso(anchorOf(part, at), figure.projection);
    const point = new DOMPoint(vx, vy).matrixTransform(matrix);
    const frame = box.getBoundingClientRect();
    const x = point.x - frame.left;
    const y = point.y - frame.top;
    // The figure's own extent on screen, so the name sits in the margin beside it.
    const drawing = partsRef.current?.getBoundingClientRect();
    const left = drawing ? drawing.left - frame.left : 0;
    const right = drawing ? drawing.right - frame.left : frame.width;
    const toRight = x >= (left + right) / 2;
    const up = y > frame.height * 0.25;
    tag.textContent = part.name;
    tag.style.display = "";
    const width = tag.offsetWidth;
    const elbow = { x: x + (toRight ? RISE : -RISE), y: y + (up ? -RISE : RISE) };
    const end = toRight
      ? {
          x: Math.max(
            elbow.x + 6,
            Math.min(Math.max(elbow.x + RUN, right + 12), frame.width - width - 8),
          ),
          y: elbow.y,
        }
      : {
          x: Math.min(elbow.x - 6, Math.max(Math.min(elbow.x - RUN, left - 12), width + 8)),
          y: elbow.y,
        };
    leader.setAttribute("d", `M${x} ${y}L${elbow.x} ${elbow.y}L${end.x} ${end.y}`);
    dot.style.display = "";
    dot.setAttribute("transform", `translate(${x} ${y})`);
    tag.style.left = `${end.x + (toRight ? 4 : -4)}px`;
    tag.style.top = `${end.y}px`;
    tag.style.translate = toRight ? "0 -50%" : "-100% -50%";
  }, [figure]);

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
      if (activeRef.current === part.id) node.dataset.active = "";
    }
    const order = orderFor(scene, current, projection);
    partsLayer.append(...order.map((id) => parts.get(id)!));
    const zoom = explodedRef.current ? 1 : 0;
    worldRef.current?.setAttribute("transform", zoomBetween(projection, figure.apart, zoom));
    live.current = { current, drawn, parts, halos, order, zoom, frame: 0 };
    placeLeader();
    return () => {
      if (live.current?.frame) cancelAnimationFrame(live.current.frame);
      live.current = null;
    };
  }, [figure, scene, placeLeader]);

  // Move toward the pose of the step, together or apart.
  useEffect(() => {
    targetRef.current = target;
    explodedRef.current = exploded;
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
      const zoomGoal = exploded ? 1 : 0;
      if (state.zoom !== zoomGoal) {
        const next = state.zoom + (zoomGoal - state.zoom) * share;
        state.zoom = Math.abs(zoomGoal - next) < 0.002 ? zoomGoal : next;
        worldRef.current?.setAttribute(
          "transform",
          zoomBetween(projection, figure.apart, state.zoom),
        );
        moving = true;
      }
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
        placeLeader();
      }
      state.frame = moving ? requestAnimationFrame(tick) : 0;
    };

    if (state.frame) cancelAnimationFrame(state.frame);
    state.frame = requestAnimationFrame(tick);
  }, [target, exploded, figure, scene, placeLeader]);

  // The lit accent on the parts to watch.
  useEffect(() => {
    litRef.current = lit;
    for (const [id, node] of live.current?.parts ?? []) {
      if (lit.has(id)) node.setAttribute("data-lit", "");
      else node.removeAttribute("data-lit");
    }
  }, [lit, figure]);

  // The part pointed at or chosen, and its leader line.
  useEffect(() => {
    activeRef.current = active;
    for (const [id, node] of live.current?.parts ?? []) {
      if (id === active) node.setAttribute("data-active", "");
      else node.removeAttribute("data-active");
    }
    placeLeader();
  }, [active, figure, placeLeader]);

  // The figure scales with its box; the leader line follows.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const observer = new ResizeObserver(() => placeLeader());
    observer.observe(box);
    return () => observer.disconnect();
  }, [placeLeader]);

  const partAt = (target: EventTarget | null) =>
    target instanceof Element
      ? (target.closest<SVGGElement>("[data-part]")?.dataset.part ?? null)
      : null;

  return (
    <div ref={boxRef} className="absolute inset-0">
      <svg
        ref={svgRef}
        className="iso-svg absolute inset-0 size-full"
        viewBox={`0 0 ${FIGURE_WIDTH} ${FIGURE_HEIGHT}`}
        role="img"
        aria-label={label}
        onPointerOver={(event) => onHover(partAt(event.target))}
        onPointerLeave={() => onHover(null)}
        onClick={(event) => onSelect(partAt(event.target))}
      >
        <g ref={worldRef}>
          <g ref={halosRef} />
          <g ref={partsRef} />
        </g>
      </svg>
      <svg aria-hidden className="pointer-events-none absolute inset-0 size-full overflow-visible">
        <path ref={leaderRef} className="anatomy-leader" />
        <g ref={dotRef} style={{ display: "none" }}>
          <circle className="anatomy-leader-pulse" r={4} />
          <circle className="anatomy-leader-dot" r={3.5} />
        </g>
      </svg>
      <span
        ref={tagRef}
        aria-hidden
        style={{ display: "none" }}
        className="pointer-events-none absolute max-w-56 truncate rounded-full bg-info px-2.5 py-1 text-xs font-medium text-info-foreground shadow-sm"
      />
    </div>
  );
}
