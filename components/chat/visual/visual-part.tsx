import { Copy01Icon, Download04Icon, RepeatIcon } from "@hugeicons/core-free-icons";
import { getToolName, type ToolUIPart, type DynamicToolUIPart } from "ai";
import { useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { visualKindOf, visualSchemas, type VisualInput, type VisualKind } from "@/lib/chat/visuals";
import { downloadText } from "@/lib/format";
import { cn } from "@/lib/utils";
import { renderDiagram } from "@/studio/tools/mind-map/render";
import { ChartVisual } from "./chart";

type ToolPart = ToolUIPart | DynamicToolUIPart;

/** Whether a message part is one of the show_* visuals. */
export function isVisualPart(part: ToolPart): boolean {
  return visualKindOf(getToolName(part)) !== null;
}

/**
 * One visual in an answer. While the model writes it, a placeholder; once
 * written (and, for a diagram, checked), the component for its kind. A
 * diagram the model has to fix is not shown: its next try is.
 */
export function VisualPart({ part }: { part: ToolPart }) {
  const { t } = useTranslation("chat");
  const kind = visualKindOf(getToolName(part))!;
  const parsed = useMemo(
    () => (part.state === "input-streaming" ? null : visualSchemas[kind].safeParse(part.input)),
    [kind, part.state, part.input],
  );
  const output =
    part.state === "output-available" ? (part.output as { ok?: boolean } | undefined) : undefined;

  if (part.state === "output-error" || output?.ok === false) return null;
  if (!parsed?.success) {
    if (part.state === "input-streaming" || part.state === "input-available") {
      const title = (part.input as { title?: unknown } | undefined)?.title;
      return (
        <div className="flex flex-col gap-2 rounded-2xl border p-4" aria-busy>
          <span className="text-xs text-muted-foreground">
            {typeof title === "string" && title ? title : t("visual.drawing")}
          </span>
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      );
    }
    return null;
  }
  return <Visual kind={kind} data={parsed.data as never} />;
}

function Visual<K extends VisualKind>({ kind, data }: { kind: K; data: VisualInput<K> }) {
  const { t } = useTranslation("chat");
  const asText = () => visualText(kind, data);
  const svg = kind === "diagram" ? renderDiagram((data as VisualInput<"diagram">).mermaid) : null;

  return (
    <figure className="not-prose my-1 flex flex-col gap-3 rounded-2xl border bg-card p-4">
      <figcaption className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{data.title}</span>
        <button
          type="button"
          aria-label={t("visual.copy")}
          title={t("visual.copy")}
          onClick={() =>
            void navigator.clipboard
              .writeText(asText())
              .then(() => toast.success(t("actions.copied")))
          }
          className="flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon icon={Copy01Icon} size={14} />
        </button>
        {kind === "table" || kind === "chart" || (svg && "svg" in svg) ? (
          <button
            type="button"
            aria-label={t("visual.download")}
            title={t("visual.download")}
            onClick={() => {
              if (svg && "svg" in svg) downloadText(svg.svg, `${data.title}.svg`, "image/svg+xml");
              else downloadText(toCsv(kind, data), `${data.title}.csv`, "text/csv");
            }}
            className="flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon icon={Download04Icon} size={14} />
          </button>
        ) : null}
      </figcaption>
      {kind === "diagram" && svg ? (
        "svg" in svg ? (
          <div
            className="pele flex max-h-[28rem] justify-center overflow-auto [&_svg]:h-auto [&_svg]:max-w-full"
            // Pele escapes every label it draws; links and images are off.
            dangerouslySetInnerHTML={{ __html: svg.svg }}
          />
        ) : null
      ) : kind === "chart" ? (
        <ChartVisual data={data as VisualInput<"chart">} />
      ) : kind === "table" ? (
        <TableVisual data={data as VisualInput<"table">} />
      ) : kind === "timeline" ? (
        <TimelineVisual data={data as VisualInput<"timeline">} />
      ) : kind === "steps" ? (
        <StepsVisual data={data as VisualInput<"steps">} />
      ) : kind === "comparison" ? (
        <ComparisonVisual data={data as VisualInput<"comparison">} />
      ) : kind === "facts" ? (
        <FactsVisual data={data as VisualInput<"facts">} />
      ) : kind === "flashcards" ? (
        <FlashcardsVisual data={data as VisualInput<"flashcards">} />
      ) : null}
    </figure>
  );
}

function TableVisual({ data }: { data: VisualInput<"table"> }) {
  return (
    <div className="max-h-[28rem] overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-card">
          <tr>
            {data.columns.map((column) => (
              <th
                key={column}
                className="border-b py-1.5 pe-3 text-start text-xs font-medium text-muted-foreground"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, at) => (
            <tr key={at} className="border-b last:border-0">
              {data.columns.map((column, ci) => (
                <td key={column} className="py-1.5 pe-3 align-top">
                  {row[ci] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TimelineVisual({ data }: { data: VisualInput<"timeline"> }) {
  return (
    <ol className="relative ms-2 flex flex-col gap-4 border-s ps-5">
      {data.items.map((item, at) => (
        <li key={at} className="relative">
          <span className="absolute -start-[1.6rem] top-1.5 size-2.5 rounded-full bg-primary ring-4 ring-card" />
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {item.when}
          </span>
          <p className="text-sm font-medium">{item.title}</p>
          {item.detail ? <p className="text-sm text-muted-foreground">{item.detail}</p> : null}
        </li>
      ))}
    </ol>
  );
}

function StepsVisual({ data }: { data: VisualInput<"steps"> }) {
  return (
    <ol className="flex flex-col gap-3">
      {data.steps.map((step, at) => (
        <li key={at} className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground tabular-nums">
            {at + 1}
          </span>
          <div className="min-w-0 pt-0.5">
            <p className="text-sm font-medium">{step.title}</p>
            {step.detail ? <p className="text-sm text-muted-foreground">{step.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ComparisonVisual({ data }: { data: VisualInput<"comparison"> }) {
  return (
    <div
      className={cn("grid gap-3", data.columns.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3")}
    >
      {data.columns.map((column) => (
        <div key={column.name} className="rounded-xl bg-muted/50 p-3">
          <p className="pb-2 text-sm font-semibold">{column.name}</p>
          <ul className="flex list-disc flex-col gap-1 ps-4 text-sm">
            {column.points.map((point, at) => (
              <li key={at}>{point}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function FactsVisual({ data }: { data: VisualInput<"facts"> }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {data.facts.map((fact, at) => (
        <div key={at} className="flex flex-col gap-0.5 rounded-xl bg-muted/50 p-3">
          <span className="text-xs text-muted-foreground">{fact.label}</span>
          <span className="text-xl font-semibold tracking-tight tabular-nums">{fact.value}</span>
          {fact.detail ? (
            <span className="text-xs text-muted-foreground">{fact.detail}</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function FlashcardsVisual({ data }: { data: VisualInput<"flashcards"> }) {
  const { t } = useTranslation("chat");
  const [at, setAt] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = data.cards[at];
  const go = (step: number) => {
    setFlipped(false);
    setAt((current) => (current + step + data.cards.length) % data.cards.length);
  };
  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => setFlipped((current) => !current)}
        aria-label={flipped ? t("visual.showFront") : t("visual.showBack")}
        className="flex min-h-36 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl bg-muted/50 p-5 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="text-xs text-muted-foreground">
          {flipped ? t("visual.answer") : t("visual.question")}
        </span>
        <span className="text-base">{flipped ? card.back : card.front}</span>
      </button>
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <NavButton label={t("visual.previous")} onClick={() => go(-1)}>
          ‹
        </NavButton>
        <span className="tabular-nums">
          {at + 1} / {data.cards.length}
        </span>
        <NavButton label={t("visual.next")} onClick={() => go(1)}>
          ›
        </NavButton>
        <NavButton label={t("visual.flip")} onClick={() => setFlipped((current) => !current)}>
          <Icon icon={RepeatIcon} size={14} />
        </NavButton>
      </div>
    </div>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 cursor-pointer items-center justify-center rounded-full text-base outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </button>
  );
}

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

function toCsv(kind: VisualKind, data: unknown): string {
  if (kind === "table") {
    const table = data as VisualInput<"table">;
    return [table.columns, ...table.rows].map((row) => row.map(csvCell).join(",")).join("\n");
  }
  const chart = data as VisualInput<"chart">;
  return [
    ["", ...chart.series.map((each) => each.name)],
    ...chart.labels.map((label, at) => [
      label,
      ...chart.series.map((each) => each.values[at] ?? ""),
    ]),
  ]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
}

/** A visual as plain text, for copying into notes or documents. */
function visualText(kind: VisualKind, data: unknown): string {
  const { title } = data as { title: string };
  switch (kind) {
    case "diagram":
      return `\`\`\`mermaid\n${(data as VisualInput<"diagram">).mermaid}\n\`\`\``;
    case "table": {
      const table = data as VisualInput<"table">;
      return [
        `| ${table.columns.join(" | ")} |`,
        `| ${table.columns.map(() => "---").join(" | ")} |`,
        ...table.rows.map((row) => `| ${row.join(" | ")} |`),
      ].join("\n");
    }
    case "chart":
      return toCsv(kind, data);
    case "timeline":
      return [
        `## ${title}`,
        ...(data as VisualInput<"timeline">).items.map(
          (item) => `- **${item.when}**: ${item.title}${item.detail ? ` — ${item.detail}` : ""}`,
        ),
      ].join("\n");
    case "steps":
      return [
        `## ${title}`,
        ...(data as VisualInput<"steps">).steps.map(
          (step, at) => `${at + 1}. **${step.title}**${step.detail ? ` — ${step.detail}` : ""}`,
        ),
      ].join("\n");
    case "comparison":
      return (data as VisualInput<"comparison">).columns
        .map((column) =>
          [`### ${column.name}`, ...column.points.map((point) => `- ${point}`)].join("\n"),
        )
        .join("\n\n");
    case "facts":
      return (data as VisualInput<"facts">).facts
        .map(
          (fact) => `- ${fact.label}: **${fact.value}**${fact.detail ? ` (${fact.detail})` : ""}`,
        )
        .join("\n");
    case "flashcards":
      return (data as VisualInput<"flashcards">).cards
        .map((card) => `Q: ${card.front}\nA: ${card.back}`)
        .join("\n\n");
  }
}
