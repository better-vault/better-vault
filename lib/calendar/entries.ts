import { generateId } from "ai";
import type { CalendarEntry } from "@/lib/db/types";

/**
 * Calendar entries as kloq stores them: timed events as offset-qualified
 * local instants, all-day ones as days with an exclusive end. Shared by the
 * bots' tools (in the page) and the desktop app's MCP server.
 */

/** An event as a bot or an agent describes it, in local time. */
export interface CalendarEventInput {
  title: string;
  /** YYYY-MM-DDTHH:mm for a timed event, or YYYY-MM-DD for an all-day one. */
  start: string;
  /** The same form; one hour after a timed start when left out. */
  end?: string;
  description?: string;
  location?: string;
}

/** The entries that overlap the days from `from` to `to` (inclusive, YYYY-MM-DD), by start. */
export function entriesBetween(entries: readonly CalendarEntry[], from: string, to: string) {
  const start = toTime(from);
  const end = toTime(to) + DAY;
  if (Number.isNaN(start) || Number.isNaN(end)) throw new Error("Use days as YYYY-MM-DD.");
  return entries
    .filter((entry) => toTime(entry.start) < end && toTime(entry.end) > start)
    .sort((a, b) => toTime(a.start) - toTime(b.start));
}

export const DAY = 24 * 60 * 60 * 1000;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;

/** A day (local midnight) or an instant, as milliseconds. */
export function toTime(value: string): number {
  const day = DATE.exec(value);
  if (day) return new Date(+day[1], +day[2] - 1, +day[3]).getTime();
  return Date.parse(value);
}

const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");

/** A local date and time as an offset-qualified instant, as the calendar stores them. */
export function localInstant(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`;
}

const dateOnly = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The calendar entry for an event: timed, or all-day with an exclusive end. */
export function calendarEntry(input: CalendarEventInput, timeZone: string): CalendarEntry {
  const base = {
    id: generateId(),
    title: input.title.trim(),
    ...(input.description ? { description: input.description } : {}),
    ...(input.location ? { location: input.location } : {}),
  };
  const day = DATE.exec(input.start);
  if (day) {
    const first = new Date(+day[1], +day[2] - 1, +day[3]);
    const lastMatch = input.end ? DATE.exec(input.end) : null;
    const last = lastMatch ? new Date(+lastMatch[1], +lastMatch[2] - 1, +lastMatch[3]) : first;
    const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    if (end <= first) throw new Error("The event ends before it starts.");
    return { ...base, allDay: true, start: dateOnly(first), end: dateOnly(end) };
  }
  const start = parseLocal(input.start);
  const end = input.end ? parseLocal(input.end) : new Date(start.getTime() + 60 * 60 * 1000);
  if (end <= start) throw new Error("The event ends before it starts.");
  return { ...base, start: localInstant(start), end: localInstant(end), timeZone };
}

function parseLocal(value: string): Date {
  const match = LOCAL.exec(value);
  if (!match) throw new Error("Use times as YYYY-MM-DDTHH:mm.");
  return new Date(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]);
}
