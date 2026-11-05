"use client";

/**
 * rrule-builder — the recurrence control, a thin shell over `lib/rrule.ts`.
 * The rule string is the state: every control commits through `onChange`.
 */

import { ArrowLeft, ChevronDown, Repeat, SlidersHorizontal } from "@/components/kloq/lib/icons";
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { pad2 } from "../lib/date-math";
import {
  describeRRule,
  endOf,
  isExpressible,
  type PresetOptions,
  parseRRule,
  presetIdFor,
  presetsFor,
  type RRuleEnd,
  type RRuleFreq,
  type RRuleParts,
  type RRuleWeekday,
  serializeRRule,
  untilFromDate,
  WEEKDAY_CODES,
  weekdayCodeOf,
  withEnd,
} from "../lib/rrule";
import { useEscapeCapture } from "../lib/use-escape-capture";
import { cn } from "../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";
import { Popover, PopoverPopup } from "../ui/popover";
import { Radio, RadioGroup } from "../ui/radio-group";
import { SegmentedControl, SegmentedControlItem } from "../ui/segmented-control";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Separator } from "../ui/separator";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { GHOST_TRIGGER, ROW_H, RowValue } from "./panel-rows";

type MonthlyMode = "day" | "nth" | "last";

export const DEFAULT_COUNT = 10;

/** Which occurrence of its weekday `date` is, counting forward (1–5); never the `-1` reading. */
export const forwardNth = (date: Date): number => Math.ceil(date.getDate() / 7);

export const monthlyModeOf = (parts: RRuleParts): MonthlyMode => {
  const ordinal = parts.byDay?.[0]?.ordinal ?? parts.bySetPos?.[0];
  if (ordinal === undefined) return "day";
  return ordinal < 0 ? "last" : "nth";
};

const bare = (parts: RRuleParts): RRuleParts => {
  const next: RRuleParts = { ...parts };
  delete next.byDay;
  delete next.byMonthDay;
  delete next.byMonth;
  delete next.bySetPos;
  return next;
};

// `BYSETPOS` is never emitted: `isExpressible` rejects rules carrying both spellings.
export const setMonthlyMode = (parts: RRuleParts, mode: MonthlyMode, date: Date): RRuleParts => {
  const next = bare(parts);
  if (parts.byMonth?.length) next.byMonth = [...parts.byMonth];
  if (mode === "day") {
    next.byMonthDay = [date.getDate()];
    return next;
  }
  next.byDay = [
    {
      weekday: weekdayCodeOf(date),
      ordinal: mode === "last" ? -1 : forwardNth(date),
    },
  ];
  return next;
};

export const setFreq = (parts: RRuleParts, freq: RRuleFreq, date: Date): RRuleParts => {
  if (freq === parts.freq) return parts;
  const next = bare({ ...parts, freq });

  switch (freq) {
    case "DAILY":
      return next;
    case "WEEKLY":
      return { ...next, byDay: [{ weekday: weekdayCodeOf(date) }] };
    case "MONTHLY":
      return setMonthlyMode(next, carriedMode(parts), date);
    case "YEARLY":
      return setMonthlyMode({ ...next, byMonth: [date.getMonth() + 1] }, carriedMode(parts), date);
  }
};

const carriedMode = (parts: RRuleParts): MonthlyMode =>
  parts.freq === "MONTHLY" || parts.freq === "YEARLY" ? monthlyModeOf(parts) : "day";

export const defaultPartsFor = (date: Date): RRuleParts => ({
  freq: "WEEKLY",
  byDay: [{ weekday: weekdayCodeOf(date) }],
});

// Emptying BYDAY is a no-op: bare FREQ=WEEKLY repeats on the start day anyway.
export const toggleWeekday = (parts: RRuleParts, weekday: RRuleWeekday): RRuleParts => {
  const current = parts.byDay ?? [];
  const has = current.some((d) => d.weekday === weekday);
  if (has && current.length === 1) return parts;
  return {
    ...parts,
    byDay: has ? current.filter((d) => d.weekday !== weekday) : [...current, { weekday }],
  };
};

export const parseInterval = (raw: string): number | null => {
  if (!/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return n >= 1 && n <= 999 ? n : null;
};

export const parseCount = parseInterval;

export const defaultUntilDate = (date: Date, freq: RRuleFreq): Date => {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  const months = { DAILY: 1, WEEKLY: 3, MONTHLY: 12, YEARLY: 60 }[freq];
  out.setMonth(out.getMonth() + months);
  return out;
};

export const untilInputValue = (parts: RRuleParts): string => {
  const until = parts.until;
  if (!until) return "";
  return `${String(until.year).padStart(4, "0")}-${pad2(until.month)}-${pad2(until.day)}`;
};

// Parsed field-wise: `new Date("YYYY-MM-DD")` is UTC midnight, the previous day west of GMT.
export const dateFromInputValue = (value: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
};

const ORDINAL_WORDS = ["first", "second", "third", "fourth", "fifth"] as const;

const MONTH_ITEMS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
].map((label, i) => ({ value: String(i + 1), label }));

const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"] as const;
const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const END_OPTIONS = [
  { key: "never", label: "Never" },
  { key: "until", label: "On date" },
  { key: "count", label: "After" },
] as const;

function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className={cn(ROW_H, "flex w-12 shrink-0 items-center text-2xs text-muted-foreground")}>
        {label}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">{children}</div>
    </div>
  );
}

export interface RRuleBuilderProps {
  /** The event's `RRULE` (no `RRULE:` prefix needed), or absent for none. */
  value?: string;
  /** The event's start — the anchor preset labels and default by-parts derive from. */
  date: Date;
  /** Commit. `undefined` clears recurrence entirely. */
  onChange: (rule: string | undefined) => void;
  /** Renders the summary as static text with no controls. */
  readOnly?: boolean;
  /** Forwarded to `describeRRule` / `presetsFor` for non-en-US hosts. */
  describeOptions?: PresetOptions;
  /** Lets the panel focus the trigger after revealing the row. */
  triggerRef?: RefObject<HTMLButtonElement | null>;
  /** The surface the custom editor opens beside, so it does not cover its host; default the trigger. */
  hostRef?: RefObject<HTMLElement | null>;
  /** Where the custom editor renders in place when the host is a bottom sheet with no side to open on. */
  inlineSlot?: RefObject<HTMLElement | null>;
  className?: string;
}

export function RRuleBuilder({
  value,
  date,
  onChange,
  readOnly = false,
  describeOptions,
  triggerRef,
  hostRef,
  inlineSlot,
  className,
}: RRuleBuilderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [beside, setBeside] = useState<HTMLElement | null>(null);
  const [inline, setInline] = useState<HTMLElement | null>(null);
  const inlineRef = useRef<HTMLDivElement>(null);
  const [monthOpen, setMonthOpen] = useState(false);
  const [typing, setTyping] = useState<{ interval?: string; count?: string }>({});
  const ownRef = useRef<HTMLButtonElement>(null);
  const anchorRef = triggerRef ?? ownRef;
  const customClosedAt = useRef(0);

  // `date` is re-created by the caller per render, so memos key on its epoch value
  const dateMs = date.getTime();
  const parts = useMemo(() => (value ? parseRRule(value) : null), [value]);
  const editable = !value || (parts !== null && isExpressible(parts));
  const summary = useMemo(
    () =>
      value
        ? describeRRule(value, describeOptions)
        : (describeOptions?.noneLabel ?? "Does not repeat"),
    [value, describeOptions],
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const presets = useMemo(() => presetsFor(date, describeOptions), [dateMs, describeOptions]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const activeId = useMemo(() => presetIdFor(value ?? null, date), [value, dateMs]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const current = useMemo(() => parts ?? defaultPartsFor(date), [parts, dateMs]);
  const liveSummary = useMemo(
    () => describeRRule(current, describeOptions),
    [current, describeOptions],
  );

  const commit = (next: RRuleParts) => onChange(serializeRRule(next));
  const monthlyMode = monthlyModeOf(current);

  const showCustom = () => {
    const host = hostRef?.current;
    // a host that spans the viewport (the sheet) has no side to open on: edit inside it
    const sheet = host?.dataset.sheet !== undefined;
    setBeside(host && !sheet ? host : null);
    setInline(sheet ? (inlineSlot?.current ?? null) : null);
    setCustomOpen(true);
  };
  useEffect(() => {
    if (customOpen && inline) inlineRef.current?.querySelector("button")?.focus();
  }, [customOpen, inline]);
  const closeCustom = () => {
    customClosedAt.current = performance.now();
    setCustomOpen(false);
  };

  // capture phase, to beat the panel's own Escape; the month select answers its own
  useEscapeCapture(customOpen && !monthOpen, () => {
    closeCustom();
    anchorRef.current?.focus();
  });

  // a rule the builder can't round-trip is shown read-only, never rewritten
  if (readOnly || !editable) {
    return (
      <RowValue className={className}>
        <Repeat aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{summary}</span>
        {!editable ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge variant="secondary" size="sm" tabIndex={0}>
                  Custom rule
                </Badge>
              }
            />
            <TooltipPopup>{value}</TooltipPopup>
          </Tooltip>
        ) : null}
      </RowValue>
    );
  }

  const end = endOf(current);
  const setEnd = (next: RRuleEnd) => commit(withEnd(current, next));

  // nothing is written until a control changes or Done confirms the default
  const openCustom = () => {
    setMenuOpen(false);
    showCustom();
  };

  const interval = current.interval ?? 1;
  const anchorWeekday = WEEKDAY_NAMES[date.getDay()];
  const nthWord = ORDINAL_WORDS[forwardNth(date) - 1] ?? "fifth";
  const weekdays = (current.byDay ?? []).map((d) => d.weekday);
  const custom = presets.find((p) => p.id === "custom");

  const FREQ_OPTIONS = [
    { key: "DAILY", label: interval === 1 ? "day" : "days" },
    { key: "WEEKLY", label: interval === 1 ? "week" : "weeks" },
    { key: "MONTHLY", label: interval === 1 ? "month" : "months" },
    { key: "YEARLY", label: interval === 1 ? "year" : "years" },
  ] as const;

  const editor = (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="xs"
          className="-ms-1.5 font-normal text-muted-foreground"
          onClick={() => {
            setCustomOpen(false);
            setMenuOpen(true);
          }}
        >
          <ArrowLeft />
          Back
        </Button>
        <span className="font-medium text-sm">Custom recurrence</span>
      </div>

      <Row label="Every">
        <Input
          size="xs"
          inputMode="numeric"
          aria-label="Repeat interval"
          className="w-12 shrink-0"
          value={typing.interval ?? String(interval)}
          onChange={(e) => {
            const raw = e.target.value;
            setTyping((t) => ({ ...t, interval: raw }));
            const n = parseInterval(raw);
            if (n !== null) commit({ ...current, interval: n });
          }}
          onBlur={() => setTyping((t) => ({ ...t, interval: undefined }))}
        />
        <SegmentedControl
          size="xs"
          aria-label="Repeat unit"
          fill
          value={current.freq}
          onValueChange={(freq) => commit(setFreq(current, freq as RRuleFreq, date))}
        >
          {FREQ_OPTIONS.map((o) => (
            <SegmentedControlItem key={o.key} value={o.key}>
              {o.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </Row>

      {current.freq === "WEEKLY" ? (
        <Row label="On">
          <ToggleGroup
            multiple
            size="xs"
            variant="outline"
            aria-label="Repeat on"
            fill
            value={weekdays}
            onValueChange={(next) => {
              const changed = WEEKDAY_CODES.find(
                (code) => weekdays.includes(code) !== next.includes(code),
              );
              if (changed) commit(toggleWeekday(current, changed));
            }}
          >
            {WEEKDAY_CODES.map((code, i) => (
              <ToggleGroupItem key={code} value={code} aria-label={WEEKDAY_NAMES[i]}>
                {WEEKDAY_INITIALS[i]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Row>
      ) : null}

      {current.freq === "YEARLY" ? (
        <Row label="In">
          <Select
            items={MONTH_ITEMS}
            value={String((current.byMonth ?? [])[0] ?? date.getMonth() + 1)}
            onValueChange={(m) => commit({ ...current, byMonth: [Number(m)] })}
            onOpenChange={setMonthOpen}
          >
            <SelectTrigger size="xs" aria-label="Month">
              <SelectValue />
            </SelectTrigger>
            <SelectPopup size="xs">
              {MONTH_ITEMS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </Row>
      ) : null}

      {current.freq === "MONTHLY" || current.freq === "YEARLY" ? (
        <Row label="On">
          <RadioGroup
            aria-label="Repeat on"
            className="flex-1 gap-0"
            value={monthlyMode}
            onValueChange={(mode) => commit(setMonthlyMode(current, mode as MonthlyMode, date))}
          >
            {(
              [
                ["day", `Day ${date.getDate()}`],
                ["nth", `The ${nthWord} ${anchorWeekday}`],
                ["last", `The last ${anchorWeekday}`],
              ] as const
            ).map(([mode, label]) => (
              <Label key={mode} className={cn(ROW_H, "gap-2 font-normal text-sm sm:text-xs")}>
                <Radio value={mode} />
                {label}
              </Label>
            ))}
          </RadioGroup>
        </Row>
      ) : null}

      {/* routed through withEnd so COUNT/UNTIL stay exclusive */}
      <Row label="Ends">
        <SegmentedControl
          size="xs"
          aria-label="Ends"
          fill
          value={end.type}
          onValueChange={(key) => {
            if (key === "never") return setEnd({ type: "never" });
            if (key === "count")
              return setEnd({
                type: "count",
                count: current.count ?? DEFAULT_COUNT,
              });
            setEnd({
              type: "until",
              until: current.until ?? untilFromDate(defaultUntilDate(date, current.freq)),
            });
          }}
        >
          {END_OPTIONS.map((o) => (
            <SegmentedControlItem key={o.key} value={o.key}>
              {o.label}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </Row>

      {end.type === "until" ? (
        <Row>
          <Input
            type="date"
            size="xs"
            aria-label="Repeat until"
            min={untilInputValue({ ...current, until: untilFromDate(date) })}
            value={untilInputValue(current)}
            onChange={(e) => {
              const picked = dateFromInputValue(e.target.value);
              if (!picked) return;
              setEnd({ type: "until", until: untilFromDate(picked) });
            }}
          />
        </Row>
      ) : null}

      {end.type === "count" ? (
        <Row>
          <Input
            size="xs"
            inputMode="numeric"
            aria-label="Number of occurrences"
            className="w-14 shrink-0"
            value={typing.count ?? String(end.count)}
            onChange={(e) => {
              const raw = e.target.value;
              setTyping((t) => ({ ...t, count: raw }));
              const n = parseCount(raw);
              if (n !== null) setEnd({ type: "count", count: n });
            }}
            onBlur={() => setTyping((t) => ({ ...t, count: undefined }))}
          />
          <span className="text-2xs text-muted-foreground">
            {end.count === 1 ? "occurrence" : "occurrences"}
          </span>
        </Row>
      ) : null}

      <Separator />

      <div className="flex items-center gap-2">
        <Repeat aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <p aria-live="polite" className="min-w-0 flex-1 truncate text-xs text-foreground">
          {liveSummary}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="xs"
          className="-ms-1.5 font-normal text-muted-foreground hover:text-destructive-foreground"
          onClick={() => {
            onChange(undefined);
            closeCustom();
            anchorRef.current?.focus();
          }}
        >
          Remove recurrence
        </Button>
        <Button
          size="xs"
          onClick={() => {
            if (!parts) commit(current);
            closeCustom();
            anchorRef.current?.focus();
          }}
        >
          Done
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <Menu
        open={menuOpen}
        onOpenChange={(next) => {
          if (!next) return setMenuOpen(false);
          // the press that closed the custom page must not reopen it
          if (performance.now() - customClosedAt.current < 250) return;
          if (activeId === "custom") showCustom();
          else setMenuOpen(true);
        }}
      >
        <MenuTrigger
          ref={anchorRef}
          aria-label={`Recurrence — ${summary}`}
          className={cn(
            GHOST_TRIGGER,
            customOpen && "border-input bg-background dark:bg-input/32",
            className,
          )}
        >
          <Repeat aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-foreground">{summary}</span>
          <ChevronDown
            aria-hidden
            className={cn(
              "size-3 shrink-0 text-muted-foreground transition-transform duration-(--overlay-enter) group-data-popup-open:rotate-180 motion-reduce:transition-none",
              customOpen && "rotate-180",
            )}
          />
        </MenuTrigger>
        <MenuPopup align="start" className="w-60">
          <MenuRadioGroup
            value={activeId ?? ""}
            onValueChange={(id) => {
              const preset = presets.find((p) => p.id === id);
              if (preset) onChange(preset.rule ?? undefined);
            }}
          >
            {presets
              .filter((p) => p.id !== "custom")
              .map((p) => (
                <MenuRadioItem key={p.id} value={p.id} closeOnClick>
                  {p.label}
                </MenuRadioItem>
              ))}
          </MenuRadioGroup>
          <MenuSeparator />
          <MenuItem onClick={openCustom}>
            <SlidersHorizontal />
            {custom?.label ?? "Custom…"}
          </MenuItem>
        </MenuPopup>
      </Menu>

      {customOpen && inline
        ? createPortal(
            <div
              ref={inlineRef}
              role="group"
              aria-label="Custom recurrence"
              className="rounded-lg border bg-popover p-3 text-popover-foreground"
            >
              {editor}
            </div>,
            inline,
          )
        : null}

      <Popover
        open={customOpen && !inline}
        onOpenChange={(next) => (next ? showCustom() : closeCustom())}
      >
        <PopoverPopup
          anchor={beside ?? anchorRef}
          side="right"
          align={beside ? "start" : "center"}
          sideOffset={beside ? 8 : 12}
          collisionAvoidance={{ side: "flip", align: "shift" }}
          finalFocus={anchorRef}
          aria-label="Custom recurrence"
          className="w-80 max-w-(--available-width)"
        >
          {editor}
        </PopoverPopup>
      </Popover>
    </>
  );
}
