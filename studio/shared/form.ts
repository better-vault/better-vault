/** What a tool's dialog form receives: its own options and the shared focus text. */
export interface ToolFormProps<Options> {
  value: Options;
  onChange: (value: Options) => void;
  focus: string;
  onFocusChange: (focus: string) => void;
  /** The sources chosen in the dialog. */
  sourceIds: string[];
}

/**
 * The output's title and actions, for a viewer that shows them itself
 * (`immersive` in the tool's client): the page then has no header.
 */
export interface OutputChrome {
  icon: import("@hugeicons/react").IconSvgElement;
  /** The icon's colour class. */
  tint: string;
  title: string;
  /** "Edited 3 minutes ago", or the sources, model and date. */
  meta: string;
  downloads: { format: string; label: string; onSelect: () => void }[];
  /** A download is being built. */
  busy: boolean;
  onRename: () => void;
  onDelete: () => void;
}

/** What a tool's viewer receives. */
export interface ToolViewerProps<Data> {
  outputId: string;
  title: string;
  data: Data;
  /** Saves edits made in the viewer, e.g. drawing on a whiteboard. */
  onDataChange?: (data: Data) => Promise<void>;
  /** Opens the output's picture on a new whiteboard, to draw on it. */
  onAnnotate?: () => void;
  /** The element the viewer scrolls in, for parts that follow the reading. */
  scrollRef?: import("react").RefObject<HTMLElement | null>;
  /** The title and actions, for immersive viewers. */
  chrome?: OutputChrome;
  /** Opens a cited passage in the source reader. */
  onOpenPassage: (passage: import("@/lib/chat/types").PassageRef) => void;
}
