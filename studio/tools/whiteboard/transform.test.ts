import { describe, expect, it } from "vitest";
import { rect, text } from "./fixtures";
import { cornersOf, rotate } from "./geometry";
import { resizeElement, resizeElements, rotateElements } from "./transform";

const options = { keepAspect: false, fromCenter: false };

describe("resizeElement", () => {
  it("moves one edge and keeps the opposite one", () => {
    const resized = resizeElement(rect("a", 0, 0, 100, 50), "e", [150, 25], options);
    expect(resized).toMatchObject({ x: 0, y: 0, width: 150, height: 50 });
  });

  it("keeps the opposite corner of a turned element fixed in the world", () => {
    const original = rect("a", 0, 0, 100, 50, { angle: Math.PI / 6 });
    const anchor = cornersOf(original)[0];
    const target = rotate([160, 90], [50, 25], Math.PI / 6);
    const resized = resizeElement(original, "se", target, options);
    const [ax, ay] = cornersOf(resized)[0];
    expect(ax).toBeCloseTo(anchor[0]);
    expect(ay).toBeCloseTo(anchor[1]);
    expect(resized.width).toBeCloseTo(160);
    expect(resized.height).toBeCloseTo(90);
  });

  it("keeps proportions with Shift, and grows from the centre with Alt", () => {
    expect(
      resizeElement(rect("a", 0, 0, 100, 50), "se", [200, 60], {
        keepAspect: true,
        fromCenter: false,
      }),
    ).toMatchObject({ width: 200, height: 100 });
    expect(
      resizeElement(rect("a", 0, 0, 100, 50), "e", [120, 25], {
        keepAspect: false,
        fromCenter: true,
      }),
    ).toMatchObject({ x: -20, width: 140 });
  });

  it("never turns a box inside out", () => {
    expect(resizeElement(rect("a", 0, 0, 100, 50), "e", [-50, 25], options).width).toBe(1);
  });

  it("scales text with its box", () => {
    const resized = resizeElement(text("t", 0, 0, "Hi"), "se", [200, 50], options);
    expect(resized.type === "text" && resized.fontSize).toBe(40);
  });
});

describe("resizeElements", () => {
  it("scales several elements in their shared box", () => {
    const [a, b] = resizeElements(
      [rect("a", 0, 0, 50, 50), rect("b", 50, 50, 50, 50)],
      "se",
      [200, 200],
      options,
    );
    expect(a).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
    expect(b).toMatchObject({ x: 100, y: 100, width: 100, height: 100 });
  });

  it("keeps proportions when a turned element is in the selection", () => {
    const [a] = resizeElements(
      [rect("a", 0, 0, 100, 100, { angle: 0.3 }), rect("b", 100, 100, 100, 100)],
      "e",
      [400, 100],
      options,
    );
    expect(a.width).toBeCloseTo(a.height);
  });
});

describe("rotateElements", () => {
  it("turns around the centre, and snaps to 15 degrees with Shift", () => {
    const [turned] = rotateElements(
      [rect("a", 0, 0, 100, 100)],
      [50, 50],
      [50, -50],
      [150, 50],
      false,
    );
    expect(turned.angle).toBeCloseTo(Math.PI / 2);
    const [snapped] = rotateElements(
      [rect("a", 0, 0, 100, 100)],
      [50, 50],
      [50, -50],
      [60, -50],
      true,
    );
    expect(((snapped.angle * 180) / Math.PI) % 15).toBeCloseTo(0);
  });
});
