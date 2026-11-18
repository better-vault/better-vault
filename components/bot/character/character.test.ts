import { describe, expect, it } from "vitest";
import { botLook } from "@/lib/bot/look";
import {
  apply,
  convexHull,
  faceFrame,
  frontPoint,
  rotation,
  silhouette,
  surfaceSamples,
  type V2,
} from "./geometry";
import { blinking, pose, stepSpring } from "./pose";

const projection = { cx: 50, cy: 50, scale: 30 };

describe("character geometry", () => {
  it("draws a closed, convex outline that stays within the head", () => {
    const samples = surfaceSamples(16, 32);
    const m = rotation({ yaw: -0.24, pitch: 0.16, roll: 0 });
    const projected = samples.map((p): V2 => {
      const q = apply(m, p);
      return [50 + q[0] * 30, 50 - q[1] * 30];
    });
    const hull = convexHull(projected);
    expect(hull.length).toBeGreaterThan(8);
    // Convex: every turn has the same sign.
    const turns = hull.map((p, i) => {
      const a = hull[(i + 1) % hull.length];
      const b = hull[(i + 2) % hull.length];
      return Math.sign((a[0] - p[0]) * (b[1] - p[1]) - (a[1] - p[1]) * (b[0] - p[0]));
    });
    expect(new Set(turns.filter(Boolean)).size).toBe(1);
    for (const [x, y] of hull) {
      expect(Math.hypot(x - 50, y - 50)).toBeLessThan(30 * 1.75);
    }
    const d = silhouette(m, samples, projection);
    expect(d.startsWith("M")).toBe(true);
    expect(d.endsWith("Z")).toBe(true);
  });

  it("puts features on the front and turns them away with the head", () => {
    const { point } = frontPoint(0, 0);
    expect(point[2]).toBeGreaterThan(0.8);
    const ahead = faceFrame(rotation({ yaw: 0, pitch: 0, roll: 0 }), 0.3, 0, projection);
    expect(ahead.facing).toBeCloseTo(1, 1);
    expect(ahead.matrix[4]).toBeCloseTo(59, 0);
    const away = faceFrame(rotation({ yaw: Math.PI, pitch: 0, roll: 0 }), 0.3, 0, projection);
    expect(away.facing).toBeLessThan(0);
    // Turning right moves the face right; tipping down shows the top.
    const right = faceFrame(rotation({ yaw: 0.4, pitch: 0, roll: 0 }), 0, 0, projection);
    expect(right.matrix[4]).toBeGreaterThan(50);
    const top = apply(rotation({ yaw: 0, pitch: 0.3, roll: 0 }), [0, 1, 0]);
    expect(top[2]).toBeGreaterThan(0);
  });
});

describe("character pose", () => {
  it("is the same for the same input, and differs between characters", () => {
    const a = pose({ time: 3.2, mood: "idle", seed: 1 });
    expect(pose({ time: 3.2, mood: "idle", seed: 1 })).toEqual(a);
    expect(pose({ time: 3.2, mood: "idle", seed: 2 })).not.toEqual(a);
  });

  it("blinks now and then, and moods change the face", () => {
    const blinks = Array.from({ length: 2000 }, (_, i) => blinking(i / 100, 7)).filter(
      (v) => v > 0.5,
    );
    expect(blinks.length).toBeGreaterThan(5);
    expect(pose({ time: 1, mood: "happy", seed: 1 }).happy).toBe(1);
    expect(pose({ time: 1, mood: "thinking", seed: 1 }).gazeY).toBeLessThan(0);
    const still = pose({ time: 5, mood: "idle", seed: 1, reducedMotion: true });
    expect([still.blink, still.lift]).toEqual([0, 0]);
  });

  it("looks where it is told, and springs settle", () => {
    const right = pose({
      time: 0,
      mood: "idle",
      seed: 1,
      look: { x: 1, y: 0 },
      reducedMotion: true,
    });
    expect(right.yaw).toBeGreaterThan(0.2);
    expect(right.gazeX).toBeGreaterThan(0.5);
    const spring = { value: 0, velocity: 0 };
    for (let i = 0; i < 120; i++) stepSpring(spring, 1, 1 / 60, 70);
    expect(spring.value).toBeCloseTo(1, 2);
  });
});

describe("bot looks", () => {
  it("reads old shapes as looks and drops unknown items", () => {
    expect(botLook({ color: "chart-2", shape: "raven" })).toEqual({
      color: "chart-2",
      head: "top-hat",
      face: "monocle",
      neck: "none",
    });
    expect(botLook({ color: "chart-3", head: "dragon", face: "mustache" })).toEqual({
      color: "chart-3",
      head: "none",
      face: "mustache",
      neck: "none",
    });
  });
});
