/** What a tool's dialog form receives: its own options and the shared focus text. */
export interface ToolFormProps<Options> {
  value: Options;
  onChange: (value: Options) => void;
  focus: string;
  onFocusChange: (focus: string) => void;
  /** The sources chosen in the dialog. */
  sourceIds: string[];
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
  /** Opens a cited passage in the source reader. */
  onOpenPassage: (passage: import("@/lib/chat/types").PassageRef) => void;
}
