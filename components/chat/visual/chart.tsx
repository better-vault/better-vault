import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { VisualInput } from "@/lib/chat/visuals";
import { cn } from "@/lib/utils";

/** Series colours, in a fixed order (never cycled): checked for colour-blind separation. */
const SERIES = [
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-5)",
  "var(--chart-4)",
  "var(--chart-1)",
];
const swatchClass = ["bg-chart-2", "bg-chart-3", "bg-chart-5", "bg-chart-4", "bg-chart-1"];

const W = 560;
const H = 240;
const PAD = { top: 16, right: 12, bottom: 36, left: 44 };

function niceMax(value: number) {
  if (value <= 0) return 1;
  const step = 10 ** Math.floor(Math.log10(value));
  return Math.ceil(value / step) * step;
}

const format = (value: number, unit?: string) =>
  `${Number.isInteger(value) ? value : value.toFixed(1)}${unit ? (unit === "%" ? "%" : ` ${unit}`) : ""}`;

/**
 * A small bar, line or pie chart drawn as SVG with the theme's chart
 * colours. Values are labelled, a legend names two or more series, and a
 * table view shows the numbers, so nothing relies on colour alone.
 */
export function ChartVisual({ data }: { data: VisualInput<"chart"> }) {
  const { t } = useTranslation("chat");
  const [table, setTable] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const series = data.series.map((each) => ({
    ...each,
    values: data.labels.map((_, at) => each.values[at] ?? 0),
  }));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        {series.length > 1 || data.type === "pie" ? (
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {(data.type === "pie" ? data.labels : series.map((each) => each.name)).map(
              (name, at) => (
                <li key={name} className="flex items-center gap-1.5">
                  <span
                    className={cn("size-2.5 rounded-sm", swatchClass[at % swatchClass.length])}
                  />
                  {name}
                </li>
              ),
            )}
          </ul>
        ) : null}
        <button
          type="button"
          onClick={() => setTable((current) => !current)}
          aria-pressed={table}
          className="ms-auto cursor-pointer rounded-md px-2 py-0.5 text-xs text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          {table ? t("visual.chart") : t("visual.table")}
        </button>
      </div>
      {table ? (
        <DataTable labels={data.labels} series={series} unit={data.unit} />
      ) : data.type === "pie" ? (
        <Pie
          labels={data.labels}
          values={series[0].values}
          unit={data.unit}
          hover={hover}
          onHover={setHover}
        />
      ) : (
        <XY
          type={data.type}
          labels={data.labels}
          series={series}
          unit={data.unit}
          hover={hover}
          onHover={setHover}
        />
      )}
    </div>
  );
}

function DataTable({
  labels,
  series,
  unit,
}: {
  labels: string[];
  series: { name: string; values: number[] }[];
  unit?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-start text-xs text-muted-foreground">
            <th className="py-1 pe-3 text-start font-medium" />
            {series.map((each) => (
              <th key={each.name} className="py-1 pe-3 text-end font-medium">
                {each.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((label, at) => (
            <tr key={label} className="border-t">
              <td className="py-1 pe-3">{label}</td>
              {series.map((each) => (
                <td key={each.name} className="py-1 pe-3 text-end tabular-nums">
                  {format(each.values[at], unit)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function XY({
  type,
  labels,
  series,
  unit,
  hover,
  onHover,
}: {
  type: "bar" | "line";
  labels: string[];
  series: { name: string; values: number[] }[];
  unit?: string;
  hover: string | null;
  onHover: (key: string | null) => void;
}) {
  const values = series.flatMap((each) => each.values);
  const min = Math.min(0, ...values);
  const max = niceMax(Math.max(...values));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const y = (value: number) => PAD.top + plotH - ((value - min) / (max - min || 1)) * plotH;
  const band = plotW / labels.length;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((step) => min + (max - min) * step);
  const gap = 2;
  const barW = Math.max(4, Math.min(36, (band * 0.7 - gap * (series.length - 1)) / series.length));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      onPointerLeave={() => onHover(null)}
    >
      {ticks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(tick)}
            y2={y(tick)}
            stroke="var(--border)"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 6}
            y={y(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            className="fill-muted-foreground text-[10px]"
          >
            {format(tick, unit)}
          </text>
        </g>
      ))}
      {labels.map((label, at) => (
        <text
          key={label}
          x={PAD.left + band * at + band / 2}
          y={H - PAD.bottom + 16}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px]"
        >
          {label.length > 14 ? `${label.slice(0, 13)}…` : label}
        </text>
      ))}
      {type === "bar"
        ? series.map((each, si) =>
            each.values.map((value, at) => {
              const key = `${si}:${at}`;
              const x =
                PAD.left +
                band * at +
                (band - (barW * series.length + gap * (series.length - 1))) / 2 +
                si * (barW + gap);
              const top = y(Math.max(0, value));
              const height = Math.max(1, Math.abs(y(value) - y(0)));
              return (
                <g key={key} onPointerEnter={() => onHover(key)}>
                  <rect x={x - 4} y={PAD.top} width={barW + 8} height={plotH} fill="transparent" />
                  <rect
                    x={x}
                    y={top}
                    width={barW}
                    height={height}
                    rx={Math.min(4, barW / 2)}
                    fill={SERIES[si % SERIES.length]}
                    opacity={hover && hover !== key ? 0.45 : 1}
                  />
                  {hover === key || (series.length === 1 && labels.length <= 8) ? (
                    <text
                      x={x + barW / 2}
                      y={top - 4}
                      textAnchor="middle"
                      className="fill-foreground text-[10px] tabular-nums"
                    >
                      {format(value, unit)}
                    </text>
                  ) : null}
                  <title>{`${each.name} · ${labels[at]}: ${format(value, unit)}`}</title>
                </g>
              );
            }),
          )
        : series.map((each, si) => {
            const points = each.values.map(
              (value, at) => [PAD.left + band * at + band / 2, y(value)] as const,
            );
            return (
              <g key={each.name}>
                <polyline
                  points={points.map((point) => point.join(",")).join(" ")}
                  fill="none"
                  stroke={SERIES[si % SERIES.length]}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  opacity={hover && !hover.startsWith(`${si}:`) ? 0.45 : 1}
                />
                {points.map(([px, py], at) => {
                  const key = `${si}:${at}`;
                  return (
                    <g key={key} onPointerEnter={() => onHover(key)}>
                      <circle cx={px} cy={py} r={12} fill="transparent" />
                      <circle
                        cx={px}
                        cy={py}
                        r={hover === key ? 5 : 4}
                        fill={SERIES[si % SERIES.length]}
                        stroke="var(--card)"
                        strokeWidth={2}
                      />
                      {hover === key ? (
                        <text
                          x={px}
                          y={py - 10}
                          textAnchor="middle"
                          className="fill-foreground text-[10px] tabular-nums"
                        >
                          {format(each.values[at], unit)}
                        </text>
                      ) : null}
                      <title>{`${each.name} · ${labels[at]}: ${format(each.values[at], unit)}`}</title>
                    </g>
                  );
                })}
              </g>
            );
          })}
    </svg>
  );
}

function Pie({
  labels,
  values,
  unit,
  hover,
  onHover,
}: {
  labels: string[];
  values: number[];
  unit?: string;
  hover: string | null;
  onHover: (key: string | null) => void;
}) {
  const total = values.reduce((sum, value) => sum + Math.max(0, value), 0) || 1;
  const r = 90;
  const inner = 54;
  const cx = 120;
  const cy = 110;
  // Each slice's start and end angle, computed before drawing.
  const slices = values.reduce<{ start: number; end: number; share: number }[]>((out, value) => {
    const start = out.at(-1)?.end ?? -Math.PI / 2;
    const share = Math.max(0, value) / total;
    return [...out, { start, end: start + share * Math.PI * 2, share }];
  }, []);
  const arc = (start: number, end: number) => {
    const large = end - start > Math.PI ? 1 : 0;
    const p = (radius: number, a: number) =>
      `${cx + radius * Math.cos(a)} ${cy + radius * Math.sin(a)}`;
    return `M ${p(r, start)} A ${r} ${r} 0 ${large} 1 ${p(r, end)} L ${p(inner, end)} A ${inner} ${inner} 0 ${large} 0 ${p(inner, start)} Z`;
  };
  return (
    <svg
      viewBox="0 0 400 220"
      className="h-auto w-full max-w-md"
      role="img"
      onPointerLeave={() => onHover(null)}
    >
      {values.map((value, at) => {
        const { start, end, share } = slices[at];
        const key = String(at);
        return (
          <path
            key={key}
            d={arc(start, Math.max(start + 0.0001, end - 0.01))}
            fill={SERIES[at % SERIES.length]}
            stroke="var(--card)"
            strokeWidth={2}
            opacity={hover && hover !== key ? 0.45 : 1}
            onPointerEnter={() => onHover(key)}
          >
            <title>{`${labels[at]}: ${format(value, unit)} (${Math.round(share * 100)}%)`}</title>
          </path>
        );
      })}
      <g>
        {labels.slice(0, 8).map((label, at) => (
          <text key={label} x={240} y={40 + at * 20} className="fill-foreground text-[11px]">
            <tspan className="fill-muted-foreground">
              {label.length > 18 ? `${label.slice(0, 17)}…` : label}
            </tspan>
            <tspan dx={6} className="tabular-nums">
              {Math.round((Math.max(0, values[at]) / total) * 100)}%
            </tspan>
          </text>
        ))}
      </g>
    </svg>
  );
}
