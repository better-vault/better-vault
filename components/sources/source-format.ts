import {
  BookOpen01Icon,
  Csv01Icon,
  Doc01Icon,
  File02Icon,
  FileBracesIcon,
  FileCodeIcon,
  FileTextIcon,
  Globe02Icon,
  HtmlFile01Icon,
  Pdf01Icon,
  Ppt01Icon,
  TextIcon,
  Txt01Icon,
  Xls01Icon,
  YoutubeIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import type { SourceFormat } from "@/lib/sources/formats";

/** The icon of each source format, in the list, the reader and citations. */
export const sourceFormatIcons: Record<SourceFormat, IconSvgElement> = {
  text: TextIcon,
  markdown: File02Icon,
  pdf: Pdf01Icon,
  web: Globe02Icon,
  youtube: YoutubeIcon,
  csv: Csv01Icon,
  tsv: Csv01Icon,
  json: FileBracesIcon,
  xml: FileCodeIcon,
  yaml: FileBracesIcon,
  html: HtmlFile01Icon,
  code: FileCodeIcon,
  log: Txt01Icon,
  docx: Doc01Icon,
  xlsx: Xls01Icon,
  pptx: Ppt01Icon,
  epub: BookOpen01Icon,
};

/** Formats with no icon of their own fall back to a plain file. */
export const fallbackSourceIcon = FileTextIcon;
