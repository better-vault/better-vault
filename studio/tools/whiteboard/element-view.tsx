"use client";

import { memo } from "react";
import type { Point } from "./geometry";
import { fillCss, strokeCss } from "./palette";
import type { BoardElement, BoardFile } from "./schema";
import { describeShape } from "./shapes";
import { fontFamily, LINE_HEIGHT } from "./text";
import { handlePositions, handles, type Frame } from "./transform";

/** One element, drawn in world units. Redrawn only when it changes. */
export const ElementView = memo(function ElementView({
  element,
  file,
  faded,
  hidden,
}: {
  element: BoardElement;
  file?: BoardFile;
  /** Marked by the eraser. */
  faded?: boolean;
  /** Text being edited is drawn by the editor instead. */
  hidden?: boolean;
}) {
  const { x, y, width, height } = element;
  const degrees = (element.angle * 180) / Math.PI;
  const stroke = strokeCss(element.stroke);
  const fill = element.fill === "none" ? "none" : fillCss(element.fill);
  const opacity = (element.opacity / 100) * (faded ? 0.3 : 1);

  let body: React.ReactNode = null;
  if (element.type === "text") {
    const anchor =
      element.align === "center" ? "middle" : element.align === "end" ? "end" : "start";
    const tx = element.align === "center" ? width / 2 : element.align === "end" ? width : 0;
    body = (
      <text
        style={{ fontFamily: fontFamily[element.font], fontSize: element.fontSize, fill: stroke }}
        textAnchor={anchor}
      >
        {element.text.split("\n").map((line, at) => (
          <tspan
            key={at}
            x={tx}
            y={at * element.fontSize * LINE_HEIGHT + element.fontSize * 0.95}
            xmlSpace="preserve"
          >
            {line || " "}
          </tspan>
        ))}
      </text>
    );
  } else if (element.type === "image") {
    body = file ? (
      <image href={file.dataUrl} width={width} height={height} preserveAspectRatio="none" />
    ) : (
      <rect width={width} height={height} rx={8} style={{ fill: "var(--muted)" }} />
    );
  } else {
    const { paths, dash } = describeShape(element);
    body = paths.map((path, at) => (
      <path
        key={at}
        d={path.d}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={
          path.role === "fill"
            ? { fill, stroke: "none" }
            : path.role === "ink"
              ? { fill: stroke, stroke: "none" }
              : path.role === "hachure"
                ? { fill: "none", stroke: fill, strokeWidth: path.width ?? element.strokeWidth / 2 }
                : { fill: "none", stroke, strokeWidth: element.strokeWidth, strokeDasharray: dash }
        }
      />
    ));
  }

  return (
    <g
      transform={`translate(${x} ${y})${degrees ? ` rotate(${degrees} ${width / 2} ${height / 2})` : ""}`}
      opacity={opacity}
      visibility={hidden ? "hidden" : undefined}
    >
      {body}
    </g>
  );
});

/** The selection: its frame, resize handles and rotate handle, drawn at a constant screen size. */
export function SelectionLayer({
  frame,
  outlines,
  zoom,
  showHandles,
  dashed,
}: {
  frame: Frame;
  /** Each element's own outline, when several are selected. */
  outlines: Point[][];
  zoom: number;
  showHandles: boolean;
  dashed: boolean;
}) {
  const size = 8 / zoom;
  const positions = handlePositions(frame, zoom);
  const center: Point = [frame.x + frame.width / 2, frame.y + frame.height / 2];
  const degrees = (frame.angle * 180) / Math.PI;
  const line = {
    fill: "none",
    stroke: "var(--info)",
    strokeWidth: 1,
    vectorEffect: "non-scaling-stroke",
  } as const;
  return (
    <g pointerEvents="none">
      {outlines.map((corners, at) => (
        <polygon
          key={at}
          points={corners.map((point) => point.join(",")).join(" ")}
          style={{ ...line, opacity: 0.5 }}
        />
      ))}
      <rect
        x={frame.x - 4 / zoom}
        y={frame.y - 4 / zoom}
        width={frame.width + 8 / zoom}
        height={frame.height + 8 / zoom}
        transform={degrees ? `rotate(${degrees} ${center[0]} ${center[1]})` : undefined}
        style={{ ...line, strokeDasharray: dashed ? "4 3" : undefined }}
      />
      {showHandles ? (
        <>
          {handles.map((handle) => {
            const [hx, hy] = positions[handle];
            return (
              <rect
                key={handle}
                x={hx - size / 2}
                y={hy - size / 2}
                width={size}
                height={size}
                rx={2 / zoom}
                transform={degrees ? `rotate(${degrees} ${hx} ${hy})` : undefined}
                style={{
                  fill: "var(--background)",
                  stroke: "var(--info)",
                  strokeWidth: 1,
                  vectorEffect: "non-scaling-stroke",
                }}
              />
            );
          })}
          <circle
            cx={positions.rotate[0]}
            cy={positions.rotate[1]}
            r={size / 2 + 1 / zoom}
            style={{
              fill: "var(--background)",
              stroke: "var(--info)",
              strokeWidth: 1,
              vectorEffect: "non-scaling-stroke",
            }}
          />
        </>
      ) : null}
    </g>
  );
}
