"use client";

import { Markdown } from "@/components/chat/markdown";
import type { ToolViewerProps } from "@/studio/shared/form";
import type { ReportData } from "./definition";

export function ReportViewer({ data, onOpenPassage }: ToolViewerProps<ReportData>) {
  return (
    <article className="mx-auto w-full max-w-3xl pb-10">
      <Markdown text={data.markdown} passages={data.passages} onCite={onOpenPassage} />
    </article>
  );
}
