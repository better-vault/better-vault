"use client";

import * as React from "react";
import { contrastRatio, mixOklab, type RGB } from "../lib/color";
import {
  EVENT_COLOR_KEYS,
  EVENT_COLORS,
  EVENT_INK_MIX,
  parseInk,
  parseTint,
} from "../lib/event-palette";
import {
  getScheme,
  getTheme,
  type KloqScheme,
  resolveScheme,
  setScheme,
  setTheme,
  THEMES,
} from "../lib/themes";
import { cn } from "../lib/utils";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { useDesignMode } from "./design-mode-provider";
import { Row, Section, Segmented } from "./panel";
import { composite, hex, pageBackground, resolveColor } from "./resolve-color";

const SCHEMES: { value: KloqScheme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "Auto" },
];

const FAMILY_LABELS = {
  coss: "Kloq originals",
  editor: "Editor ports",
  saas: "SaaS looks",
} as const;

const TOKENS = [
  "background",
  "foreground",
  "primary",
  "accent",
  "muted-foreground",
  "border",
] as const;

/** Re-render whenever the theme or scheme attributes on <html> change. */
function useThemeVersion(): number {
  const [v, bump] = React.useReducer((n: number) => n + 1, 0);
  React.useEffect(() => {
    const mo = new MutationObserver(bump);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-kloq-theme", "data-theme"],
    });
    return () => mo.disconnect();
  }, []);
  return v;
}

type Scope = HTMLElement | null;

function readVar(name: string, scope: Scope): string {
  const root =
    scope ?? document.querySelector<HTMLElement>("[data-kloq-root]") ?? document.documentElement;
  return getComputedStyle(root).getPropertyValue(name).trim();
}

interface EventScore {
  color: string;
  bg: RGB | null;
  text: RGB | null;
  ratio: number;
}

function scoreEvents(scope: Scope): EventScore[] {
  const scheme = resolveScheme();
  const page = pageBackground(scope);
  const fg = resolveColor(readVar("--foreground", scope));
  return EVENT_COLOR_KEYS.map((color) => {
    const tint = parseTint(EVENT_COLORS[color].tint)[scheme].rest;
    const ramp = resolveColor(readVar(`--color-${tint.ramp}`, scope));
    const ink = resolveColor(
      readVar(`--color-${parseInk(EVENT_COLORS[color].ink)[scheme]}`, scope),
    );
    const bg = ramp ? composite({ ...ramp, a: tint.alpha }, page) : null;
    const text = ink && fg ? mixOklab({ ...ink, a: 1 }, { ...fg, a: 1 }, EVENT_INK_MIX) : null;
    return { color, bg, text, ratio: bg && text ? contrastRatio(text, bg) : 0 };
  });
}

export function ThemeSection() {
  const { scopeRef } = useDesignMode();
  const [scope, setScope] = React.useState<Scope>(null);
  React.useEffect(() => setScope(scopeRef?.current ?? null), [scopeRef]);
  useThemeVersion();
  const [, force] = React.useReducer((n: number) => n + 1, 0);
  const active = typeof document === "undefined" ? "coss" : getTheme();
  const scheme = getScheme();
  const theme = THEMES.find((t) => t.id === active);
  const page = typeof document === "undefined" ? null : pageBackground(scope);
  const tokens =
    typeof document === "undefined"
      ? []
      : TOKENS.map((t) => {
          const c = resolveColor(readVar(`--${t}`, scope));
          const a = c?.a ?? 1;
          return [t, c && page && a < 1 ? composite(c, page) : c, a] as const;
        });
  const scores = typeof document === "undefined" ? [] : scoreEvents(scope);
  const worst = scores.reduce((m, s) => Math.min(m, s.ratio), Infinity);

  return (
    <Section
      id="theme"
      title="Theme"
      summary={`${theme?.name ?? active} · ${resolveScheme(scheme)}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-sans text-xs">Appearance</span>
        <Segmented
          label="Color scheme"
          value={scheme}
          options={SCHEMES}
          onChange={(s) => {
            setScheme(s);
            force();
          }}
        />
      </div>
      {(["coss", "editor", "saas"] as const).map((family) => (
        <div key={family} className="flex flex-col gap-1">
          <span className="font-sans text-3xs uppercase tracking-wide text-muted-foreground">
            {FAMILY_LABELS[family]}
          </span>
          <ToggleGroup
            size="xs"
            aria-label={FAMILY_LABELS[family]}
            className="w-full flex-wrap"
            value={[active]}
            onValueChange={(v) => {
              const next = v.find((id) => id !== active);
              if (!next) return;
              setTheme(next);
              force();
            }}
          >
            {THEMES.filter((t) => t.family === family).map((t) => (
              <ToggleGroupItem key={t.id} value={t.id} title={t.credit}>
                <span
                  aria-hidden
                  className="relative size-3 shrink-0 overflow-hidden rounded-full border border-border"
                  style={{ background: t.swatch[0] }}
                >
                  <span
                    className="absolute inset-y-0 end-0 w-1/2"
                    style={{ background: t.swatch[1] }}
                  />
                  <span
                    className="absolute bottom-0 end-0 h-1/2 w-1/4"
                    style={{ background: t.swatch[2] }}
                  />
                </span>
                {t.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ))}
      <div className="flex flex-col gap-1 border-t pt-2">
        {tokens.map(([name, c, a]) => (
          <Row
            key={name}
            label={
              <span className="flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-sm border border-border"
                  style={{ background: hex(c) }}
                />
                --{name}
              </span>
            }
          >
            {hex(c)}
            {a < 1 ? ` · ${Math.round(a * 100)}%` : ""}
          </Row>
        ))}
      </div>
      <div className="flex flex-col gap-1 border-t pt-2">
        <div className="flex items-baseline justify-between">
          <span className="font-sans text-xs font-medium">Event text contrast</span>
          <span
            className={cn(
              "tabular-nums",
              worst < 4.5 ? "text-destructive-foreground" : "text-muted-foreground",
            )}
          >
            worst {Number.isFinite(worst) ? worst.toFixed(2) : "—"}:1
          </span>
        </div>
        {scores.map((s) => (
          <div key={s.color} className="flex items-center gap-2">
            <span
              className="flex h-5 w-20 items-center rounded-md px-1.5 font-sans text-2xs font-medium"
              style={{ background: hex(s.bg), color: hex(s.text) }}
            >
              {s.color}
            </span>
            <span
              className={cn("ms-auto tabular-nums", s.ratio < 4.5 && "text-destructive-foreground")}
            >
              {s.ratio.toFixed(2)}:1 {s.ratio >= 7 ? "AAA" : s.ratio >= 4.5 ? "AA" : "fail"}
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}
