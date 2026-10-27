import {
  ArrowUpRight01Icon,
  CircleIcon,
  Cursor01Icon,
  DiamondIcon,
  EraserIcon,
  HandIcon,
  Image01Icon,
  SlashIcon,
  PencilIcon,
  SquareIcon,
  TextFontIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

/** The board's tools, with Excalidraw's keys. */
export const boardTools = [
  "hand",
  "selection",
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
  "freedraw",
  "text",
  "image",
  "eraser",
] as const;
export type BoardTool = (typeof boardTools)[number];

export interface ToolMeta {
  icon: IconSvgElement;
  /** The letter key, and the number key when there is one. */
  key: string;
  digit?: string;
}

export const toolMeta: Record<BoardTool, ToolMeta> = {
  hand: { icon: HandIcon, key: "h" },
  selection: { icon: Cursor01Icon, key: "v", digit: "1" },
  rectangle: { icon: SquareIcon, key: "r", digit: "2" },
  diamond: { icon: DiamondIcon, key: "d", digit: "3" },
  ellipse: { icon: CircleIcon, key: "o", digit: "4" },
  arrow: { icon: ArrowUpRight01Icon, key: "a", digit: "5" },
  line: { icon: SlashIcon, key: "l", digit: "6" },
  freedraw: { icon: PencilIcon, key: "p", digit: "7" },
  text: { icon: TextFontIcon, key: "t", digit: "8" },
  image: { icon: Image01Icon, key: "", digit: "9" },
  eraser: { icon: EraserIcon, key: "e", digit: "0" },
};

/** The tool for a key press: by the letter or digit typed, or by the physical key on other layouts. */
export function toolForKey(event: Pick<KeyboardEvent, "key" | "code">): BoardTool | null {
  const key = event.key.toLowerCase();
  const code = event.code.startsWith("Key")
    ? event.code.slice(3).toLowerCase()
    : event.code.startsWith("Digit")
      ? event.code.slice(5)
      : "";
  for (const tool of boardTools) {
    const meta = toolMeta[tool];
    if (
      (meta.key && (key === meta.key || code === meta.key)) ||
      (meta.digit && (key === meta.digit || code === meta.digit))
    )
      return tool;
  }
  return null;
}

/** Tools that draw something new, and so edit the style of what they draw. */
export const drawingTools = new Set<BoardTool>([
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
  "freedraw",
  "text",
]);
