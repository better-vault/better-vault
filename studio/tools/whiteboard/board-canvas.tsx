"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Canvas } from "@/components/panelui/canvas";
import { ElementView, SelectionLayer } from "./element-view";
import { boxOf, cornersOf, elementAt, insideMarquee, type Box, type Point } from "./geometry";
import { duplicate, fitPoints, newId, newSeed, removeElements, withGroups } from "./scene";
import type { BoardElement, ElementOf } from "./schema";
import { measureText } from "./text";
import {
  frameOf,
  handleAt,
  resizeElement,
  resizeElements,
  rotateElements,
  type Handle,
} from "./transform";
import type { BoardModel, Snapshot } from "./use-board";
import { gridGap, toWorld, zoomAt } from "./viewport";

type Gesture =
  | { kind: "pan"; start: Point; view: { x: number; y: number; zoom: number } }
  | {
      kind: "move";
      start: Point;
      ids: Set<string>;
      originals: BoardElement[];
      before: Snapshot;
      moved: boolean;
    }
  | {
      kind: "resize";
      handle: Exclude<Handle, "rotate">;
      originals: BoardElement[];
      before: Snapshot;
    }
  | { kind: "rotate"; center: Point; start: Point; originals: BoardElement[]; before: Snapshot }
  | { kind: "marquee"; start: Point; base: Set<string> }
  // The element being drawn is kept here as well as in state: a quick
  // stroke can end before React has drawn it.
  | { kind: "create" | "line" | "draw"; element: BoardElement; start: Point; before: Snapshot }
  | { kind: "erase"; hit: Set<string>; last: Point; before: Snapshot }
  | {
      kind: "pinch";
      distance: number;
      middle: Point;
      view: { x: number; y: number; zoom: number };
    };

const CURSORS: Partial<Record<Handle, string>> = {
  n: "ns-resize",
  s: "ns-resize",
  e: "ew-resize",
  w: "ew-resize",
  ne: "nesw-resize",
  sw: "nesw-resize",
  nw: "nwse-resize",
  se: "nwse-resize",
  rotate: "grab",
};

interface BoardCanvasProps {
  board: BoardModel;
  /** Space held: drag pans whatever the tool. */
  panning: boolean;
  onPlaceImage: (point: Point) => void;
  onCreated: () => void;
}

/** The drawing: Panel's Canvas for the dots or grid, an SVG for the elements, and every pointer gesture. */
export function BoardCanvas({ board, panning, onPlaceImage, onCreated }: BoardCanvasProps) {
  const svg = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const pointers = useRef(new Map<number, Point>());
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [erasing, setErasing] = useState<Set<string>>(() => new Set());
  const [cursor, setCursor] = useState<string | undefined>();
  const view = board.view ?? { x: 0, y: 0, zoom: 1 };
  const { elements, files, selectedElements, tool, style } = board;

  const screenPoint = (event: { clientX: number; clientY: number }): Point => {
    const box = svg.current?.getBoundingClientRect();
    return [event.clientX - (box?.left ?? 0), event.clientY - (box?.top ?? 0)];
  };
  const worldPoint = (event: { clientX: number; clientY: number }) =>
    toWorld(screenPoint(event), view);

  // Wheel: pans; with Ctrl or ⌘ (and trackpad pinches), zooms around the pointer.
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 400 : 1;
      const box = element.getBoundingClientRect();
      const at: Point = [event.clientX - box.left, event.clientY - box.top];
      board.setView((current) => {
        const base = current ?? { x: 0, y: 0, zoom: 1 };
        if (event.ctrlKey || event.metaKey)
          return zoomAt(base, Math.exp(-event.deltaY * scale * 0.01), at);
        const dx = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
        const dy = event.shiftKey && !event.deltaX ? 0 : event.deltaY;
        return { ...base, x: base.x - dx * scale, y: base.y - dy * scale };
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [board]);

  /** A new element in the current style. */
  function create<T extends BoardElement["type"]>(
    type: T,
    at: Point,
    extra: Partial<ElementOf<T>> = {},
  ): ElementOf<T> {
    return {
      type,
      id: newId(),
      x: at[0],
      y: at[1],
      width: 0,
      height: 0,
      angle: 0,
      stroke: style.stroke,
      fill: style.fill,
      fillStyle: style.fillStyle,
      strokeWidth: style.strokeWidth,
      strokeStyle: style.strokeStyle,
      roughness: style.roughness,
      edges: style.edges,
      opacity: style.opacity,
      seed: newSeed(),
      groupIds: [],
      locked: false,
      ...extra,
    } as unknown as ElementOf<T>;
  }

  /** A new text box, its first line centred on the point, as in Excalidraw. */
  function startText(at: Point) {
    const size = measureText("", style.font, style.fontSize);
    const element = create("text", [at[0], at[1] - size.height / 2], {
      text: "",
      font: style.font,
      fontSize: style.fontSize,
      align: style.align,
    });
    board.setElements((list) => [...list, { ...element, width: size.width, height: size.height }]);
    board.setSelected(new Set([element.id]));
    board.beginEdit(element.id);
  }

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (board.editingId) return;
    // No text selection or focus change: a new text box keeps the focus it is given.
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, [event.clientX, event.clientY]);

    // Two fingers: pinch to zoom, from wherever the first finger had got to.
    if (pointers.current.size === 2) {
      const current = gesture.current;
      if (current && "before" in current) {
        board.setElements(current.before.elements);
      }
      const [a, b] = [...pointers.current.values()];
      const box = svg.current!.getBoundingClientRect();
      gesture.current = {
        kind: "pinch",
        distance: Math.hypot(b[0] - a[0], b[1] - a[1]),
        middle: [(a[0] + b[0]) / 2 - box.left, (a[1] + b[1]) / 2 - box.top],
        view,
      };
      return;
    }

    const at = worldPoint(event);
    const before = board.latestRef.current;
    if (event.button === 1 || tool === "hand" || panning) {
      gesture.current = { kind: "pan", start: screenPoint(event), view };
      setCursor("grabbing");
      return;
    }
    if (event.button !== 0) return;

    switch (tool) {
      case "selection": {
        const frame = frameOf(selectedElements);
        const unlocked = selectedElements.filter((element) => !element.locked);
        if (frame && unlocked.length === selectedElements.length) {
          const handle = handleAt(frame, at, view.zoom);
          if (handle === "rotate") {
            gesture.current = {
              kind: "rotate",
              center: [frame.x + frame.width / 2, frame.y + frame.height / 2],
              start: at,
              originals: selectedElements,
              before,
            };
            return;
          }
          if (handle) {
            gesture.current = { kind: "resize", handle, originals: selectedElements, before };
            return;
          }
        }
        const hit = elementAt(elements, at, view.zoom);
        if (!hit) {
          const base = event.shiftKey ? new Set(board.selected) : new Set<string>();
          if (!event.shiftKey) board.setSelected(new Set());
          gesture.current = { kind: "marquee", start: at, base };
          return;
        }
        const group = withGroups(elements, [hit.id]);
        let ids = new Set(board.selected);
        if (event.shiftKey) {
          const all = [...group].every((id) => ids.has(id));
          for (const id of group) {
            if (all) ids.delete(id);
            else ids.add(id);
          }
        } else if (!ids.has(hit.id)) ids = group;
        let list = elements;
        // Alt-drag moves a copy.
        if (event.altKey && ids.size > 0) {
          const copy = duplicate(elements, ids, [0, 0]);
          list = copy.elements;
          ids = copy.ids;
          board.setElements(list);
        }
        board.setSelected(ids);
        gesture.current = {
          kind: "move",
          start: at,
          ids,
          originals: list.filter((element) => ids.has(element.id)),
          before,
          moved: event.altKey,
        };
        return;
      }
      case "rectangle":
      case "diamond":
      case "ellipse": {
        const element = create(tool, at);
        board.setElements((list) => [...list, element]);
        board.setSelected(new Set());
        gesture.current = { kind: "create", element, start: at, before };
        return;
      }
      case "line":
      case "arrow": {
        const element = create(tool, at, {
          points: [
            [0, 0],
            [0, 0],
          ],
          start: style.start,
          end: tool === "arrow" ? style.end : null,
        } as Partial<ElementOf<"arrow">>);
        board.setElements((list) => [...list, element]);
        board.setSelected(new Set());
        gesture.current = { kind: "line", element, start: at, before };
        return;
      }
      case "freedraw": {
        const pressure = event.pointerType === "pen" ? event.pressure : 0.5;
        const element = create("freedraw", at, {
          points: [[0, 0, pressure]],
          simulatePressure: event.pointerType !== "pen",
          fill: "none",
        });
        board.setElements((list) => [...list, element]);
        gesture.current = { kind: "draw", element, start: at, before };
        return;
      }
      case "text": {
        const hit = elementAt(elements, at, view.zoom);
        if (hit?.type === "text") {
          board.setSelected(new Set([hit.id]));
          board.beginEdit(hit.id);
        } else startText(at);
        return;
      }
      case "image":
        onPlaceImage(at);
        return;
      case "eraser": {
        const hit = elementAt(elements, at, view.zoom);
        const set = new Set(hit ? [hit.id] : []);
        setErasing(set);
        gesture.current = { kind: "erase", hit: set, last: at, before };
        return;
      }
    }
  }

  /** Moves the element being drawn on, in the gesture and on the board. */
  function update(current: Extract<Gesture, { element: BoardElement }>, next: BoardElement) {
    current.element = next;
    board.setElements((list) => list.map((element) => (element.id === next.id ? next : element)));
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (pointers.current.has(event.pointerId))
      pointers.current.set(event.pointerId, [event.clientX, event.clientY]);
    const current = gesture.current;
    const at = worldPoint(event);
    if (!current) {
      // Hover: the cursor says what a press would do.
      if (tool === "selection") {
        const frame = frameOf(selectedElements);
        const handle =
          frame && selectedElements.every((element) => !element.locked)
            ? handleAt(frame, at, view.zoom)
            : null;
        setCursor(
          handle ? CURSORS[handle] : elementAt(elements, at, view.zoom) ? "move" : undefined,
        );
      }
      return;
    }

    switch (current.kind) {
      case "pinch": {
        const [a, b] = [...pointers.current.values()];
        if (!a || !b) return;
        const box = svg.current!.getBoundingClientRect();
        const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const middle: Point = [(a[0] + b[0]) / 2 - box.left, (a[1] + b[1]) / 2 - box.top];
        const zoomed = zoomAt(current.view, distance / current.distance, current.middle);
        board.setView({
          ...zoomed,
          x: zoomed.x + middle[0] - current.middle[0],
          y: zoomed.y + middle[1] - current.middle[1],
        });
        return;
      }
      case "pan": {
        const [sx, sy] = screenPoint(event);
        board.setView({
          ...current.view,
          x: current.view.x + sx - current.start[0],
          y: current.view.y + sy - current.start[1],
        });
        return;
      }
      case "move": {
        let dx = at[0] - current.start[0];
        let dy = at[1] - current.start[1];
        if (event.shiftKey) {
          if (Math.abs(dx) > Math.abs(dy)) dy = 0;
          else dx = 0;
        }
        current.moved ||= Math.hypot(dx, dy) * view.zoom > 2;
        if (!current.moved) return;
        const moved = new Map(
          current.originals.map((element) => [
            element.id,
            { ...element, x: element.x + dx, y: element.y + dy },
          ]),
        );
        board.setElements((list) => list.map((element) => moved.get(element.id) ?? element));
        return;
      }
      case "resize": {
        const options = { keepAspect: event.shiftKey, fromCenter: event.altKey };
        const resized =
          current.originals.length === 1
            ? [resizeElement(current.originals[0], current.handle, at, options)]
            : resizeElements(current.originals, current.handle, at, options);
        const byId = new Map(resized.map((element) => [element.id, element]));
        board.setElements((list) => list.map((element) => byId.get(element.id) ?? element));
        return;
      }
      case "rotate": {
        const turned = new Map(
          rotateElements(current.originals, current.center, current.start, at, event.shiftKey).map(
            (element) => [element.id, element],
          ),
        );
        board.setElements((list) => list.map((element) => turned.get(element.id) ?? element));
        return;
      }
      case "marquee": {
        const box = boxOf([current.start, at]);
        setMarquee(box);
        const inside = insideMarquee(elements, box).map((element) => element.id);
        board.setSelected(new Set([...current.base, ...withGroups(elements, inside)]));
        return;
      }
      case "create": {
        let width = at[0] - current.start[0];
        let height = at[1] - current.start[1];
        if (event.shiftKey) {
          const side = Math.max(Math.abs(width), Math.abs(height));
          width = Math.sign(width || 1) * side;
          height = Math.sign(height || 1) * side;
        }
        const [ox, oy] = event.altKey
          ? [current.start[0] - width, current.start[1] - height]
          : current.start;
        const [w, h] = event.altKey ? [width * 2, height * 2] : [width, height];
        const box = {
          x: Math.min(ox, ox + w),
          y: Math.min(oy, oy + h),
          width: Math.abs(w),
          height: Math.abs(h),
        };
        update(current, { ...current.element, ...box });
        return;
      }
      case "line": {
        let dx = at[0] - current.start[0];
        let dy = at[1] - current.start[1];
        if (event.shiftKey) {
          const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 12)) * (Math.PI / 12);
          const length = Math.hypot(dx, dy);
          dx = Math.cos(angle) * length;
          dy = Math.sin(angle) * length;
        }
        update(current, {
          ...current.element,
          points: [
            [0, 0],
            [dx, dy],
          ],
          width: Math.abs(dx),
          height: Math.abs(dy),
        } as BoardElement);
        return;
      }
      case "draw": {
        const events = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
        const points = events.map((native) => {
          const [wx, wy] = worldPoint(native);
          return [
            wx - current.start[0],
            wy - current.start[1],
            native.pointerType === "pen" ? native.pressure : 0.5,
          ] as [number, number, number];
        });
        const drawn = current.element;
        if (drawn.type === "freedraw")
          update(current, { ...drawn, points: [...drawn.points, ...points] });
        return;
      }
      case "erase": {
        // Every few pixels along the way, so a quick swipe doesn't skip a thin line.
        const [lx, ly] = current.last;
        const steps = Math.max(1, Math.ceil((Math.hypot(at[0] - lx, at[1] - ly) * view.zoom) / 4));
        let added = false;
        for (let step = 1; step <= steps; step++) {
          const point: Point = [
            lx + ((at[0] - lx) * step) / steps,
            ly + ((at[1] - ly) * step) / steps,
          ];
          const hit = elementAt(elements, point, view.zoom);
          if (hit && !current.hit.has(hit.id)) {
            current.hit.add(hit.id);
            added = true;
          }
        }
        current.last = at;
        if (added) setErasing(new Set(current.hit));
        return;
      }
    }
  }

  function onPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId);
    const current = gesture.current;
    if (!current) return;
    if (current.kind === "pinch") {
      // Back to one finger: nothing more until it lifts.
      if (pointers.current.size === 0) gesture.current = null;
      return;
    }
    gesture.current = null;
    setCursor(undefined);
    const tiny = (width: number, height: number) => Math.max(width, height) * view.zoom < 3;

    switch (current.kind) {
      case "move":
        if (current.moved) board.record(current.before);
        return;
      case "resize":
        board.setElements((list) =>
          list.map((element) =>
            current.originals.some((original) => original.id === element.id)
              ? fitPoints(element)
              : element,
          ),
        );
        board.record(current.before);
        return;
      case "rotate":
        board.record(current.before);
        return;
      case "marquee":
        setMarquee(null);
        return;
      case "create":
      case "line":
      case "draw": {
        const made = current.element;
        // A click without a drag draws nothing (a pen dot does count).
        if (current.kind !== "draw" && tiny(made.width, made.height)) {
          board.setElements((list) => list.filter((element) => element.id !== made.id));
          return;
        }
        const fitted = fitPoints(made);
        board.setElements((list) =>
          list.map((element) => (element.id === made.id ? fitted : element)),
        );
        board.record(current.before);
        if (current.kind !== "draw") {
          board.setSelected(new Set([made.id]));
          onCreated();
        }
        return;
      }
      case "erase":
        setErasing(new Set());
        if (current.hit.size > 0) {
          board.setElements((list) => removeElements(list, current.hit));
          board.setSelected((ids) => new Set([...ids].filter((id) => !current.hit.has(id))));
          board.record(current.before);
        }
        return;
    }
  }

  function onDoubleClick(event: React.MouseEvent<SVGSVGElement>) {
    if (tool !== "selection") return;
    const at = worldPoint(event);
    const hit = elementAt(elements, at, view.zoom);
    if (hit?.type === "text") {
      board.setSelected(new Set([hit.id]));
      board.beginEdit(hit.id);
    } else if (!hit) startText(at);
  }

  const frame = useMemo(() => frameOf(selectedElements), [selectedElements]);
  const editing = board.editingId;
  const toolCursor =
    panning || tool === "hand"
      ? "grab"
      : tool === "selection"
        ? undefined
        : tool === "text"
          ? "text"
          : tool === "eraser"
            ? "cell"
            : "crosshair";

  return (
    <Canvas viewport={view} className="absolute inset-0 rounded-[inherit] bg-background">
      {board.background !== "none" ? (
        <Canvas.Pattern
          variant={board.background === "grid" ? "grid" : "dots"}
          gap={gridGap(view.zoom)}
          // The pattern scales with the view: divide, so marks keep their size on screen.
          size={1 / view.zoom}
        />
      ) : null}
      <Canvas.Content className="absolute inset-0">
        <svg
          ref={svg}
          className="absolute inset-0 size-full touch-none outline-none select-none"
          style={{ cursor: cursor ?? toolCursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={onDoubleClick}
        >
          <g transform={`translate(${view.x} ${view.y}) scale(${view.zoom})`}>
            {elements.map((element) => (
              <ElementView
                key={element.id}
                element={element}
                file={element.type === "image" ? files[element.fileId] : undefined}
                faded={erasing.has(element.id)}
                hidden={element.id === editing}
              />
            ))}
            {frame && !editing ? (
              <SelectionLayer
                frame={frame}
                outlines={selectedElements.length > 1 ? selectedElements.map(cornersOf) : []}
                zoom={view.zoom}
                showHandles={selectedElements.every((element) => !element.locked)}
                dashed={
                  selectedElements.length > 1 || selectedElements.some((element) => element.locked)
                }
              />
            ) : null}
            {marquee ? (
              <rect
                x={marquee.minX}
                y={marquee.minY}
                width={marquee.maxX - marquee.minX}
                height={marquee.maxY - marquee.minY}
                style={{
                  fill: "color-mix(in oklab, var(--info) 10%, transparent)",
                  stroke: "var(--info)",
                  strokeWidth: 1,
                  vectorEffect: "non-scaling-stroke",
                }}
              />
            ) : null}
          </g>
        </svg>
      </Canvas.Content>
    </Canvas>
  );
}
