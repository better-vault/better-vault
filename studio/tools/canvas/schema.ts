import { generateId } from "ai";
import { z } from "zod";

/**
 * A canvas in the open JSON Canvas format (jsoncanvas.org, made by Obsidian),
 * so a board saves as a `.canvas` file Obsidian opens. Cards are text, a note
 * (a `file` card naming `Title.md`), a web link or a group; edges join them.
 * Colours are the format's presets "1"–"6", drawn with theme tokens.
 */
const side = z.enum(["top", "right", "bottom", "left"]);
export type Side = z.infer<typeof side>;

export const canvasNode = z
  .object({
    id: z.string(),
    type: z.enum(["text", "file", "link", "group"]),
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
    color: z.string().optional(),
    text: z.string().optional(),
    file: z.string().optional(),
    url: z.string().optional(),
    label: z.string().optional(),
  })
  .loose();
export type CanvasNode = z.infer<typeof canvasNode>;

export const canvasEdge = z
  .object({
    id: z.string(),
    fromNode: z.string(),
    fromSide: side.optional(),
    toNode: z.string(),
    toSide: side.optional(),
    toEnd: z.enum(["none", "arrow"]).optional(),
    label: z.string().optional(),
    color: z.string().optional(),
  })
  .loose();
export type CanvasEdge = z.infer<typeof canvasEdge>;

export const canvasData = z.object({
  nodes: z.array(canvasNode),
  edges: z.array(canvasEdge),
  /** Changes on every save, so the viewer tells its own saves from saves elsewhere. */
  saveId: z.string().default(""),
});
export type CanvasData = z.infer<typeof canvasData>;

export const emptyCanvas = (): CanvasData => ({ nodes: [], edges: [], saveId: generateId() });

/** The JSON Canvas presets, as theme tokens. */
export const canvasColors: Record<string, { border: string; fill: string; swatch: string }> = {
  "1": { border: "border-destructive", fill: "bg-destructive/10", swatch: "bg-destructive" },
  "2": { border: "border-warning", fill: "bg-warning/10", swatch: "bg-warning" },
  "3": { border: "border-chart-4", fill: "bg-chart-4/10", swatch: "bg-chart-4" },
  "4": { border: "border-success", fill: "bg-success/10", swatch: "bg-success" },
  "5": { border: "border-info", fill: "bg-info/10", swatch: "bg-info" },
  "6": { border: "border-chart-5", fill: "bg-chart-5/10", swatch: "bg-chart-5" },
};

/** The point on a card's side where an edge meets it. */
export function anchor(node: CanvasNode, at: Side): { x: number; y: number } {
  switch (at) {
    case "top":
      return { x: node.x + node.width / 2, y: node.y };
    case "bottom":
      return { x: node.x + node.width / 2, y: node.y + node.height };
    case "left":
      return { x: node.x, y: node.y + node.height / 2 };
    default:
      return { x: node.x + node.width, y: node.y + node.height / 2 };
  }
}

/** The side of `node` facing `other`, for edges saved without sides. */
export function facing(node: CanvasNode, other: CanvasNode): Side {
  const dx = other.x + other.width / 2 - (node.x + node.width / 2);
  const dy = other.y + other.height / 2 - (node.y + node.height / 2);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "bottom" : "top";
}

/** A curve from one side to another, bending out of each side like Obsidian's. */
export function edgePath(
  from: { x: number; y: number },
  fromSide: Side,
  to: { x: number; y: number },
  toSide: Side,
) {
  const bend = Math.max(40, Math.hypot(to.x - from.x, to.y - from.y) / 3);
  const push = (point: { x: number; y: number }, at: Side) => ({
    x: point.x + (at === "left" ? -bend : at === "right" ? bend : 0),
    y: point.y + (at === "top" ? -bend : at === "bottom" ? bend : 0),
  });
  const a = push(from, fromSide);
  const b = push(to, toSide);
  return `M ${from.x} ${from.y} C ${a.x} ${a.y}, ${b.x} ${b.y}, ${to.x} ${to.y}`;
}

/** The note a file card points at: its title without ".md" and any folders. */
export const noteTitleOf = (file: string) => file.replace(/^.*\//, "").replace(/\.md$/i, "");
