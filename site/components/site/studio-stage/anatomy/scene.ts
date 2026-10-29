import { z } from "zod";

/**
 * An Anatomy figure, as the model writes it: a real object built from parts,
 * drawn in isometric with Anatomy's kit. World units are about 1 px of the
 * object at figure size; x and y lie on the floor and z points up.
 */

export const point = z.object({ x: z.number(), y: z.number(), z: z.number() });
export type Point = z.infer<typeof point>;

export const partRoles = ["base", "structure", "mechanism", "control", "subject"] as const;
export type PartRole = (typeof partRoles)[number];

/** Small details the renderer draws on a part, so the model only picks them. */
export const partDetails = [
  "groove",
  "screws",
  "ruler",
  "knurl",
  "label",
  "vents",
  "seam",
  "grid",
] as const;
export type PartDetail = (typeof partDetails)[number];

const details = z.array(z.enum(partDetails));

export const boxGeometry = z.object({
  kind: z.literal("box"),
  /** The back-left corner of the plan (smallest x and y) and the bottom. */
  x: z.number(),
  y: z.number(),
  z: z.number(),
  w: z.number(),
  d: z.number(),
  h: z.number(),
  /** Radius of the plan's corners. */
  corner: z.number(),
  details,
});

export const cylinderGeometry = z.object({
  kind: z.literal("cylinder"),
  /** The centre of the plan and the bottom. */
  x: z.number(),
  y: z.number(),
  z: z.number(),
  radius: z.number(),
  h: z.number(),
  details,
});

export const rodGeometry = z.object({
  kind: z.literal("rod"),
  axis: z.enum(["x", "y"]),
  /** The centre of the end with the smaller x or y. */
  x: z.number(),
  y: z.number(),
  z: z.number(),
  length: z.number(),
  radius: z.number(),
  details,
});

export const springGeometry = z.object({
  kind: z.literal("spring"),
  axis: z.enum(["x", "y", "z"]),
  /** The centre of the start end (the bottom for z). */
  x: z.number(),
  y: z.number(),
  z: z.number(),
  length: z.number(),
  radius: z.number(),
  turns: z.number(),
});

export const ballGeometry = z.object({
  kind: z.literal("ball"),
  x: z.number(),
  y: z.number(),
  z: z.number(),
  radius: z.number(),
});

export const needleGeometry = z.object({
  kind: z.literal("needle"),
  /** The pivot, and the height of the face the needle lies on. */
  x: z.number(),
  y: z.number(),
  z: z.number(),
  length: z.number(),
  /** Degrees: 0 points to -y, 90 to +x, clockwise seen from above. */
  angle: z.number(),
});

export const cableGeometry = z.object({
  kind: z.literal("cable"),
  /** At least two; each end on a part. */
  points: z.array(point),
});

// A plain union (anyOf in JSON Schema): providers' strict modes do not take oneOf.
export const geometry = z.union([
  boxGeometry,
  cylinderGeometry,
  rodGeometry,
  springGeometry,
  ballGeometry,
  needleGeometry,
  cableGeometry,
]);
export type Geometry = z.infer<typeof geometry>;
export type GeometryKind = Geometry["kind"];

export const part = z.object({
  id: z.string().min(1).max(80),
  name: z.string().max(200),
  role: z.enum(partRoles),
  assembly: z.string().max(80),
  /** What the part is in the object and what it stands for in the sources, with [n] citations. */
  explanation: z.string().max(2000),
  geometry,
});
export type Part = z.infer<typeof part>;

export const assembly = z.object({
  id: z.string().min(1).max(80),
  name: z.string().max(200),
  /** Where the assembly goes in the exploded view, from where it is drawn. */
  explode: point,
});
export type Assembly = z.infer<typeof assembly>;

export const move = z.object({
  /** A part or a whole assembly. */
  target: z.string().max(80),
  /** From where it is drawn, for this step. */
  offset: point,
  /** Degrees around the part's own vertical axis; needles turn around their pivot. */
  turn: z.number(),
  /** Extra length along the part's axis: a spring or rod grows, a box or cylinder gets taller. */
  stretch: z.number(),
});
export type Move = z.infer<typeof move>;

export const step = z.object({
  title: z.string().max(300),
  explanation: z.string().max(3000),
  /** A short live reading, as an instrument would show it. */
  readout: z.string().max(120),
  /** The parts to watch in this step. */
  focus: z.array(z.string().max(80)).max(40),
  moves: z.array(move).max(80),
});
export type Step = z.infer<typeof step>;

export const camera = z.object({
  /** Degrees around the vertical axis; 45 shows both sides equally. */
  azimuth: z.number(),
  /** Degrees above the floor. */
  elevation: z.number(),
});
export type Camera = z.infer<typeof camera>;

export const scene = z.object({
  title: z.string().max(200),
  /** What the object is, what moves and what that motion means. */
  object: z.string().max(2000),
  caption: z.string().max(3000),
  camera,
  assemblies: z.array(assembly).max(20),
  parts: z.array(part).min(1).max(200),
  steps: z.array(step).max(12),
});
export type Scene = z.infer<typeof scene>;
