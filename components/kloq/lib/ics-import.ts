import type { CalendarColor } from "./calendar-sources";
import {
  addDays,
  type CalEvent,
  type Instant,
  instantPlus,
  parseInstant,
  toDateOnlyString,
} from "./calendar-types";
import { MINUTES_PER_DAY } from "./date-math";
import {
  type ICSContentLine,
  parseContentLine,
  parseICSDateValue,
  parseICSDuration,
  statusOfPartstat,
  unescapeText,
  unfoldICS,
} from "./ics-format";

export {
  type ICSContentLine,
  type ICSDate,
  parseContentLine,
  parseICSDateValue,
  parseICSDuration,
  unescapeText,
  unfoldICS,
} from "./ics-format";

/** Something the file contained and this parser refused to represent. */
export interface ICSSkip {
  /** a component name, a property name, or an event */
  what: string;
  reason: string;
  /** the `UID` it belonged to, when event-scoped */
  uid?: string;
}

export interface ICSImportOptions {
  /** colour for imported events; default `"blue"` */
  color?: CalendarColor;
  /** stamped on every imported event */
  calendarId?: string;
  /** prepended to every generated id */
  idPrefix?: string;
  /** `UID` → `CalEvent.id`; default the UID verbatim, which makes re-import idempotent */
  uidToId?: (uid: string) => string;
  /** minutes for a timed event with no `DTEND` and no `DURATION`; default 60 */
  defaultDurationMinutes?: number;
}

export interface ICSImportResult {
  events: CalEvent[];
  /** everything dropped, deduped */
  skipped: ICSSkip[];
  /** kept, but approximated */
  warnings: ICSSkip[];
}

const HANDLED = new Set([
  "UID",
  "DTSTART",
  "DTEND",
  "DURATION",
  "SUMMARY",
  "DESCRIPTION",
  "LOCATION",
  "URL",
  "ATTENDEE",
  "ORGANIZER",
  "RRULE",
  "TRANSP",
  "STATUS",
]);

// bookkeeping properties, silently ignored
const IGNORED = new Set([
  "DTSTAMP",
  "CREATED",
  "LAST-MODIFIED",
  "SEQUENCE",
  "PRODID",
  "VERSION",
  "CALSCALE",
  "METHOD",
  "X-WR-CALNAME",
  "X-WR-TIMEZONE",
  "X-WR-CALDESC",
]);

const emailOf = (value: string) => value.trim().replace(/^mailto:/i, "");

/** Parse an iCalendar document into store events. Never throws; malformed input yields `skipped` entries. */
export function parseICS(text: string, options: ICSImportOptions = {}): ICSImportResult {
  const {
    color = "blue",
    calendarId,
    idPrefix = "",
    uidToId = (uid: string) => uid,
    defaultDurationMinutes = 60,
  } = options;

  const events: CalEvent[] = [];
  const skipped: ICSSkip[] = [];
  const warnings: ICSSkip[] = [];
  const seenSkips = new Set<string>();
  const note = (list: ICSSkip[], skip: ICSSkip) => {
    const key = `${skip.what}|${skip.reason}|${skip.uid ?? ""}`;
    if (seenSkips.has(key)) return;
    seenSkips.add(key);
    list.push(skip);
  };

  const stack: string[] = [];
  let current: ICSContentLine[] | null = null;
  const usedIds = new Set<string>();
  let generated = 0;

  const finish = (props: ICSContentLine[]) => {
    const built = buildEvent(props, {
      color,
      calendarId,
      idPrefix,
      uidToId,
      defaultDurationMinutes,
      note: (list, s) => note(list === "skip" ? skipped : warnings, s),
      nextGeneratedId: () => `${idPrefix}imported-${++generated}`,
      usedIds,
    });
    if (built) events.push(built);
  };

  for (const line of unfoldICS(text)) {
    const cl = parseContentLine(line);
    if (!cl) {
      note(skipped, { what: line.slice(0, 40), reason: "not a content line" });
      continue;
    }

    if (cl.name === "BEGIN") {
      const comp = cl.value.trim().toUpperCase();
      stack.push(comp);
      if (comp === "VEVENT" && current === null) current = [];
      else if (comp === "VALARM")
        note(skipped, {
          what: "VALARM",
          reason: "reminders are not imported",
        });
      else if (comp === "VTIMEZONE")
        note(skipped, {
          what: "VTIMEZONE",
          reason: "zone rules aren't interpreted; times are read as local",
        });
      else if (comp === "VTODO" || comp === "VJOURNAL" || comp === "VFREEBUSY")
        note(skipped, {
          what: comp,
          reason: "only VEVENT maps onto CalEvent",
        });
      continue;
    }

    if (cl.name === "END") {
      const closed = stack.pop();
      if (closed === "VEVENT" && current !== null) {
        finish(current);
        current = null;
      }
      continue;
    }

    // a nested component's properties must never be read as the event's own
    if (current !== null && stack[stack.length - 1] === "VEVENT") current.push(cl);
  }

  if (current !== null) {
    note(skipped, { what: "VEVENT", reason: "missing END:VEVENT" });
    finish(current);
  }

  return { events, skipped, warnings };
}

interface BuildContext {
  color: CalendarColor;
  calendarId?: string;
  idPrefix: string;
  uidToId: (uid: string) => string;
  defaultDurationMinutes: number;
  note: (list: "skip" | "warn", skip: ICSSkip) => void;
  nextGeneratedId: () => string;
  usedIds: Set<string>;
}

function buildEvent(props: ICSContentLine[], ctx: BuildContext): CalEvent | null {
  const first = (name: string) => props.find((p) => p.name === name);
  const all = (name: string) => props.filter((p) => p.name === name);

  const uid = first("UID")?.value.trim();

  const status = first("STATUS")?.value.trim().toUpperCase();
  if (status === "CANCELLED") {
    ctx.note("skip", {
      what: "VEVENT",
      reason: "STATUS:CANCELLED — a cancelled event has no block to draw",
      uid,
    });
    return null;
  }

  if (first("RECURRENCE-ID")) {
    ctx.note("skip", {
      what: "RECURRENCE-ID",
      reason: "per-instance overrides are not imported",
      uid,
    });
    return null;
  }

  const dtstartLine = first("DTSTART");
  if (!dtstartLine) {
    ctx.note("skip", {
      what: "VEVENT",
      reason: "no DTSTART — an event with no start can't be placed",
      uid,
    });
    return null;
  }
  const dtstart = parseICSDateValue(dtstartLine.value, dtstartLine.params);
  if (!dtstart) {
    ctx.note("skip", {
      what: "DTSTART",
      reason: `unparseable value "${dtstartLine.value.slice(0, 32)}"`,
      uid,
    });
    return null;
  }

  const dtendLine = first("DTEND");
  const dtend = dtendLine ? parseICSDateValue(dtendLine.value, dtendLine.params) : null;
  if (dtendLine && !dtend)
    ctx.note("skip", {
      what: "DTEND",
      reason: `unparseable value "${dtendLine.value.slice(0, 32)}"`,
      uid,
    });

  const durationLine = first("DURATION");
  const duration = durationLine ? parseICSDuration(durationLine.value) : null;
  if (durationLine && duration === null)
    ctx.note("skip", {
      what: "DURATION",
      reason: `unparseable value "${durationLine.value.slice(0, 32)}"`,
      uid,
    });

  if (dtstart.tzid)
    ctx.note("warn", {
      what: "TZID",
      reason: `"${dtstart.tzid}" read as local wall-clock time and preserved on CalEvent.timeZone`,
      uid,
    });

  let when: Pick<CalEvent, "allDay" | "start" | "end">;
  if (dtstart.dateOnly) {
    // `end` is exclusive in both RFC 5545 and CalEvent
    const startDay = new Date(parseInstant(dtstart.instant));
    let end: Instant;
    if (dtend?.dateOnly) end = dtend.instant;
    else if (dtend) end = toDateOnlyString(new Date(parseInstant(dtend.instant)));
    else if (duration !== null && duration > 0)
      end = toDateOnlyString(
        addDays(startDay, Math.max(1, Math.round(duration / MINUTES_PER_DAY))),
      );
    else end = toDateOnlyString(addDays(startDay, 1));

    if (parseInstant(end) <= parseInstant(dtstart.instant)) {
      ctx.note("warn", {
        what: "DTEND",
        reason: "not after DTSTART; clamped to a single day",
        uid,
      });
      end = toDateOnlyString(addDays(startDay, 1));
    }
    when = { allDay: true, start: dtstart.instant, end };
  } else {
    let end: Instant;
    if (dtend && !dtend.dateOnly) end = dtend.instant;
    else if (dtend) {
      ctx.note("warn", {
        what: "DTEND",
        reason: "date-only DTEND on a timed DTSTART; duration defaulted",
        uid,
      });
      end = instantPlus(dtstart.instant, ctx.defaultDurationMinutes);
    } else if (duration !== null && duration > 0) end = instantPlus(dtstart.instant, duration);
    else {
      if (duration === null && !durationLine)
        ctx.note("warn", {
          what: "DTEND",
          reason: `absent; defaulted to ${ctx.defaultDurationMinutes} minutes`,
          uid,
        });
      end = instantPlus(dtstart.instant, ctx.defaultDurationMinutes);
    }

    if (parseInstant(end) <= parseInstant(dtstart.instant)) {
      ctx.note("warn", {
        what: "DTEND",
        reason: `not after DTSTART; defaulted to ${ctx.defaultDurationMinutes} minutes`,
        uid,
      });
      end = instantPlus(dtstart.instant, ctx.defaultDurationMinutes);
    }
    when = { allDay: false, start: dtstart.instant, end };
  }

  let id = uid ? `${ctx.idPrefix}${ctx.uidToId(uid)}` : ctx.nextGeneratedId();
  if (ctx.usedIds.has(id)) {
    let n = 2;
    while (ctx.usedIds.has(`${id}-${n}`)) n++;
    ctx.note("warn", { what: "UID", reason: "duplicate; suffixed", uid });
    id = `${id}-${n}`;
  }
  ctx.usedIds.add(id);

  const text = (name: string) => {
    const line = first(name);
    return line ? unescapeText(line.value).trim() || undefined : undefined;
  };

  const attendees = all("ATTENDEE")
    .map((a) => {
      const email = emailOf(a.value);
      if (!email) return null;
      const name = a.params.CN?.trim();
      const status = statusOfPartstat(a.params.PARTSTAT);
      const optional = a.params.ROLE?.toUpperCase() === "OPT-PARTICIPANT";
      return {
        email,
        ...(name ? { name } : {}),
        ...(status ? { status } : {}),
        ...(optional ? { optional: true } : {}),
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  const organizerLine = first("ORGANIZER");
  const organizer = organizerLine ? emailOf(organizerLine.value) : undefined;

  const transp = first("TRANSP")?.value.trim().toUpperCase();
  const rrule = first("RRULE")?.value.trim();
  // URL is a URI value, never backslash-escaped
  const url = first("URL")?.value.trim();

  for (const p of props)
    if (!HANDLED.has(p.name) && !IGNORED.has(p.name))
      ctx.note("skip", {
        what: p.name,
        reason: p.name.startsWith("X-")
          ? "vendor extension — no CalEvent field to hold it"
          : "no CalEvent field to hold it",
      });

  const event = {
    id,
    title: text("SUMMARY") ?? "Untitled",
    color: ctx.color,
    ...when,
    ...(text("DESCRIPTION") ? { description: text("DESCRIPTION") } : {}),
    ...(text("LOCATION") ? { location: text("LOCATION") } : {}),
    ...(url ? { meetingUrl: url } : {}),
    ...(attendees.length ? { attendees } : {}),
    ...(organizer ? { organizer } : {}),
    ...(transp === "TRANSPARENT" ? { busy: false } : {}),
    ...(rrule ? { rrule } : {}),
    ...(ctx.calendarId ? { calendarId: ctx.calendarId } : {}),
    ...(dtstart.tzid ? { timeZone: dtstart.tzid } : {}),
  } as CalEvent;

  return event;
}
