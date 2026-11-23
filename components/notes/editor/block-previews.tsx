import type { ReactNode } from "react";

/**
 * Small pictures of each block, shown beside the highlighted row of the
 * block menu. Drawn with shapes and the app's tokens; the words come from
 * the item's translated label, so there is no text to translate here.
 */
const line = (width: string, className = "h-1.5 bg-muted-foreground/30") => (
  <span className={`block rounded-full ${className}`} style={{ width }} />
);

export function blockPreview(id: string, label: string): ReactNode {
  switch (id) {
    case "text":
      return (
        <div className="flex w-full flex-col gap-1.5">
          {line("100%")}
          {line("92%")}
          {line("60%")}
        </div>
      );
    case "h1":
    case "h2":
    case "h3":
      return (
        <div className="flex w-full flex-col gap-2">
          <span
            className={
              id === "h1"
                ? "text-2xl font-bold"
                : id === "h2"
                  ? "text-xl font-semibold"
                  : "text-base font-semibold"
            }
          >
            {label}
          </span>
          {line("85%")}
        </div>
      );
    case "bullet":
    case "numbered":
    case "todo":
      return (
        <div className="flex w-full flex-col gap-2">
          {[0, 1, 2].map((at) => (
            <span key={at} className="flex items-center gap-2">
              {id === "bullet" ? (
                <span className="size-1.5 rounded-full bg-foreground" />
              ) : id === "numbered" ? (
                <span className="w-3 font-mono text-[10px]">{at + 1}.</span>
              ) : (
                <span
                  className={`size-3 rounded-[3px] ring-1 ring-muted-foreground ${at === 0 ? "bg-primary ring-primary" : ""}`}
                />
              )}
              {line(`${80 - at * 15}%`)}
            </span>
          ))}
        </div>
      );
    case "quote":
      return (
        <div className="flex w-full gap-2">
          <span className="w-0.5 rounded-full bg-foreground" />
          <div className="flex flex-1 flex-col gap-1.5 py-0.5">
            {line("100%")}
            {line("70%")}
          </div>
        </div>
      );
    case "callout":
    case "toggle":
      return (
        <div className="flex w-full flex-col gap-1.5 rounded-lg bg-info/10 p-2 ring-1 ring-info/30">
          <span className="flex items-center gap-1.5 text-xs font-medium text-info">
            {id === "toggle" ? "▸" : "ⓘ"} {label}
          </span>
          {id === "callout" ? line("80%", "h-1.5 bg-info/30") : null}
        </div>
      );
    case "code":
      return (
        <div className="flex w-full flex-col gap-1.5 rounded-lg bg-muted p-2 font-mono text-[10px] text-muted-foreground">
          <span>{"{ }"}</span>
          {line("70%", "h-1.5 bg-muted-foreground/40")}
          {line("45%", "h-1.5 bg-muted-foreground/40")}
        </div>
      );
    case "divider":
      return (
        <div className="flex w-full flex-col gap-2">
          {line("80%")}
          <span className="h-px w-full bg-border" />
          {line("60%")}
        </div>
      );
    case "table":
      return (
        <div className="grid w-full grid-cols-3 overflow-hidden rounded-md ring-1 ring-border">
          {Array.from({ length: 9 }, (_, at) => (
            <span
              key={at}
              className={`h-4 border-e border-b border-border ${at < 3 ? "bg-muted" : ""}`}
            />
          ))}
        </div>
      );
    case "note-link":
    case "notebook-link":
    case "source-link":
      return (
        <span className="rounded-md px-1 text-sm text-primary underline decoration-primary/40 underline-offset-4">
          {label}
        </span>
      );
    case "tag":
      return <span className="rounded-full bg-primary/12 px-2 py-0.5 text-sm text-primary">#</span>;
    case "image":
      return (
        <div className="flex h-16 w-full items-end gap-1 overflow-hidden rounded-lg bg-muted p-2">
          <span className="size-6 rounded-full bg-chart-4/60" />
          <span className="h-8 flex-1 rounded-t-full bg-chart-3/40" />
        </div>
      );
    case "diagram":
      return (
        <div className="flex items-center gap-1.5">
          <span className="rounded-md px-2 py-1 text-[10px] ring-1 ring-foreground/40">A</span>
          <span className="h-px w-5 bg-foreground/60" />
          <span className="rounded-md px-2 py-1 text-[10px] ring-1 ring-foreground/40">B</span>
        </div>
      );
    case "math":
      return <span className="font-serif text-lg italic">e^(iπ) + 1 = 0</span>;
    default:
      return null;
  }
}
