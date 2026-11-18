import type { FaceItem, HeadItem, NeckItem } from "@/lib/bot/look";
import type { V3 } from "./geometry";

/**
 * What the character can wear. Each item is a few parts, each drawn in a
 * local frame on the head (see geometry.ts): on the face, upright on the
 * crown, or flat in a plane of the head. Drawings are SVG in local units, made
 * for a head 30 units across its half-width, with y down. Colours are theme
 * tokens only: `--bot-ink` (dark), `--bot-paper` (light) and the chart colours.
 */

export type FrameSpec =
  | { kind: "face"; x: number; y: number }
  | { kind: "upright"; point: V3 }
  | { kind: "plane"; point: V3; xAxis: V3; yAxis: V3 };

export interface Part {
  frame: FrameSpec;
  /** SVG markup in the frame's local units. */
  svg: string;
  /**
   * Behind or in front of the head; "auto" sorts by depth, so a part on the
   * far side goes behind as the head turns.
   */
  layer: "back" | "front" | "auto";
  /** Hidden when its frame turns away (things worn on the face). */
  facing?: boolean;
  /** How much it trails the head's turns, 0 (none) to 1 (a lot). */
  lag?: number;
}

const ink = "var(--bot-ink)";
const paper = "var(--bot-paper)";
const red = "var(--destructive)";
const gold = "var(--chart-4)";
const blue = "var(--chart-2)";
const violet = "var(--chart-5)";
const green = "var(--chart-3)";

const X: V3 = [1, 0, 0];
const Z: V3 = [0, 0, 1];
const DOWN: V3 = [0, -1, 0];
const above = (lift: number): V3 => [0, 1 + lift, 0];

/** A disc lying on the crown (a brim, a cap's board), seen at an angle as the head tips. */
const brim = (lift: number, svg: string, lag = 0.4): Part => ({
  frame: { kind: "plane", point: above(lift), xAxis: X, yAxis: Z },
  svg,
  layer: "front",
  lag,
});

const upright = (svg: string, { lift = -0.05, lag = 0.5 } = {}): Part => ({
  frame: { kind: "upright", point: above(lift) },
  svg,
  layer: "front",
  lag,
});

const onFace = (x: number, y: number, svg: string): Part => ({
  frame: { kind: "face", x, y },
  svg,
  layer: "front",
  facing: true,
});

export const headParts: Record<HeadItem, Part[]> = {
  none: [],
  "wizard-hat": [
    brim(
      -0.05,
      `<ellipse rx="27" ry="27" fill="${violet}"/><ellipse rx="27" ry="27" fill="${ink}" opacity=".12"/>`,
    ),
    upright(
      `<path d="M-17 1 C-12 -14 -6 -30 3 -46 C5 -40 4 -34 8 -26 C11 -17 14 -8 17 1 Z" fill="${violet}"/>` +
        `<path d="M-15.5 -4 C-5 -1 5 -1 15.5 -4 L17 1 C5 4 -5 4 -17 1 Z" fill="${ink}" opacity=".28"/>` +
        `<path d="M-2 -22 l1.6 3.4 3.7.4 -2.8 2.5.8 3.7 -3.3-1.9 -3.3 1.9.8-3.7 -2.8-2.5 3.7-.4z" fill="${gold}"/>`,
      { lag: 0.7 },
    ),
  ],
  "top-hat": [
    brim(-0.05, `<ellipse rx="25" ry="25" fill="${ink}"/>`),
    upright(
      `<path d="M-15 1 V-30 C-15 -32 -13 -33 -11 -33 H11 C13 -33 15 -32 15 -30 V1 Z" fill="${ink}"/>` +
        `<rect x="-15" y="-9" width="30" height="5" fill="${red}"/>` +
        `<path d="M-11 -30 H-6 V-4 H-11 Z" fill="${paper}" opacity=".12"/>`,
    ),
  ],
  beanie: [
    upright(
      `<path d="M-28 6 C-28 -22 28 -22 28 6 Z" fill="${blue}"/>` +
        `<path d="M-14 -11 C-12 -14 -8 -16 -4 -17" stroke="${paper}" stroke-width="2" fill="none" opacity=".35" stroke-linecap="round"/>` +
        `<rect x="-29.5" y="-1" width="59" height="10" rx="5" fill="${blue}"/>` +
        `<rect x="-29.5" y="-1" width="59" height="10" rx="5" fill="${ink}" opacity=".18"/>` +
        `<circle cy="-22" r="6.5" fill="${paper}"/>`,
      { lift: -0.18, lag: 0.3 },
    ),
  ],
  beret: [
    upright(
      `<path d="M-27 3 C-31 -10 -4 -18 20 -11 C31 -8 33 -1 27 3 C10 7 -12 7 -27 3 Z" fill="${red}"/>` +
        `<path d="M-27 3 C-12 7 10 7 27 3 C25 6 10 9 -24 7 Z" fill="${ink}" opacity=".25"/>` +
        `<rect x="-1.5" y="-19" width="3" height="5" rx="1.5" fill="${red}"/>`,
      { lift: -0.06, lag: 0.45 },
    ),
  ],
  crown: [
    upright(
      `<path d="M-17 2 L-19.5 -17 L-9 -7.5 L0 -21 L9 -7.5 L19.5 -17 L17 2 Z" fill="${gold}" stroke="${ink}" stroke-opacity=".2" stroke-width="1"/>` +
        `<rect x="-17" y="-3" width="34" height="5" fill="${ink}" opacity=".15"/>` +
        `<circle cx="0" cy="-8" r="2.4" fill="${red}"/><circle cx="-9" cy="-3" r="1.6" fill="${blue}"/><circle cx="9" cy="-3" r="1.6" fill="${blue}"/>`,
      { lag: 0.35 },
    ),
  ],
  "chef-hat": [
    upright(
      `<circle cx="-11" cy="-19" r="10" fill="${paper}"/><circle cx="11" cy="-19" r="10" fill="${paper}"/><circle cy="-26" r="12" fill="${paper}"/>` +
        `<rect x="-16" y="-14" width="32" height="16" rx="2" fill="${paper}"/>` +
        `<path d="M-16 -1 H16 V2 H-16 Z" fill="${ink}" opacity=".12"/>` +
        `<path d="M-6 -14 V-2 M6 -14 V-2" stroke="${ink}" stroke-opacity=".1" stroke-width="1.2"/>`,
      { lag: 0.55 },
    ),
  ],
  "graduation-cap": [
    upright(`<path d="M-18 5 C-18 -8 18 -8 18 5 Z" fill="${ink}"/>`, { lift: -0.04, lag: 0.3 }),
    brim(
      0.17,
      `<path d="M0 -25 L25 0 L0 25 L-25 0 Z" fill="${ink}"/><path d="M0 -25 L25 0 L0 25 L-25 0 Z" fill="${paper}" opacity=".08"/><circle r="2" fill="${gold}"/>`,
      0.5,
    ),
    upright(
      `<path d="M0 0 Q14 -1 17 6 V16" stroke="${gold}" stroke-width="1.6" fill="none"/><rect x="15" y="15" width="4" height="7" rx="1" fill="${gold}"/>`,
      { lift: 0.17, lag: 0.8 },
    ),
  ],
  headphones: [
    {
      // The band, in the head's own plane, so it follows its turn.
      frame: { kind: "plane", point: [0, 0, 0], xAxis: X, yAxis: DOWN },
      svg: `<path d="M-32 0 C-33 -47 33 -47 32 0" stroke="${ink}" stroke-width="4.5" fill="none" stroke-linecap="round"/>`,
      layer: "back",
      lag: 0.2,
    },
    ...([-1, 1] as const).map((side): Part => ({
      frame: { kind: "plane", point: [side * 1.04, -0.02, 0], xAxis: Z, yAxis: DOWN },
      svg:
        `<rect x="-9" y="-12" width="18" height="24" rx="8" fill="${ink}"/>` +
        `<rect x="-6" y="-9" width="12" height="18" rx="5.5" fill="${green}"/>`,
      layer: "auto",
      lag: 0.2,
    })),
  ],
  antenna: [
    upright(
      `<path d="M0 2 C0 -6 1 -12 0 -18" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
        `<circle cy="-21.5" r="5" fill="${gold}"/><circle cx="-1.6" cy="-23" r="1.6" fill="${paper}" opacity=".6"/>`,
      { lag: 1 },
    ),
  ],
};

const lens = (cx: number, shape: "round" | "square") =>
  shape === "round"
    ? `<circle cx="${cx}" r="7.6" fill="${paper}" fill-opacity=".14" stroke="${ink}" stroke-width="2"/>`
    : `<rect x="${cx - 7.5}" y="-6.5" width="15" height="13" rx="2.6" fill="${paper}" fill-opacity=".14" stroke="${ink}" stroke-width="2"/>`;

export const faceParts: Record<FaceItem, Part[]> = {
  none: [],
  "round-glasses": [
    onFace(
      0,
      -0.04,
      `${lens(-9, "round")}${lens(9, "round")}<path d="M-2 -1.5 Q0 -3.6 2 -1.5" stroke="${ink}" stroke-width="2" fill="none"/>`,
    ),
  ],
  "square-glasses": [
    onFace(
      0,
      -0.04,
      `${lens(-9, "square")}${lens(9, "square")}<path d="M-1.5 -2 H1.5" stroke="${ink}" stroke-width="2"/>`,
    ),
  ],
  sunglasses: [
    onFace(
      0,
      -0.04,
      `<path d="M-1.5 -5.5 H-16 Q-17 3 -12 6.5 Q-4.5 8 -2.5 2 Z" fill="${ink}"/>` +
        `<path d="M1.5 -5.5 H16 Q17 3 12 6.5 Q4.5 8 2.5 2 Z" fill="${ink}"/>` +
        `<path d="M-2.5 -4.5 H2.5" stroke="${ink}" stroke-width="2"/>` +
        `<path d="M-13 -2.5 L-9 -2.5 M11 -2.5 L13 -2.5" stroke="${paper}" stroke-width="1.4" opacity=".45" stroke-linecap="round"/>`,
    ),
  ],
  monocle: [
    onFace(
      0.3,
      -0.04,
      `<circle r="8.2" fill="${paper}" fill-opacity=".14" stroke="${gold}" stroke-width="2"/>` +
        `<path d="M5 6.5 C6 14 2 18 -3 24" stroke="${gold}" stroke-width="1" fill="none"/>`,
    ),
  ],
  mustache: [
    onFace(
      0,
      -0.42,
      `<path d="M0 -1 C-3.5 -4.5 -10 -4.5 -14 -0.5 C-16 1.5 -18 1 -19.5 -1.5 C-18 5 -8.5 6.5 0 2 C8.5 6.5 18 5 19.5 -1.5 C18 1 16 1.5 14 -0.5 C10 -4.5 3.5 -4.5 0 -1 Z" fill="${ink}"/>`,
    ),
  ],
  blush: ([-1, 1] as const).map((side) =>
    onFace(side * 0.5, -0.3, `<ellipse rx="4.6" ry="2.6" fill="${red}" opacity=".35"/>`),
  ),
};

export const neckParts: Record<NeckItem, Part[]> = {
  none: [],
  "bow-tie": [
    onFace(
      0,
      -0.78,
      `<path d="M0 0 L-12 -6.5 Q-14.5 0 -12 6.5 Z M0 0 L12 -6.5 Q14.5 0 12 6.5 Z" fill="${red}"/>` +
        `<path d="M0 0 L-12 6.5 Q-14.5 0 -12 -6.5 Z" fill="${ink}" opacity=".12"/>` +
        `<rect x="-3" y="-3.2" width="6" height="6.4" rx="2" fill="${red}"/><rect x="-3" y="-3.2" width="6" height="6.4" rx="2" fill="${ink}" opacity=".2"/>`,
    ),
  ],
  tie: [
    onFace(
      0,
      -0.8,
      `<path d="M-4 -2 H4 L3 3 H-3 Z" fill="${blue}"/><path d="M-3 3 H3 L5.5 14 L0 19 L-5.5 14 Z" fill="${blue}"/>` +
        `<path d="M-3 3 H3 L5.5 14 L0 19 Z" fill="${ink}" opacity=".15"/>` +
        `<path d="M-4.5 9 L4.5 7 M-5 13.5 L5 11.5" stroke="${paper}" stroke-opacity=".35" stroke-width="1.4"/>`,
    ),
  ],
  scarf: [
    {
      frame: { kind: "plane", point: [0, -0.9, 0], xAxis: X, yAxis: Z },
      svg: `<path d="M-31 0 A31 27 0 0 1 31 0" stroke="${green}" stroke-width="8" fill="none"/>`,
      layer: "back",
      lag: 0.15,
    },
    {
      frame: { kind: "plane", point: [0, -0.9, 0], xAxis: X, yAxis: Z },
      svg:
        `<path d="M31 0 A31 27 0 0 1 -31 0" stroke="${green}" stroke-width="8" fill="none"/>` +
        `<path d="M31 0 A31 27 0 0 1 -31 0" stroke="${ink}" stroke-opacity=".12" stroke-width="2" stroke-dasharray="3 4" fill="none"/>`,
      layer: "front",
      lag: 0.15,
    },
    {
      frame: { kind: "face", x: 0.42, y: -0.92 },
      svg: `<path d="M-4 0 H5 L7 17 H-2 Z" fill="${green}"/><path d="M-2 17 H7 M-1 14 H6.5" stroke="${ink}" stroke-opacity=".18" stroke-width="1.2"/>`,
      layer: "front",
      facing: true,
      lag: 0.6,
    },
  ],
};
