import { newEventId } from "./calendar-store";
import {
  addDays,
  type CalEvent,
  daysBetween,
  formatInstant,
  type Instant,
  instantPlus,
  isDateOnly,
  minutesOfDate,
  parseInstant,
  startOfLocalDay,
  toDateOnlyString,
  wallMinutesBetween,
} from "./calendar-types";
import { eventTitle } from "./event-text";
import { type ToICSOptions, toICS } from "./ics";
import { vcalendar } from "./ics-format";
import { parseICS } from "./ics-import";

const ICS_MIME = "text/calendar";

/** Chromium rejects `text/calendar` in a `ClipboardItem` and takes only `"web "`-prefixed custom types. */
const ICS_WEB_MIME = "web text/calendar";

const VEVENT_OPEN = "BEGIN:VEVENT";
const VEVENT_CLOSE = "END:VEVENT";

/** One `VCALENDAR` carrying every copied event, spliced from per-event `toICS` output. `""` for none. */
export function eventsToICS(events: readonly CalEvent[], opts: ToICSOptions = {}): string {
  if (events.length === 0) return "";
  const blocks: string[] = [];
  for (const e of events) {
    const doc = toICS(e, opts);
    const lines = doc.split("\r\n");
    const from = lines.indexOf(VEVENT_OPEN);
    const to = lines.lastIndexOf(VEVENT_CLOSE);
    if (from < 0 || to < from) continue;
    blocks.push(...lines.slice(from, to + 1));
  }
  if (blocks.length === 0) return "";
  return vcalendar(blocks, opts.prodId);
}

interface ClipboardTextOptions {
  locale?: string;
  hour12?: boolean;
  /** replace the whole per-event block */
  formatEvent?: (event: CalEvent) => string;
}

const dayFmt = (locale?: string) =>
  new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const timeFmt = (locale?: string, hour12?: boolean) =>
  new Intl.DateTimeFormat(locale, {
    hour: "numeric",
    minute: "2-digit",
    ...(hour12 === undefined ? {} : { hour12 }),
  });

/** The human-readable flavour: one block per event (title, day + range, location, link). */
export function eventsToText(events: readonly CalEvent[], opts: ClipboardTextOptions = {}): string {
  if (events.length === 0) return "";
  const day = dayFmt(opts.locale);
  const time = timeFmt(opts.locale, opts.hour12);
  const one =
    opts.formatEvent ??
    ((e: CalEvent): string => {
      const lines: string[] = [eventTitle(e)];
      const startMs = parseInstant(e.start);
      const endMs = parseInstant(e.end);
      if (Number.isNaN(startMs)) {
        lines.push(e.start);
      } else if (e.allDay) {
        const start = new Date(startMs);
        // exclusive end → inclusive last day
        const last = Number.isNaN(endMs)
          ? start
          : (() => {
              const d = addDays(new Date(endMs), -1);
              return d.getTime() < start.getTime() ? start : d;
            })();
        lines.push(
          daysBetween(start, last) === 0
            ? `${day.format(start)} · all day`
            : `${day.format(start)} – ${day.format(last)} · all day`,
        );
      } else {
        const start = new Date(startMs);
        const end = Number.isNaN(endMs) ? start : new Date(endMs);
        lines.push(
          daysBetween(start, end) === 0
            ? `${day.format(start)} · ${time.format(start)} – ${time.format(end)}`
            : `${day.format(start)} ${time.format(start)} – ${day.format(end)} ${time.format(end)}`,
        );
      }
      if (e.location) lines.push(e.location);
      if (e.meetingUrl) lines.push(e.meetingUrl);
      return lines.join("\n");
    });
  return events.map(one).join("\n\n");
}

export function looksLikeICS(text: string): boolean {
  return /BEGIN:\s*VCALENDAR/i.test(text) || /BEGIN:\s*VEVENT/i.test(text);
}

/** Parse pasted text into store events. Anything that isn't iCalendar returns `[]`. */
export function parseClipboardEvents(
  text: string,
  opts: { color?: CalEvent["color"] } = {},
): CalEvent[] {
  if (!text || !looksLikeICS(text)) return [];
  try {
    // fresh ids: a pasted UID must not collide with the event already on the grid
    return parseICS(text, {
      color: opts.color,
      uidToId: () => newEventId(),
    }).events;
  } catch {
    return [];
  }
}

interface RebaseOptions {
  /** where the EARLIEST copied event's start lands; a date-only target keeps each event's time of day */
  target: Instant;
  /** fresh id per pasted event; defaults to `newEventId` */
  newId?: (source: CalEvent) => string;
  /** appended to every pasted title */
  titleSuffix?: string;
}

/**
 * Move a copied set onto a new anchor: the earliest start goes to `target`, every other event keeps
 * its wall-clock offset from it. All-day events shift by whole calendar days.
 */
export function rebaseEvents(
  events: readonly CalEvent[],
  { target, newId = () => newEventId(), titleSuffix }: RebaseOptions,
): CalEvent[] {
  if (events.length === 0) return [];
  const parsed = events
    .map((e) => ({ e, ms: parseInstant(e.start) }))
    .filter((x) => !Number.isNaN(x.ms))
    .sort((a, b) => a.ms - b.ms);
  if (parsed.length === 0) return [];

  const baseInstant = parsed[0]!.e.start;
  const baseDate = new Date(parsed[0]!.ms);
  const targetMs = parseInstant(target);
  if (Number.isNaN(targetMs)) return [];
  const targetDate = new Date(targetMs);
  const targetDay = startOfLocalDay(targetDate);
  const dayAnchored = isDateOnly(target);

  return parsed.map(({ e, ms }) => {
    const id = newId(e);
    const title = titleSuffix ? `${e.title}${titleSuffix}` : e.title;
    const startDate = new Date(ms);

    if (e.allDay) {
      const dayOffset = daysBetween(baseDate, startDate);
      const endMs = parseInstant(e.end);
      const span = Number.isNaN(endMs) ? 1 : Math.max(1, daysBetween(startDate, new Date(endMs)));
      const from = addDays(targetDay, dayOffset);
      return {
        ...e,
        id,
        title,
        allDay: true,
        start: toDateOnlyString(from),
        end: toDateOnlyString(addDays(from, span)),
      } as CalEvent;
    }

    const duration = wallMinutesBetween(e.start, e.end);
    if (dayAnchored) {
      // pasted onto a day: keep the clock time, move the date
      const d = addDays(targetDay, daysBetween(baseDate, startDate));
      d.setMinutes(minutesOfDate(startDate));
      const start = formatInstant(d);
      return {
        ...e,
        id,
        title,
        allDay: false,
        start,
        end: instantPlus(start, duration),
      } as CalEvent;
    }

    const offset = wallMinutesBetween(baseInstant, e.start);
    const start = instantPlus(target, offset);
    return { ...e, id, title, allDay: false, start, end: instantPlus(start, duration) } as CalEvent;
  });
}

interface ClipboardPayload {
  events: CalEvent[];
  ics: string;
  text: string;
}

let internal: ClipboardPayload | null = null;

const setInternalClipboard = (p: ClipboardPayload | null): void => {
  internal = p;
};
const getInternalClipboard = (): ClipboardPayload | null => internal;

/** Which route a copy took: summary plus a calendar flavour, summary only, or the internal buffer only. */
type ClipboardWriteResult = "rich" | "text" | "internal";

export function buildClipboardPayload(
  events: readonly CalEvent[],
  opts: ClipboardTextOptions & ToICSOptions = {},
): ClipboardPayload {
  return {
    events: [...events],
    ics: eventsToICS(events, opts),
    text: eventsToText(events, opts),
  };
}

const blob = (type: string, data: string) => new Blob([data], { type });

/** Copy a selection to the system clipboard. The internal buffer is always written first. */
export async function writeEventsToClipboard(
  events: readonly CalEvent[],
  opts: ClipboardTextOptions & ToICSOptions = {},
): Promise<ClipboardWriteResult> {
  const payload = buildClipboardPayload(events, opts);
  setInternalClipboard(payload.events.length ? payload : null);
  if (payload.events.length === 0) return "internal";

  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const CI = (globalThis as { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
  if (nav?.clipboard?.write && CI) {
    // one unsupported type sinks the whole item, so the calendar goes in exactly one flavour
    const flavours = CI.supports
      ? [ICS_MIME, ICS_WEB_MIME].filter((type) => CI.supports(type)).slice(0, 1)
      : [ICS_MIME, ICS_WEB_MIME];
    for (const type of flavours) {
      try {
        await nav.clipboard.write([
          new CI({
            "text/plain": blob("text/plain", payload.text),
            [type]: blob(type, payload.ics),
          }),
        ]);
        return "rich";
      } catch {
        // no `supports` to ask: the next spelling may be accepted
      }
    }
  }
  try {
    await nav?.clipboard?.writeText(payload.text);
    return "text";
  } catch {
    return "internal";
  }
}

interface ClipboardReadResult {
  events: CalEvent[];
  /** `"internal"` means the system clipboard failed */
  source: "system" | "internal" | "none";
}

/** Read events back: `text/calendar`, then `web text/calendar`, then iCalendar-looking text, then the buffer. */
export async function readEventsFromClipboard(
  opts: { color?: CalEvent["color"] } = {},
): Promise<ClipboardReadResult> {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  const fromText = (text: string) => parseClipboardEvents(text, opts);

  if (nav?.clipboard?.read) {
    try {
      const items = await nav.clipboard.read();
      for (const item of items) {
        for (const type of [ICS_MIME, ICS_WEB_MIME]) {
          if (!item.types.includes(type)) continue;
          const events = fromText(await (await item.getType(type)).text());
          if (events.length) return { events, source: "system" };
        }
      }
    } catch {}
  }
  try {
    const text = await nav?.clipboard?.readText();
    if (text) {
      const events = fromText(text);
      if (events.length) return { events, source: "system" };
    }
  } catch {}
  const buffered = getInternalClipboard();
  if (buffered && buffered.events.length)
    // fresh ids: pasting the buffer twice must give two events
    return {
      events: buffered.events.map((e) => ({ ...e, id: newEventId() })),
      source: "internal",
    };
  return { events: [], source: "none" };
}
