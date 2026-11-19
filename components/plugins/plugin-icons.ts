import {
  AiBrain01Icon,
  Book02Icon,
  Calendar03Icon,
  ChartBarBigIcon,
  Clock01Icon,
  CodeIcon,
  GlobeIcon,
  Image01Icon,
  MusicNote01Icon,
  Note01Icon,
  PaintBoardIcon,
  PuzzleIcon,
  SparklesIcon,
  Table02Icon,
  Target02Icon,
  Video01Icon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { PluginIcon } from "@/lib/plugins/manifest";

/** The icons a plugin's manifest can name. */
export const pluginIconSet: Record<PluginIcon, IconSvgElement> = {
  puzzle: PuzzleIcon,
  chart: ChartBarBigIcon,
  table: Table02Icon,
  book: Book02Icon,
  calendar: Calendar03Icon,
  note: Note01Icon,
  palette: PaintBoardIcon,
  sparkles: SparklesIcon,
  code: CodeIcon,
  globe: GlobeIcon,
  image: Image01Icon,
  music: MusicNote01Icon,
  video: Video01Icon,
  brain: AiBrain01Icon,
  clock: Clock01Icon,
  target: Target02Icon,
};
