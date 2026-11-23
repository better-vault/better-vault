import type { FaceItem, HeadItem, NeckItem } from "@/lib/bot/look";
import type { V3 } from "./geometry";

/**
 * What the character can wear, drawn in the character's line-art style:
 * outlines in the bot's colour (`--bot-line`), filled with the surface
 * behind it (`--bot-surface`) so they hide what is behind them, and hatching
 * (`HATCH`, replaced with the instance's pattern) for dark parts. Each item is
 * a few parts, each in a local frame on the head (see geometry.ts): on the
 * face, upright on the crown, or flat in a plane of the head. Drawings are SVG
 * in local units, for a head 30 units across its half-width, with y down.
 * Strokes keep their width on screen (mount.ts makes them non-scaling).
 */

export type FrameSpec =
  | { kind: "face"; x: number; y: number }
  | { kind: "upright"; point: V3 }
  | { kind: "plane"; point: V3; xAxis: V3; yAxis: V3 };

export interface Part {
  frame: FrameSpec;
  /** SVG markup in the frame's local units. Shapes inherit the outline style. */
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

/** The hatch fill, swapped for the character's own pattern when it is drawn. */
export const HATCH = "HATCH";
const open = `fill="none"`;

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
    brim(-0.05, `<ellipse rx="27" ry="27"/>`),
    upright(
      `<path d="M-17 1 C-12 -14 -6 -30 3 -46 C5 -40 4 -34 8 -26 C11 -17 14 -8 17 1 Z"/>` +
        `<path d="M-15.5 -4 C-5 -1 5 -1 15.5 -4 L17 1 C5 4 -5 4 -17 1 Z" fill="${HATCH}"/>` +
        `<path d="M-2 -22 l1.6 3.4 3.7.4 -2.8 2.5.8 3.7 -3.3-1.9 -3.3 1.9.8-3.7 -2.8-2.5 3.7-.4z"/>`,
      { lag: 0.7 },
    ),
  ],
  "top-hat": [
    brim(-0.05, `<ellipse rx="25" ry="25"/>`),
    upright(
      `<path d="M-15 1 V-30 C-15 -32 -13 -33 -11 -33 H11 C13 -33 15 -32 15 -30 V1 Z"/>` +
        `<rect x="-15" y="-9" width="30" height="5" fill="${HATCH}"/>`,
    ),
  ],
  beanie: [
    upright(
      `<path d="M-28 6 C-28 -22 28 -22 28 6 Z"/>` +
        `<path d="M-12 -13 V-1 M0 -16 V-1 M12 -13 V-1" ${open} stroke-dasharray="2 2"/>` +
        `<rect x="-29.5" y="-1" width="59" height="10" rx="5" fill="${HATCH}"/>` +
        `<circle cy="-22" r="6.5"/>`,
      { lift: -0.18, lag: 0.3 },
    ),
  ],
  beret: [
    upright(
      `<path d="M-27 3 C-31 -10 -4 -18 20 -11 C31 -8 33 -1 27 3 C10 7 -12 7 -27 3 Z"/>` +
        `<path d="M-24 4 C-10 7 10 7 25 3" ${open} stroke-dasharray="2 2"/>` +
        `<rect x="-1.5" y="-19" width="3" height="5" rx="1.5"/>`,
      { lift: -0.06, lag: 0.45 },
    ),
  ],
  crown: [
    upright(
      `<path d="M-17 2 L-19.5 -17 L-9 -7.5 L0 -21 L9 -7.5 L19.5 -17 L17 2 Z"/>` +
        `<rect x="-17" y="-3" width="34" height="5" fill="${HATCH}"/>` +
        `<circle cy="-9" r="2.4"/><circle cx="-19.5" cy="-18.5" r="1.6"/><circle cx="19.5" cy="-18.5" r="1.6"/><circle cy="-22.5" r="1.6"/>`,
      { lag: 0.35 },
    ),
  ],
  "chef-hat": [
    upright(
      `<path d="M-16 -12 C-24 -12 -24 -27 -14 -27 C-13 -36 -3 -40 3 -35 C10 -40 19 -33 15 -26 C24 -25 23 -12 16 -12 Z"/>` +
        `<rect x="-16" y="-13" width="32" height="15" rx="2"/>` +
        `<path d="M-6 -13 V2 M6 -13 V2" ${open} stroke-dasharray="2 2"/>`,
      { lag: 0.55 },
    ),
  ],
  "graduation-cap": [
    upright(`<path d="M-18 5 C-18 -8 18 -8 18 5 Z"/>`, { lift: -0.04, lag: 0.3 }),
    brim(0.17, `<path d="M0 -25 L25 0 L0 25 L-25 0 Z" fill="${HATCH}"/><circle r="2"/>`, 0.5),
    upright(
      `<path d="M0 0 Q14 -1 17 6 V16" ${open}/><rect x="15" y="15" width="4" height="7" rx="1"/>`,
      { lift: 0.17, lag: 0.8 },
    ),
  ],
  headphones: [
    {
      // The band, in the head's own plane, so it follows its turn.
      frame: { kind: "plane", point: [0, 0, 0], xAxis: X, yAxis: DOWN },
      svg:
        `<path d="M-32 0 C-33 -47 33 -47 32 0" ${open}/>` +
        `<path d="M-28 0 C-29 -42 29 -42 28 0" ${open}/>`,
      layer: "back",
      lag: 0.2,
    },
    ...([-1, 1] as const).map((side): Part => ({
      frame: { kind: "plane", point: [side * 1.04, -0.02, 0], xAxis: Z, yAxis: DOWN },
      svg:
        `<rect x="-9" y="-12" width="18" height="24" rx="8"/>` +
        `<rect x="-5.5" y="-8.5" width="11" height="17" rx="5" fill="${HATCH}"/>`,
      layer: "auto",
      lag: 0.2,
    })),
  ],
  antenna: [
    upright(
      `<path d="M0 2 C0 -6 1 -12 0 -16.5" ${open}/><circle cy="-21.5" r="5" fill="${HATCH}"/>`,
      { lag: 1 },
    ),
  ],
  "cowboy-hat": [
    brim(-0.04, `<ellipse rx="34" ry="30"/>`, 0.45),
    upright(
      `<path d="M-15 1 C-16 -12 -15 -22 -10 -25 C-5 -27 -2 -21 0 -21 C2 -21 5 -27 10 -25 C15 -22 16 -12 15 1 Z"/>` +
        `<path d="M-15 -6 C-5 -3 5 -3 15 -6 L15 -1 C5 2 -5 2 -15 -1 Z" fill="${HATCH}"/>`,
      { lag: 0.5 },
    ),
  ],
  "party-hat": [
    upright(
      `<path d="M-14 2 L0 -36 L14 2 Z"/>` +
        `<path d="M-10.5 -8 L8 -1 M-6.5 -19 L5 -14 M-3 -28 L2.5 -26" ${open}/>` +
        `<circle cy="-38" r="4.5" fill="${HATCH}"/>`,
      { lag: 0.75 },
    ),
  ],
  halo: [
    upright(
      `<ellipse cy="-14" rx="19" ry="5.5" ${open} stroke-width="2.6"/>` +
        `<ellipse cy="-14" rx="14" ry="3" ${open} stroke-dasharray="2 3"/>`,
      { lift: 0.05, lag: 0.85 },
    ),
  ],
  "viking-helmet": [
    upright(
      `<path d="M-27 4 C-27 -24 27 -24 27 4 Z"/>` +
        `<rect x="-28.5" y="-1" width="57" height="7" rx="3" fill="${HATCH}"/>` +
        `<path d="M-2 -18 V-1 M2 -18 V-1" ${open}/>` +
        `<path d="M-25 -6 C-36 -8 -40 -20 -36 -32 C-33 -24 -28 -19 -20 -16 Z"/>` +
        `<path d="M25 -6 C36 -8 40 -20 36 -32 C33 -24 28 -19 20 -16 Z"/>`,
      { lift: -0.16, lag: 0.3 },
    ),
  ],
  "flower-crown": [
    upright(
      `<path d="M-26 1 C-14 -4 14 -4 26 1" ${open}/>` +
        [-21, -10.5, 0, 10.5, 21]
          .map(
            (x, at) =>
              `<g transform="translate(${x} ${at % 2 ? -3.5 : -2})">` +
              `<circle cx="0" cy="-4" r="3.2"/><circle cx="3.8" cy="-1.2" r="3.2"/><circle cx="2.4" cy="3.2" r="3.2"/>` +
              `<circle cx="-2.4" cy="3.2" r="3.2"/><circle cx="-3.8" cy="-1.2" r="3.2"/><circle r="1.8" fill="${HATCH}"/></g>`,
          )
          .join(""),
      { lift: -0.1, lag: 0.35 },
    ),
  ],
  bandana: [
    upright(
      `<path d="M-28 5 C-29 -20 29 -20 28 5 C14 0 -14 0 -28 5 Z" fill="${HATCH}"/>` +
        `<circle cx="-12" cy="-8" r="1.6"/><circle cx="2" cy="-12" r="1.6"/><circle cx="14" cy="-6" r="1.6"/>` +
        `<path d="M26 2 C32 4 36 10 34 16 L29 9 Z M26 2 C33 1 38 4 40 9 L32 7 Z"/>`,
      { lift: -0.2, lag: 0.3 },
    ),
  ],
};

const lens = (cx: number, shape: "round" | "square") =>
  shape === "round"
    ? `<circle cx="${cx}" r="10" ${open}/>`
    : `<rect x="${cx - 9}" y="-10" width="18" height="20" rx="3.5" ${open}/>`;

/** A five-pointed lens, centred at `cx`. */
const star = (cx: number) => {
  const points = Array.from({ length: 10 }, (_, at) => {
    const angle = (Math.PI / 5) * at - Math.PI / 2;
    const r = at % 2 ? 5 : 11.5;
    return `${(cx + Math.cos(angle) * r).toFixed(2)} ${(Math.sin(angle) * r).toFixed(2)}`;
  });
  return `<path d="M${points.join(" L")} Z" ${open}/>`;
};

/** A heart-shaped lens, centred at `cx`. */
const heart = (cx: number) =>
  `<path transform="translate(${cx} 0)" d="M0 9 C-6 4 -11 0 -11 -4.5 C-11 -9 -5.5 -11 0 -5.5 C5.5 -11 11 -9 11 -4.5 C11 0 6 4 0 9 Z" ${open}/>`;

export const faceParts: Record<FaceItem, Part[]> = {
  none: [],
  "round-glasses": [
    onFace(
      0,
      -0.04,
      `${lens(-9.5, "round")}${lens(9.5, "round")}<path d="M-0.5 -2 Q0 -3 0.5 -2" ${open}/>`,
    ),
  ],
  "square-glasses": [
    onFace(
      0,
      -0.04,
      `${lens(-9.5, "square")}${lens(9.5, "square")}<path d="M-0.5 -3 H0.5" ${open}/>`,
    ),
  ],
  sunglasses: [
    onFace(
      0,
      -0.04,
      `<path d="M-1 -9.5 H-19 Q-20.5 6 -13.5 10 Q-4 11.5 -1.5 3 Z" fill="${HATCH}"/>` +
        `<path d="M1 -9.5 H19 Q20.5 6 13.5 10 Q4 11.5 1.5 3 Z" fill="${HATCH}"/>` +
        `<path d="M-1 -8.5 H1" ${open}/>`,
    ),
  ],
  monocle: [
    onFace(
      0.29,
      -0.03,
      `<circle r="10.5" ${open}/><path d="M6.5 8.5 C7.5 16 3 20 -2 26" ${open}/>`,
    ),
  ],
  mustache: [
    onFace(
      0,
      -0.5,
      `<path d="M0 -1 C-3.5 -4.5 -10 -4.5 -14 -0.5 C-16 1.5 -18 1 -19.5 -1.5 C-18 5 -8.5 6.5 0 2 C8.5 6.5 18 5 19.5 -1.5 C18 1 16 1.5 14 -0.5 C10 -4.5 3.5 -4.5 0 -1 Z" fill="${HATCH}"/>`,
    ),
  ],
  blush: ([-1, 1] as const).map((side) =>
    onFace(side * 0.56, -0.32, `<path d="M-4 2 L-2 -2 M-0.5 2 L1.5 -2 M3 2 L5 -2" ${open}/>`),
  ),
  "star-glasses": [onFace(0, -0.04, `${star(-10)}${star(10)}<path d="M-1.5 -2 H1.5" ${open}/>`)],
  "heart-glasses": [onFace(0, -0.04, `${heart(-10)}${heart(10)}<path d="M-1.5 -3 H1.5" ${open}/>`)],
  goggles: [
    onFace(
      0,
      -0.02,
      `<path d="M-30 -2 H-21 M21 -2 H30" ${open} stroke-width="3"/>` +
        `<circle cx="-10.5" cy="-1" r="11" fill="${HATCH}"/><circle cx="10.5" cy="-1" r="11" fill="${HATCH}"/>` +
        `<circle cx="-10.5" cy="-1" r="7.5"/><circle cx="10.5" cy="-1" r="7.5"/>` +
        `<path d="M-14 -4.5 Q-12 -6.5 -9.5 -6 M7 -4.5 Q9 -6.5 11.5 -6" ${open}/>`,
    ),
  ],
  eyepatch: [
    onFace(
      0,
      0,
      `<path d="M-30 -14 L30 8" ${open}/>` +
        `<path d="M-19 -9 C-19 -1 -15 6 -9.5 6 C-4 6 -1 -1 -1.5 -8 C-7 -11 -13 -11 -19 -9 Z" fill="${HATCH}"/>`,
    ),
  ],
  freckles: ([-1, 1] as const).map((side) =>
    onFace(
      side * 0.55,
      -0.3,
      `<circle cx="-4" cy="-1" r="1.3" fill="${HATCH}"/><circle cx="0" cy="2" r="1.3" fill="${HATCH}"/><circle cx="4" cy="-1" r="1.3" fill="${HATCH}"/><circle cx="0.5" cy="-3.5" r="1.3" fill="${HATCH}"/>`,
    ),
  ),
};

export const neckParts: Record<NeckItem, Part[]> = {
  none: [],
  "bow-tie": [
    onFace(
      0,
      -0.78,
      `<path d="M0 0 L-12 -6.5 Q-14.5 0 -12 6.5 Z M0 0 L12 -6.5 Q14.5 0 12 6.5 Z"/>` +
        `<rect x="-3" y="-3.2" width="6" height="6.4" rx="2" fill="${HATCH}"/>`,
    ),
  ],
  tie: [
    onFace(
      0,
      -0.8,
      `<path d="M-4 -2 H4 L3 3 H-3 Z" fill="${HATCH}"/><path d="M-3 3 H3 L5.5 14 L0 19 L-5.5 14 Z"/>` +
        `<path d="M-4.5 9 L4.5 7 M-5 13.5 L5 11.5" ${open}/>`,
    ),
  ],
  scarf: [
    {
      frame: { kind: "plane", point: [0, -0.9, 0], xAxis: X, yAxis: Z },
      svg: `<path d="M-31 0 A31 27 0 0 1 31 0" ${open}/><path d="M-25 0 A25 21 0 0 1 25 0" ${open}/>`,
      layer: "back",
      lag: 0.15,
    },
    {
      frame: { kind: "plane", point: [0, -0.9, 0], xAxis: X, yAxis: Z },
      svg: `<path d="M31 0 A31 27 0 0 1 -31 0 L-25 0 A25 21 0 0 0 25 0 Z" fill="${HATCH}"/>`,
      layer: "front",
      lag: 0.15,
    },
    {
      frame: { kind: "face", x: 0.42, y: -0.92 },
      svg: `<path d="M-4 0 H5 L7 17 H-2 Z"/><path d="M-2 17 H7 M-1 14 H6.5" ${open}/>`,
      layer: "front",
      facing: true,
      lag: 0.6,
    },
  ],
  necklace: [
    onFace(
      0,
      -0.82,
      `<path d="M-15 -4 Q0 8 15 -4" ${open}/>` +
        [-12, -8, -4, 0, 4, 8, 12]
          .map(
            (x) =>
              `<circle cx="${x}" cy="${(-4 + 12 * (1 - (x / 15) ** 2) * 0.5).toFixed(2)}" r="1.6"/>`,
          )
          .join("") +
        `<path d="M0 4 L3.5 8.5 L0 13 L-3.5 8.5 Z" fill="${HATCH}"/>`,
    ),
  ],
  medal: [
    onFace(
      0,
      -0.8,
      `<path d="M-8 -4 L-2 7 H2 L8 -4 H3 L0 2 L-3 -4 Z" fill="${HATCH}"/>` +
        `<circle cy="13" r="6.5"/><path d="M0 9.5 l1 2.2 2.4.2 -1.8 1.6.6 2.4 -2.2-1.3 -2.2 1.3.6-2.4 -1.8-1.6 2.4-.2z"/>`,
    ),
  ],
  lanyard: [
    onFace(
      0,
      -0.8,
      `<path d="M-14 -5 L-3 8 M14 -5 L3 8" ${open} stroke-width="2.4"/>` +
        `<rect x="-7" y="7" width="14" height="18" rx="2"/>` +
        `<rect x="-4" y="10.5" width="8" height="6" rx="1" fill="${HATCH}"/><path d="M-4 20 H4 M-4 22.5 H2" ${open}/>`,
    ),
  ],
  collar: [
    onFace(
      0,
      -0.78,
      `<path d="M-1 -3 L-13 -5 L-9 7 Z"/><path d="M1 -3 L13 -5 L9 7 Z"/>` +
        `<circle cy="3" r="1.4" fill="${HATCH}"/><circle cy="9" r="1.4" fill="${HATCH}"/>`,
    ),
  ],
  neckerchief: [
    onFace(
      0,
      -0.8,
      `<path d="M-15 -4 C-5 -1 5 -1 15 -4 L0 15 Z" fill="${HATCH}"/>` +
        `<rect x="-3.5" y="-3" width="7" height="5" rx="2"/>`,
    ),
  ],
};
