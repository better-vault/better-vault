import {
  Cards01Icon,
  ChartBarBigIcon,
  CubeIcon,
  HelpSquareIcon,
  HierarchySquare02Icon,
  News01Icon,
  Presentation01Icon,
  Table02Icon,
  WhiteboardIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";

/*
 * The Studio tools as the website shows them. Icons and tints match the app's
 * studio/tools.ts (keep them in step); the words are the site's own.
 */
export interface SiteTool {
  id: string;
  name: string;
  body: string;
  icon: IconSvgElement;
  /** Icon colour, from the chart ramp. */
  tint: string;
  formats: string[];
  /** Not in NotebookLM. */
  isNew?: boolean;
}

export const tools: SiteTool[] = [
  {
    id: "report",
    name: "Report",
    body: "Briefing doc, study guide, blog post or your own format, with citations.",
    icon: News01Icon,
    tint: "text-chart-2",
    formats: ["Word", "Markdown"],
  },
  {
    id: "flashcards",
    name: "Flashcards",
    body: "Flip, shuffle and tally what you know.",
    icon: Cards01Icon,
    tint: "text-chart-4",
    formats: ["Word", "Anki CSV"],
  },
  {
    id: "quiz",
    name: "Quiz",
    body: "Multiple choice with hints, explanations and a score.",
    icon: HelpSquareIcon,
    tint: "text-chart-3",
    formats: ["Word", "Markdown"],
  },
  {
    id: "mind-map",
    name: "Mind map",
    body: "An interactive map, or 11 other diagram kinds.",
    icon: HierarchySquare02Icon,
    tint: "text-chart-5",
    formats: ["PNG", "SVG", "Mermaid"],
  },
  {
    id: "data-table",
    name: "Data table",
    body: "Facts from your sources in rows and columns.",
    icon: Table02Icon,
    tint: "text-chart-2",
    formats: ["Excel", "CSV"],
  },
  {
    id: "anatomy",
    name: "Anatomy",
    body: "A figure of a real object you can take apart.",
    icon: CubeIcon,
    tint: "text-chart-3",
    formats: ["PNG", "SVG"],
    isNew: true,
  },
  {
    id: "slide-deck",
    name: "Slide deck",
    body: "A deck to read, or slides with speaker notes.",
    icon: Presentation01Icon,
    tint: "text-chart-4",
    formats: ["PowerPoint", "PDF"],
  },
  {
    id: "infographic",
    name: "Infographic",
    body: "One page, drawn by your provider's image model.",
    icon: ChartBarBigIcon,
    tint: "text-chart-5",
    formats: ["PNG"],
  },
  {
    id: "whiteboard",
    name: "Whiteboard",
    body: "Sketch, diagram and draw over your figures.",
    icon: WhiteboardIcon,
    tint: "text-chart-1",
    formats: ["PNG", "SVG", "JSON"],
    isNew: true,
  },
];
