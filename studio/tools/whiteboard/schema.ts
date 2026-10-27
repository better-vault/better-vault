import { z } from "zod";

/**
 * A board, saved in the output's data. Elements follow Excalidraw's model:
 * a box (x, y, width, height) turned by `angle` around its centre, with line
 * and pen points relative to (x, y). Colours are palette names, never hex,
 * so a board follows the light and dark themes.
 */

export const boardColors = ["ink", "grey", "red", "green", "blue", "amber", "violet"] as const;
export type BoardColor = (typeof boardColors)[number];

export const fillStyles = ["hachure", "cross-hatch", "solid"] as const;
export const strokeStyles = ["solid", "dashed", "dotted"] as const;
export const strokeWidths = [1, 2, 4] as const;
export const roughnesses = [0, 1, 2] as const;
export const edgeKinds = ["sharp", "round"] as const;
export const arrowheads = ["arrow", "triangle", "bar", "dot"] as const;
export const fontKinds = ["hand", "normal", "code"] as const;
export const fontSizes = [16, 20, 28, 36] as const;
export const textAligns = ["start", "center", "end"] as const;
export const backgrounds = ["dots", "grid", "none"] as const;

export type FillStyle = (typeof fillStyles)[number];
export type StrokeStyle = (typeof strokeStyles)[number];
export type Arrowhead = (typeof arrowheads)[number];
export type FontKind = (typeof fontKinds)[number];
export type TextAlign = (typeof textAligns)[number];
export type Background = (typeof backgrounds)[number];

const base = {
  id: z.string(),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  /** Radians, around the box's centre. */
  angle: z.number().catch(0),
  stroke: z.enum(boardColors).catch("ink"),
  fill: z.enum([...boardColors, "none"]).catch("none"),
  fillStyle: z.enum(fillStyles).catch("hachure"),
  strokeWidth: z.number().catch(2),
  strokeStyle: z.enum(strokeStyles).catch("solid"),
  /** Sloppiness: 0 is clean, 2 is very sketchy. */
  roughness: z.number().int().min(0).max(2).catch(1),
  edges: z.enum(edgeKinds).catch("round"),
  opacity: z.number().min(0).max(100).catch(100),
  /** Keeps a sketchy shape the same each time it is drawn. */
  seed: z.number().int().catch(1),
  groupIds: z.array(z.string()).catch([]),
  locked: z.boolean().catch(false),
};

const point = z.tuple([z.number(), z.number()]);
const arrowhead = z.enum(arrowheads).nullable();

export const elementSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("rectangle"), ...base }),
  z.object({ type: z.literal("diamond"), ...base }),
  z.object({ type: z.literal("ellipse"), ...base }),
  z.object({
    type: z.literal("line"),
    ...base,
    points: z.array(point).min(2),
    start: arrowhead.catch(null),
    end: arrowhead.catch(null),
  }),
  z.object({
    type: z.literal("arrow"),
    ...base,
    points: z.array(point).min(2),
    start: arrowhead.catch(null),
    end: arrowhead.catch("arrow"),
  }),
  z.object({
    type: z.literal("freedraw"),
    ...base,
    /** x, y and pressure (0 to 1). */
    points: z.array(z.tuple([z.number(), z.number(), z.number()])).min(1),
    simulatePressure: z.boolean().catch(true),
  }),
  z.object({
    type: z.literal("text"),
    ...base,
    text: z.string(),
    font: z.enum(fontKinds).catch("hand"),
    fontSize: z.number().catch(20),
    align: z.enum(textAligns).catch("start"),
  }),
  z.object({ type: z.literal("image"), ...base, fileId: z.string() }),
]);

export type BoardElement = z.infer<typeof elementSchema>;
export type ElementType = BoardElement["type"];
export type ElementOf<T extends ElementType> = Extract<BoardElement, { type: T }>;
export type LinearElement = ElementOf<"line"> | ElementOf<"arrow">;

/** Only raster images in data URLs: no SVG, no links. */
const RASTER_DATA_URL = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/;

export const fileSchema = z.object({
  dataUrl: z.string().regex(RASTER_DATA_URL),
  mimeType: z.string(),
  width: z.number(),
  height: z.number(),
});
export type BoardFile = z.infer<typeof fileSchema>;

export const viewSchema = z.object({ x: z.number(), y: z.number(), zoom: z.number() });
export type BoardView = z.infer<typeof viewSchema>;

export const boardData = z.object({
  version: z.literal(1).catch(1),
  /** Elements that don't read as one are dropped; the rest are kept. */
  elements: z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items.flatMap((item) => {
        const parsed = elementSchema.safeParse(item);
        return parsed.success ? [parsed.data] : [];
      }),
    ),
  files: z.record(z.string(), fileSchema).catch({}),
  background: z.enum(backgrounds).catch("dots"),
  /** Where the board was looked at; null fits the content when it opens. */
  view: viewSchema.nullable().catch(null),
  /** The output a board was made from to annotate it. */
  origin: z.object({ outputId: z.string(), toolId: z.string() }).nullable().catch(null),
  /** Set on each save, so the viewer can tell its own saves from changes made elsewhere. */
  saveId: z.string().catch(""),
});

export type BoardData = z.infer<typeof boardData>;

export function emptyBoard(): BoardData {
  return {
    version: 1,
    elements: [],
    files: {},
    background: "dots",
    view: null,
    origin: null,
    saveId: "",
  };
}

/** The look new elements get, changed in the properties panel. */
export interface DrawStyle {
  stroke: BoardColor;
  fill: BoardColor | "none";
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  roughness: number;
  edges: (typeof edgeKinds)[number];
  opacity: number;
  font: FontKind;
  fontSize: number;
  align: TextAlign;
  start: Arrowhead | null;
  end: Arrowhead | null;
}

export const defaultStyle: DrawStyle = {
  stroke: "ink",
  fill: "none",
  fillStyle: "hachure",
  strokeWidth: 2,
  strokeStyle: "solid",
  roughness: 1,
  edges: "round",
  opacity: 100,
  font: "hand",
  fontSize: 20,
  align: "start",
  start: null,
  end: "arrow",
};
