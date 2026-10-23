/** What a tool's dialog form receives: its own options and the shared focus text. */
export interface ToolFormProps<Options> {
  value: Options;
  onChange: (value: Options) => void;
  focus: string;
  onFocusChange: (focus: string) => void;
}

/** What a tool's viewer receives. */
export interface ToolViewerProps<Data> {
  title: string;
  data: Data;
  /** Opens a cited passage in the source reader. */
  onOpenPassage: (passage: import("@/lib/chat/types").PassageRef) => void;
}
