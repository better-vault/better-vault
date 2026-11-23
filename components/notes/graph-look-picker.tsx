import { Tick02Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import type { GraphStyle } from "@/lib/notes/graph-style";
import { useGraphStyle } from "@/lib/notes/use-graph-style";
import { cn } from "@/lib/utils";

/** A colour from a graph style as CSS: a token name becomes its variable. */
const css = (value: string, fallback: string) =>
  value === "vault"
    ? `var(--${fallback})`
    : /^[a-z][a-z0-9-]*$/.test(value)
      ? `var(--${value})`
      : value;

/** Points for a small preview: a hub with branches, or a loose cluster. */
const RADIAL = (() => {
  const points: { x: number; y: number; px: number; py: number }[] = [];
  for (let branch = 0; branch < 6; branch++) {
    const a = (branch / 6) * Math.PI * 2 - Math.PI / 2;
    const [bx, by] = [50 + Math.cos(a) * 16, 32 + Math.sin(a) * 16];
    points.push({ x: bx, y: by, px: 50, py: 32 });
    for (const offset of [-0.28, 0.28]) {
      const leaf = a + offset;
      points.push({ x: 50 + Math.cos(leaf) * 27, y: 32 + Math.sin(leaf) * 25, px: bx, py: by });
    }
  }
  return points;
})();
const FORCE = [
  [50, 32, 50, 32],
  [32, 20, 50, 32],
  [68, 22, 50, 32],
  [36, 46, 50, 32],
  [66, 44, 50, 32],
  [18, 14, 32, 20],
  [22, 30, 32, 20],
  [82, 14, 68, 22],
  [84, 34, 68, 22],
  [26, 54, 36, 46],
  [76, 54, 66, 44],
].map(([x, y, px, py]) => ({ x, y, px, py }));

function Preview({ style }: { style: GraphStyle }) {
  const points = style.layout === "radial" ? RADIAL : FORCE;
  const node = css(style.node.color, "chart-2");
  return (
    <svg
      viewBox="0 0 100 64"
      aria-hidden
      className="h-16 w-full rounded-lg bg-background"
      style={style.background ? { background: css(style.background, "background") } : undefined}
    >
      {points.map((point, index) => {
        const mx = (point.x + point.px) / 2;
        const my = (point.y + point.py) / 2;
        return (
          <path
            key={`l${index}`}
            d={
              style.link.curved
                ? `M${point.px} ${point.py} Q${mx + (point.y - point.py) * 0.25} ${my - (point.x - point.px) * 0.25} ${point.x} ${point.y}`
                : `M${point.px} ${point.py} L${point.x} ${point.y}`
            }
            fill="none"
            stroke={css(style.link.color, "border")}
            strokeOpacity={style.link.opacity}
            strokeWidth={Math.max(0.4, style.link.width * 0.6)}
          />
        );
      })}
      {style.node.hubRing ? (
        <circle cx={50} cy={32} r={7} fill="none" stroke={node} strokeWidth={0.5} />
      ) : null}
      {points.map((point, index) => (
        <circle
          key={`n${index}`}
          cx={point.x}
          cy={point.y}
          r={(index === 0 ? 2.6 : 1.7) * style.node.size}
          fill={style.node.color === "vault" ? `var(--chart-${(index % 5) + 1})` : node}
        />
      ))}
      <circle cx={50} cy={32} r={2.8 * style.node.size} fill={node} />
    </svg>
  );
}

/** Picks how the Notes graph looks: the built-in looks, and those added by plugins. */
export function GraphLookPicker() {
  const { t } = useTranslation("notes");
  const { options, current, choose } = useGraphStyle();
  return (
    <div role="radiogroup" aria-label={t("graph.style")} className="grid grid-cols-2 gap-2">
      {options.map((option) => {
        const chosen = option.id === current.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={chosen}
            onClick={() => choose(option.id)}
            className={cn(
              "flex cursor-pointer flex-col gap-2 rounded-2xl bg-muted p-1.5 pb-2 text-start ring-1 ring-transparent transition-shadow outline-none hover:ring-border focus-visible:ring-2 focus-visible:ring-ring",
              chosen && "ring-2 ring-primary hover:ring-primary",
            )}
          >
            <Preview style={option.style} />
            <span className="flex items-center gap-1.5 px-1 text-sm font-medium">
              <span className="min-w-0 flex-1 truncate">{option.title}</span>
              {chosen ? <Icon icon={Tick02Icon} size={14} /> : null}
            </span>
            {option.plugin ? (
              <span className="-mt-1.5 truncate px-1 text-xs text-muted-foreground">
                {option.plugin}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
