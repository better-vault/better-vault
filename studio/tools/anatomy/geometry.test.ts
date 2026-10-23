import { describe, expect, it } from "vitest";
import { springScale } from "./example";
import {
  FIGURE_HEIGHT,
  FIGURE_WIDTH,
  boundsOf,
  cornersOf,
  figureSvg,
  fitFigure,
  moveBounds,
  orderFor,
  paintOrder,
  poseFor,
  stretched,
} from "./geometry";
import * as k from "./kit/iso-kit";
import { scene as sceneSchema, type Scene } from "./scene";

describe("the spring scale example", () => {
  it("is a valid scene", () => {
    expect(sceneSchema.safeParse(springScale).success).toBe(true);
  });

  it("draws every part, with no broken numbers", () => {
    const { svg } = figureSvg(springScale);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toMatch(/NaN|Infinity|undefined/);
    expect(svg).toContain('data-theme="light"');
    expect(svg).not.toContain("anatomy-hit");
  });
});

describe("poseFor", () => {
  it("leaves everything where it is drawn at rest", () => {
    for (const at of poseFor(springScale, 0, 0).values()) {
      expect(at).toEqual({ offset: [0, 0, 0], turn: 0, stretch: 0 });
    }
  });

  it("moves, turns and stretches parts in a step", () => {
    const pose = poseFor(springScale, 1, 0);
    expect(pose.get("spring")).toEqual({ offset: [0, 0, -8], turn: 0, stretch: 8 });
    expect(pose.get("needle")?.turn).toBe(90);
    expect(pose.get("base-plate")?.offset).toEqual([0, 0, 0]);
  });

  it("moves whole assemblies, and takes the figure apart", () => {
    const scene: Scene = {
      ...springScale,
      steps: [
        {
          ...springScale.steps[0],
          moves: [{ target: "frame", offset: { x: 5, y: 0, z: 0 }, turn: 0, stretch: 0 }],
        },
      ],
    };
    const pose = poseFor(scene, 0, 1);
    expect(pose.get("column")?.offset).toEqual([5 - 24, 0, 10]);
    expect(pose.get("arm")?.offset).toEqual([5 - 24, 0, 10]);
    expect(pose.get("base-plate")?.offset).toEqual([0, 0, 0]);
  });
});

describe("stretched", () => {
  it("makes springs longer and boxes taller", () => {
    const spring = springScale.parts.find((part) => part.id === "spring")!.geometry;
    expect(boundsOf(stretched(spring, 8)).max[2] - boundsOf(spring).max[2]).toBe(8);
    const column = springScale.parts.find((part) => part.id === "column")!.geometry;
    expect(boundsOf(stretched(column, -10)).max[2]).toBe(90);
  });
});

describe("fitFigure", () => {
  it("keeps every part inside the drawing in every pose", () => {
    const projection = fitFigure(springScale);
    for (const step of [0, 1]) {
      for (const explode of [0, 1]) {
        const pose = poseFor(springScale, step, explode);
        for (const part of springScale.parts) {
          const at = pose.get(part.id)!;
          for (const point of cornersOf(
            moveBounds(boundsOf(stretched(part.geometry, at.stretch), at.turn), at.offset),
          )) {
            const [x, y] = k.iso(point, projection);
            expect(x).toBeGreaterThanOrEqual(-0.5);
            expect(x).toBeLessThanOrEqual(FIGURE_WIDTH + 0.5);
            expect(y).toBeGreaterThanOrEqual(-0.5);
            expect(y).toBeLessThanOrEqual(FIGURE_HEIGHT + 0.5);
          }
        }
      }
    }
  });
});

describe("paintOrder", () => {
  const projection = k.fitProjection(
    [
      [0, 0, 0],
      [100, 100, 100],
    ],
    FIGURE_WIDTH,
    FIGURE_HEIGHT,
  );

  it("paints what stands on a part after the part", () => {
    const order = paintOrder(
      [
        { id: "top", bounds: { min: [10, 10, 10], max: [20, 20, 20] } },
        { id: "base", bounds: { min: [0, 0, 0], max: [40, 40, 10] } },
      ],
      projection,
    );
    expect(order).toEqual(["base", "top"]);
  });

  it("paints nearer parts later", () => {
    const order = paintOrder(
      [
        { id: "front", bounds: { min: [30, 30, 0], max: [40, 40, 30] } },
        { id: "back", bounds: { min: [0, 0, 0], max: [10, 10, 30] } },
        { id: "middle", bounds: { min: [15, 15, 0], max: [25, 25, 30] } },
      ],
      projection,
    );
    expect(order).toEqual(["back", "middle", "front"]);
  });

  it("orders the example with the base first", () => {
    const order = orderFor(springScale, poseFor(springScale, 0, 0), fitFigure(springScale));
    expect(order[0]).toBe("base-plate");
    expect(order.indexOf("weight")).toBeGreaterThan(order.indexOf("pan"));
    expect(order.indexOf("needle")).toBeGreaterThan(order.indexOf("dial"));
  });
});
