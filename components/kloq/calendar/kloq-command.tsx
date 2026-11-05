"use client";

/**
 * kloq-command — the ⌘K menu: grouped actions, quick add, whole-store event
 * search, and nested Go to date… / Set theme… pickers.
 */

import {
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CalendarPlus,
  CalendarSearch,
  Check,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  MonitorSmartphone,
  Moon,
  Palette,
  PenTool,
  RotateCcw,
  Search,
  Sun,
} from "@/components/kloq/lib/icons";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useDesignMode } from "../design-mode";
import { newEventCalendarId } from "../lib/calendar-sources";
import {
  addDays,
  type CalEvent,
  formatInstant,
  type KloqView,
  toDateOnlyString,
} from "../lib/calendar-types";
import {
  type CommandGroupModel,
  canEditEvent,
  commandAllowed,
  DEFAULT_COMMAND_GROUP,
  dayJumps,
  groupCommands,
  matchesQuery,
  movePatch,
} from "../lib/command-model";
import { getCommands, type KloqCommand, subscribeCommands } from "../lib/command-registry";
import { formatEventWhen, searchEvents } from "../lib/event-search";
import { eventTitle } from "../lib/event-text";
import { displayKey, type KeyActionId, type Keymap, resolveKeymap } from "../lib/keymap";
import { parseQuickAdd } from "../lib/quick-add";
import { quickAddPreview } from "../lib/quick-add-view";
import {
  applyPlan,
  editOccurrence,
  masterIdOf,
  type Occurrence,
  occurrenceAt,
} from "../lib/recurrence";
import { getTheme, resolveScheme, setScheme, setTheme, THEMES } from "../lib/themes";
import { useLatest } from "../lib/use-latest";
import { Button } from "../ui/button";
import {
  Command,
  CommandCollection,
  CommandDialog,
  CommandDialogPopup,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
import { VIEW_META } from "./context-menu-shared";
import { KbdKeys } from "./kbd-keys";
import { MoveToInput } from "./move-to-input";
import { QuickAddInput } from "./quick-add-input";
import { useKloqSettings } from "./settings-context";
import { useKloqStore } from "./store-context";
import { useRecurrenceScope } from "./use-recurrence-scope";

/** Default length of an event created from ⌘K, matching quick-create. */
export const DEFAULT_QUICK_ADD_MIN = 30;

interface Action {
  id: string;
  /** What the filter matches against — label plus synonyms. */
  search: string;
  label: string;
  /** Muted secondary line: an event's date, a preset's resolved day. */
  meta?: string;
  hint?: string | readonly string[];
  icon?: ReactNode;
  group: string;
  order?: number;
  checked?: boolean;
  disabled?: boolean;
  /** Already derived from the query — never filter it out again. */
  always?: boolean;
  /** Opens a nested picker: renders a chevron and keeps the dialog open. */
  nested?: boolean;
  /** Acts immediately but leaves the dialog open — a live preview toggle. */
  keepOpen?: boolean;
  run: () => void;
}

type MenuMode = "commands" | "quick-add" | "move-to" | "date" | "theme";

interface KloqCommandMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  days: Date[];
  namesLong: string[];
  viewSetting: KloqView;
  onSwitchView: (view: KloqView) => void;
  onJumpToDay: (date: Date) => void;
  onToday: () => void;
  /** Step the visible range by its own unit; omit and the two rows don't appear. */
  onStepRange?: (dir: -1 | 1) => void;
  onQuickCreate: () => void;
  onReset: () => void;
  onShortcuts: () => void;
  /** The whole store, not the visible projection — search spans every event. */
  events?: CalEvent[];
  /** Navigate to and select an event; without it, results are inert. */
  onSelectEvent?: (event: CalEvent) => void;
  /** Length of a quick-added event when the text doesn't say. */
  defaultDurationMin?: number;
  /** The currently selected event; enables "Move to…". */
  selectedEvent?: CalEvent | null;
  /** Selected occurrence of a recurring series; scoped "Move to…" falls back to the first. */
  selectedOccurrence?: Occurrence | null;
  /** Keymap overrides so key hints show the real bindings. */
  keymap?: Keymap;
  /** Built-in allowlist (see `BUILT_IN_COMMANDS`); omit for all. Registered commands always show. */
  commands?: readonly string[];
}

const DAY_LABEL = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const DAY_LABEL_YEAR = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});
const dayLabel = (date: Date, now: Date): string =>
  (date.getFullYear() === now.getFullYear() ? DAY_LABEL : DAY_LABEL_YEAR).format(date);

const DATE_PRESETS: [string, string][] = [
  ["today", "Today"],
  ["tomorrow", "Tomorrow"],
  ["yesterday", "Yesterday"],
  ["next monday", "Next Monday"],
  ["next week", "Next week"],
];

export function KloqCommandMenu(props: KloqCommandMenuProps) {
  return (
    <CommandDialog open={props.open} onOpenChange={props.onOpenChange}>
      <CommandDialogPopup aria-label="Command menu">
        <CommandMenuBody {...props} />
      </CommandDialogPopup>
    </CommandDialog>
  );
}

/** Mounted only while the popup is: a closed menu builds nothing. */
function CommandMenuBody({
  onOpenChange,
  days,
  namesLong,
  viewSetting,
  onSwitchView,
  onJumpToDay,
  onToday,
  onStepRange,
  onQuickCreate,
  onReset,
  onShortcuts,
  events,
  onSelectEvent,
  defaultDurationMin = DEFAULT_QUICK_ADD_MIN,
  selectedEvent,
  selectedOccurrence,
  keymap,
  commands,
}: KloqCommandMenuProps) {
  const { toggle: toggleDesignMode } = useDesignMode();
  const store = useKloqStore();
  const g = useKloqSettings();
  const askScope = useRecurrenceScope();

  const [mode, setMode] = useState<MenuMode>("commands");
  const [query, setQuery] = useState("");
  const [quickValue, setQuickValue] = useState("");
  const [moveValue, setMoveValue] = useState("");
  const [isDark, setIsDark] = useState(() => resolveScheme() === "dark");
  const [themeId, setThemeId] = useState(getTheme);
  const [now] = useState(() => new Date());

  const [registered, setRegistered] = useState<KloqCommand[]>(getCommands);
  useEffect(() => subscribeCommands(() => setRegistered(getCommands())), []);

  // read through a ref so a host passing inline callbacks never rebuilds the action list
  const cb = useLatest({
    onOpenChange,
    onSwitchView,
    onJumpToDay,
    onToday,
    onStepRange,
    onQuickCreate,
    onReset,
    onShortcuts,
    onSelectEvent,
    toggleDesignMode,
  });
  const close = () => cb.current.onOpenChange(false);
  // first render, before the input autofocuses: the calendar this menu was opened from
  const [root] = useState<ParentNode>(
    () => document.activeElement?.closest("[data-kloq-root]") ?? document,
  );
  // the palette restores focus to where it came from unless focus has moved on; a command that
  // selects an event moves it to that event's block
  const selectEvent = (e: CalEvent) => {
    cb.current.onSelectEvent?.(e);
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        root
          .querySelector<HTMLElement>('[data-cal-event][data-selected="true"]')
          ?.focus({ preventScroll: true }),
      ),
    );
  };

  const movable = selectedEvent && canEditEvent(selectedEvent) ? selectedEvent : null;
  const canStep = Boolean(onStepRange);
  const canSelect = Boolean(onSelectEvent);

  const parsed = useMemo(
    () => parseQuickAdd(quickValue, now, { defaultDurationMin }),
    [quickValue, now, defaultDurationMin],
  );

  const commitQuickAdd = () => {
    const r = parsed;
    if (!r.start || !r.end) return;
    const preview = quickAddPreview(r, now);
    const calendarId = newEventCalendarId();
    const base = {
      id: g.makeId(),
      title: preview.title,
      ...(calendarId ? { calendarId } : {}),
      ...(r.location ? { location: r.location } : {}),
      ...(r.attendees.length ? { attendees: r.attendees.map((email) => ({ email })) } : {}),
    };
    // the parser's all-day `end` is inclusive; the store's is exclusive
    const event: CalEvent = r.allDay
      ? {
          ...base,
          allDay: true,
          start: toDateOnlyString(r.start),
          end: toDateOnlyString(addDays(r.end, 1)),
        }
      : {
          ...base,
          start: formatInstant(r.start),
          end: formatInstant(r.end),
        };
    store.add(event);
    close();
    selectEvent(event);
  };

  const openQuickAdd = (seed: string) => {
    setQuickValue(seed);
    setMode("quick-add");
  };

  const run = (a: Action) => {
    if (a.disabled) return;
    // close first so the action never animates behind a closing sheet
    if (!a.nested && !a.keepOpen) close();
    a.run();
  };

  const movableTitle = movable ? eventTitle(movable) : null;

  const staticActions = useMemo<Action[]>(() => {
    const bound = resolveKeymap(keymap).byAction;
    const hintFor = (id: KeyActionId): string | undefined => {
      const key = bound[id];
      return key ? displayKey(key) : undefined;
    };
    const out: Action[] = [
      {
        id: "new-event",
        search: "new event create",
        label: "New event",
        hint: hintFor("create"),
        icon: <CalendarPlus />,
        group: "Calendar",
        order: 0,
        run: () => cb.current.onQuickCreate(),
      },
      {
        id: "quick-add",
        search: "quick add natural language parse",
        label: "Quick add…",
        meta: "Type “lunch tomorrow 1pm”",
        icon: <CalendarClock />,
        group: "Calendar",
        order: 1,
        nested: true,
        run: () => openQuickAdd(""),
      },
      {
        id: "reset",
        search: "reset sample events restore",
        label: "Reset sample events",
        icon: <RotateCcw />,
        group: "Calendar",
        order: 3,
        run: () => cb.current.onReset(),
      },
      {
        id: "today",
        search: "go to today now",
        label: "Go to today",
        hint: hintFor("today"),
        icon: <CalendarDays />,
        group: "Navigation",
        order: 0,
        run: () => cb.current.onToday(),
      },
      {
        id: "go-to-date",
        search: "go to date jump picker calendar",
        label: "Go to date…",
        icon: <CalendarSearch />,
        group: "Navigation",
        order: 1,
        nested: true,
        run: () => {
          setQuery("");
          setMode("date");
        },
      },
    ];
    if (movableTitle !== null)
      out.push({
        id: "move-to",
        search: "move to reschedule shift event",
        label: `Move “${movableTitle}” to…`,
        meta: "“next tuesday”, “3pm”, “+2h”",
        icon: <CalendarClock />,
        group: "Calendar",
        order: 2,
        nested: true,
        run: () => {
          setMoveValue("");
          setMode("move-to");
        },
      });
    if (canStep)
      out.push(
        {
          id: "range:prev",
          search: "previous range back week day month earlier",
          label: "Previous range",
          hint: "←",
          icon: <ChevronLeft />,
          group: "Navigation",
          order: 100,
          run: () => cb.current.onStepRange?.(-1),
        },
        {
          id: "range:next",
          search: "next range forward week day month later",
          label: "Next range",
          hint: "→",
          icon: <ChevronRight />,
          group: "Navigation",
          order: 101,
          run: () => cb.current.onStepRange?.(1),
        },
      );
    dayJumps(days).forEach((d, i) => {
      out.push({
        id: `jump:${d.toDateString()}`,
        search: `jump ${namesLong[i] ?? ""} ${d.getDate()} ${dayLabel(d, now)}`,
        label: `Jump to ${namesLong[i] ?? ""} ${d.getDate()}`,
        icon: <CalendarDays />,
        group: "Navigation",
        order: 2 + i,
        run: () => cb.current.onJumpToDay(d),
      });
    });
    VIEW_META.forEach(({ key, command: label, action, icon: Icon }, order) => {
      out.push({
        id: `view:${String(key)}`,
        search: `view ${label}`,
        label,
        hint: hintFor(action),
        icon: <Icon />,
        group: "View",
        order,
        checked: key === viewSetting,
        run: () => cb.current.onSwitchView(key),
      });
    });
    out.push(
      {
        id: "scheme:toggle",
        search: `appearance ${isDark ? "light" : "dark"} mode theme`,
        label: `Switch to ${isDark ? "light" : "dark"} mode`,
        icon: isDark ? <Sun /> : <Moon />,
        group: "Appearance",
        order: 0,
        run: () => setScheme(isDark ? "light" : "dark"),
      },
      {
        id: "scheme:system",
        search: "appearance system mode follow os",
        label: "Match system appearance",
        icon: <MonitorSmartphone />,
        group: "Appearance",
        order: 1,
        run: () => setScheme("system"),
      },
      {
        id: "theme:picker",
        search: `set theme ${THEMES.map((t) => `${t.name} ${t.credit ?? ""}`).join(" ")}`,
        label: "Set theme…",
        meta: THEMES.find((t) => t.id === themeId)?.name,
        icon: <Palette />,
        group: "Appearance",
        order: 2,
        nested: true,
        run: () => {
          setQuery("");
          setMode("theme");
        },
      },
      {
        id: "design-mode",
        search: "design mode inspect annotate",
        label: "Toggle design mode",
        hint: ["⌥", "D"],
        icon: <PenTool />,
        group: "App",
        order: 0,
        run: () => cb.current.toggleDesignMode(),
      },
      {
        id: "shortcuts",
        search: "keyboard shortcuts help",
        label: "Keyboard shortcuts",
        hint: hintFor("shortcuts"),
        icon: <Keyboard />,
        group: "App",
        order: 1,
        run: () => cb.current.onShortcuts(),
      },
    );

    // a registered command sharing a built-in's id replaces it; the rest pass the allowlist
    const shadowed = new Set(registered.map((c) => c.id));
    const merged = out.filter((a) => !shadowed.has(a.id) && commandAllowed(a.id, commands));
    for (const c of registered)
      merged.push({
        id: c.id,
        search: `${c.label} ${c.keywords ?? ""}`,
        label: c.label,
        hint: c.hint,
        group: c.group ?? DEFAULT_COMMAND_GROUP,
        order: c.order,
        checked: c.checked,
        disabled: c.disabled,
        run: c.run,
      });
    return merged;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    keymap,
    commands,
    registered,
    days,
    namesLong,
    now,
    viewSetting,
    isDark,
    themeId,
    movableTitle,
    canStep,
  ]);

  const queryActions = useMemo<Action[]>(() => {
    const trimmed = query.trim();
    const out: Action[] = [];
    if (trimmed) {
      const r = parseQuickAdd(trimmed, now, { defaultDurationMin });
      const preview = quickAddPreview(r, now);
      out.push({
        id: "quick-add:query",
        search: trimmed,
        always: true,
        label: `Quick add “${preview.title}”`,
        meta: preview.when ?? undefined,
        icon: <CalendarClock />,
        group: "Quick add",
        run: () => openQuickAdd(trimmed),
        nested: true,
      });
      const target = r.start;
      if (target && !r.title.trim() && r.tokens.some((t) => t.kind === "date"))
        out.push({
          id: "jump:typed",
          search: trimmed,
          always: true,
          label: `Go to ${dayLabel(target, now)}`,
          icon: <CalendarSearch />,
          group: "Navigation",
          order: -1,
          run: () => cb.current.onJumpToDay(target),
        });
    }
    for (const hit of searchEvents(events ?? [], trimmed, { now, limit: 6 })) {
      const e = hit.event;
      out.push({
        id: `event:${e.id}`,
        search: `${e.title} ${e.location ?? ""}`,
        always: true,
        label: e.title || "Untitled event",
        meta: formatEventWhen(e, now),
        icon: <Search />,
        group: "Events",
        disabled: !canSelect,
        run: () => selectEvent(e),
      });
    }
    return out.filter((a) => commandAllowed(a.id, commands));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, now, defaultDurationMin, events, canSelect, commands]);

  const datePresets = useMemo<Action[]>(() => {
    const out: Action[] = [];
    DATE_PRESETS.forEach(([phrase, label], i) => {
      const d = parseQuickAdd(phrase, now).start;
      if (!d) return;
      out.push({
        id: `date:${phrase}`,
        search: `${label} ${phrase} ${dayLabel(d, now)}`,
        label,
        meta: dayLabel(d, now),
        icon: <CalendarDays />,
        group: "Quick jumps",
        order: i,
        run: () => cb.current.onJumpToDay(d),
      });
    });
    dayJumps(days).forEach((d, i) => {
      out.push({
        id: `date:col:${d.toDateString()}`,
        search: `${namesLong[i] ?? ""} ${dayLabel(d, now)}`,
        label: dayLabel(d, now),
        icon: <CalendarDays />,
        group: "In view",
        order: i,
        run: () => cb.current.onJumpToDay(d),
      });
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, days, namesLong]);

  const typedDate = useMemo<Action[]>(() => {
    const trimmed = query.trim();
    if (mode !== "date" || !trimmed) return [];
    const r = parseQuickAdd(trimmed, now);
    if (!r.start || r.confidence === "none") return [];
    const target = r.start;
    return [
      {
        id: "date:parsed",
        search: trimmed,
        always: true,
        label: `Go to ${dayLabel(target, now)}`,
        icon: <CalendarSearch />,
        group: "Go to",
        run: () => cb.current.onJumpToDay(target),
      },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, query, now]);

  const themeActions = useMemo<Action[]>(
    () => [
      ...THEMES.map(
        (t, i): Action => ({
          id: `theme:${t.id}`,
          search: `${t.name} ${t.credit ?? ""} ${t.family} theme`,
          label: t.name,
          meta: t.credit,
          hint: t.family === "coss" ? undefined : t.family,
          icon: <Palette />,
          group: "Theme",
          order: i,
          checked: t.id === themeId,
          run: () => {
            setTheme(t.id);
            setThemeId(t.id);
          },
          keepOpen: true,
        }),
      ),
      {
        id: "theme:light",
        search: "light mode appearance",
        label: "Light",
        icon: <Sun />,
        group: "Appearance",
        order: 0,
        checked: !isDark,
        keepOpen: true,
        run: () => {
          setScheme("light");
          setIsDark(false);
        },
      },
      {
        id: "theme:dark",
        search: "dark mode appearance",
        label: "Dark",
        icon: <Moon />,
        group: "Appearance",
        order: 1,
        checked: isDark,
        keepOpen: true,
        run: () => {
          setScheme("dark");
          setIsDark(true);
        },
      },
      {
        id: "theme:system",
        search: "system appearance follow os",
        label: "Match system",
        icon: <MonitorSmartphone />,
        group: "Appearance",
        order: 2,
        keepOpen: true,
        run: () => {
          setScheme("system");
          setIsDark(resolveScheme() === "dark");
        },
      },
    ],
    [themeId, isDark],
  );

  const surface = useMemo(() => {
    switch (mode) {
      case "date":
        return {
          title: "Go to date",
          placeholder: "Try “next friday”, “12 aug”, “tomorrow”…",
          groups: groupCommands(
            [...typedDate, ...datePresets],
            ["Go to", "Quick jumps", "In view"],
          ),
        };
      case "theme":
        return {
          title: "Set theme",
          placeholder: "Search themes…",
          groups: groupCommands(themeActions, ["Theme", "Appearance"]),
        };
      default:
        return {
          title: null,
          placeholder: "Search or type a command…",
          groups: groupCommands([...queryActions, ...staticActions]),
        };
    }
  }, [mode, typedDate, datePresets, themeActions, queryActions, staticActions]);

  const back = () => {
    setMode("commands");
    setQuery("");
  };

  if (mode === "move-to" && movable)
    return (
      <>
        <SurfaceHeader title={`Move “${eventTitle(movable)}”`} onBack={back} />
        <MoveToInput
          value={moveValue}
          onValueChange={setMoveValue}
          event={movable}
          now={now}
          onCommit={(target) => {
            // the target is display-zone wall time
            const patch = movePatch(movable, target, g.displayZone);
            setMoveValue("");
            close();
            // a recurring event asks the scope question first; that dialog outlives this menu
            const occurrence = movable.rrule
              ? (selectedOccurrence ?? occurrenceAt(movable, movable.start))
              : null;
            if (occurrence && askScope) {
              void askScope({ action: "edit", event: movable, occurrence }).then((scope) => {
                if (!scope) return;
                applyPlan(
                  store,
                  editOccurrence(movable, occurrence, patch, scope, {
                    makeId: g.makeId,
                  }),
                );
              });
              return;
            }
            store.update(masterIdOf(movable.id), patch);
          }}
          onBack={back}
        />
      </>
    );

  if (mode === "quick-add")
    return (
      <>
        <SurfaceHeader title="Quick add" onBack={back} />
        <QuickAddInput
          value={quickValue}
          onValueChange={setQuickValue}
          result={parsed}
          now={now}
          onCommit={commitQuickAdd}
          onBack={back}
        />
      </>
    );

  return (
    <Command
      items={surface.groups}
      value={query}
      onValueChange={setQuery}
      filter={(item, q) => {
        const a = item as unknown as Action;
        return a.always === true || matchesQuery(a.search, q);
      }}
    >
      {surface.title ? <SurfaceHeader title={surface.title} onBack={back} /> : null}
      <CommandInput
        placeholder={surface.placeholder}
        onKeyDown={(e) => {
          // Escape steps out of a nested picker before closing the whole menu
          if (e.key === "Escape" && mode !== "commands") {
            e.preventDefault();
            e.stopPropagation();
            back();
          }
        }}
      />
      <CommandList className="max-h-80">
        <CommandEmpty>Nothing matches.</CommandEmpty>
        <CommandCollection>
          {(group: CommandGroupModel<Action>) => (
            <CommandGroup key={group.value} items={group.items}>
              <CommandGroupLabel>{group.value}</CommandGroupLabel>
              <CommandCollection>
                {(a: Action) => (
                  <CommandItem
                    key={a.id}
                    value={a.search}
                    disabled={a.disabled}
                    onClick={() => run(a)}
                  >
                    <span className="me-2 flex size-4 shrink-0 items-center justify-center text-muted-foreground [&_svg]:size-4">
                      {a.icon}
                    </span>
                    <span className="flex-1 truncate">
                      {a.label}
                      {a.meta ? (
                        <span className="ms-2 text-muted-foreground text-xs">{a.meta}</span>
                      ) : null}
                    </span>
                    {a.checked ? (
                      <Check aria-hidden className="ms-2 size-4 shrink-0 text-muted-foreground" />
                    ) : null}
                    {a.nested && !a.checked ? (
                      <ChevronRight
                        aria-hidden
                        className="ms-2 size-4 shrink-0 text-muted-foreground"
                      />
                    ) : null}
                    {a.hint ? (
                      <KbdKeys
                        className="ms-2 in-data-highlighted:*:bg-background"
                        keys={typeof a.hint === "string" ? [a.hint] : a.hint}
                      />
                    ) : null}
                  </CommandItem>
                )}
              </CommandCollection>
            </CommandGroup>
          )}
        </CommandCollection>
      </CommandList>
      <CommandFooter>
        <span className="flex items-center gap-1.5">
          <KbdKeys keys={["↑", "↓"]} />
          navigate
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <KbdKeys keys={["↵"]} />
            run
          </span>
          <span className="flex items-center gap-1.5">
            <KbdKeys keys={["esc"]} />
            {mode === "commands" ? "close" : "back"}
          </span>
        </span>
      </CommandFooter>
    </Command>
  );
}

export function SurfaceHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b px-3 py-2">
      <Button
        variant="ghost"
        size="xs"
        className="font-normal text-muted-foreground"
        onClick={onBack}
      >
        <ArrowLeft />
        Back
      </Button>
      <span className="min-w-0 truncate font-medium text-sm">{title}</span>
    </div>
  );
}
