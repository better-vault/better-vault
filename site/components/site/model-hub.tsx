import Image from "next/image";

/*
 * The providers flowing into better-vault: a tile per provider along the top,
 * a curved line from each down to the hub, and a pulse of colour running
 * along each line toward it. Drawn in a 1000 × 480 box; the tiles are HTML
 * placed at the same coordinates (as percentages) so they stay crisp and
 * accessible, and the lines are one SVG underneath them.
 *
 * The provider marks are in public/providers (see its README). A mark with a
 * `dark` file swaps to it in dark mode; the others read on both.
 */

interface Provider {
  name: string;
  kind: string;
  /** The mark for light mode, and for dark mode when it differs. */
  logo: string;
  logoDark?: string;
  /** The pulse colour, from the chart ramp. */
  stroke: string;
}

const PROVIDERS: Provider[] = [
  {
    name: "Google Gemini",
    kind: "API key",
    logo: "/providers/gemini.svg",
    stroke: "stroke-chart-2",
  },
  {
    name: "OpenAI",
    kind: "API key",
    logo: "/providers/openai-light.svg",
    logoDark: "/providers/openai-dark.svg",
    stroke: "stroke-chart-3",
  },
  {
    name: "Anthropic Claude",
    kind: "API key",
    logo: "/providers/claude.svg",
    stroke: "stroke-chart-4",
  },
  {
    name: "Ollama",
    kind: "Local",
    logo: "/providers/ollama-light.svg",
    logoDark: "/providers/ollama-dark.svg",
    stroke: "stroke-chart-5",
  },
  {
    name: "LM Studio",
    kind: "Local",
    logo: "/providers/lmstudio-light.svg",
    logoDark: "/providers/lmstudio-dark.svg",
    stroke: "stroke-chart-2",
  },
];

const W = 1000;
const H = 480;
const TILE_Y = 92;
const HUB = { x: 500, y: 382 };

const xOf = (i: number) => 100 + i * 200;

/** From under a tile, down and in to the top of the hub. */
function curve(i: number) {
  const x = xOf(i);
  const endX = HUB.x + (x - HUB.x) * 0.1;
  // Below the tile and its two-line label.
  const startY = TILE_Y + 92;
  const endY = HUB.y - 54;
  return `M ${x} ${startY} C ${x} ${startY + 100}, ${endX} ${endY - 90}, ${endX} ${endY}`;
}

function Logo({ p, className }: { p: Provider; className: string }) {
  return (
    <>
      <Image
        src={p.logo}
        alt=""
        width={40}
        height={40}
        unoptimized
        className={`${className} object-contain ${p.logoDark ? "dark:hidden" : ""}`}
      />
      {p.logoDark ? (
        <Image
          src={p.logoDark}
          alt=""
          width={40}
          height={40}
          unoptimized
          className={`${className} hidden object-contain dark:block`}
        />
      ) : null}
    </>
  );
}

function Hub({ className }: { className: string }) {
  return (
    <span
      className={`flex items-center justify-center rounded-2xl border bg-background shadow-sm ring-4 ring-muted ${className}`}
    >
      <Image
        src="/brand/logo-light-transparent.png"
        alt=""
        width={48}
        height={48}
        className="size-1/2 dark:hidden"
      />
      <Image
        src="/brand/logo-dark-transparent.png"
        alt=""
        width={48}
        height={48}
        className="hidden size-1/2 dark:block"
      />
    </span>
  );
}

const PANEL =
  "relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border bg-card [background-image:radial-gradient(var(--color-border)_1px,transparent_1px)] [background-size:18px_18px]";

export function ModelHub() {
  return (
    <>
      {/* Phones: the providers in a grid, then the hub they feed. */}
      <div className={`${PANEL} flex flex-col items-center gap-5 p-5 sm:hidden`}>
        <ul
          className="flex w-full flex-wrap justify-center gap-y-4"
          aria-label="Providers better-vault works with"
        >
          {PROVIDERS.map((p) => (
            <li key={p.name} className="flex w-1/3 flex-col items-center gap-1.5 px-1 text-center">
              <span className="flex size-12 items-center justify-center rounded-xl border bg-background shadow-xs">
                <Logo p={p} className="size-6" />
              </span>
              <span className="text-xs leading-tight font-medium">
                {p.name}
                <span className="block text-muted-foreground">{p.kind}</span>
              </span>
            </li>
          ))}
        </ul>
        <span aria-hidden="true" className="h-8 w-px bg-border" />
        <span className="flex flex-col items-center gap-1.5">
          <Hub className="size-16" />
          <span className="text-sm font-semibold">better-vault</span>
        </span>
      </div>

      <div className={`${PANEL} hidden sm:block`}>
        <div className="relative aspect-[1000/480] w-full">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="absolute inset-0 size-full"
            aria-hidden="true"
            fill="none"
          >
            {PROVIDERS.map((p, i) => (
              <path key={`line-${p.name}`} d={curve(i)} className="stroke-border" strokeWidth={2} />
            ))}
            {PROVIDERS.map((p, i) => (
              <path
                key={`pulse-${p.name}`}
                d={curve(i)}
                pathLength={1000}
                className={`model-hub-pulse ${p.stroke} ${p.stroke.replace("stroke-", "text-")}`}
                strokeWidth={3}
                strokeLinecap="round"
                style={{ animationDelay: `${i * 0.45}s` }}
              />
            ))}
          </svg>

          <ul className="absolute inset-0" aria-label="Providers better-vault works with">
            {PROVIDERS.map((p, i) => (
              <li
                key={p.name}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
                style={{ left: `${(xOf(i) / W) * 100}%`, top: `${(TILE_Y / H) * 100}%` }}
              >
                <span className="flex size-[clamp(2.5rem,8vw,4.5rem)] items-center justify-center rounded-xl border bg-background shadow-xs">
                  <Logo p={p} className="size-[48%]" />
                </span>
                <span className="text-center text-[clamp(0.625rem,1.4vw,0.8125rem)] leading-tight font-medium whitespace-nowrap">
                  {p.name}
                  <span className="block text-muted-foreground">{p.kind}</span>
                </span>
              </li>
            ))}
          </ul>

          <div
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5"
            style={{ left: `${(HUB.x / W) * 100}%`, top: `${(HUB.y / H) * 100}%` }}
          >
            <Hub className="size-[clamp(3rem,10vw,5.5rem)]" />
            <span className="text-[clamp(0.6875rem,1.5vw,0.875rem)] font-semibold">
              better-vault
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
