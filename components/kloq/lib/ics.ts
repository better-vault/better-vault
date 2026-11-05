import { attendeeStatus } from "./attendees";
import { addDays, type CalEvent, isBusy, type PlacedEvent, parseInstant } from "./calendar-types";
import {
  dateStamp,
  dateTimeStamp,
  escapeText,
  partstatOf,
  quoteParam,
  utcStamp,
  vcalendar,
} from "./ics-format";

export { foldLine } from "./ics-format";

import { eventTitle } from "./event-text";

const at = (instant: string, fallback: Date): Date => {
  const ms = parseInstant(instant);
  return Number.isNaN(ms) ? fallback : new Date(ms);
};

export interface ToICSOptions {
  prodId?: string;
}

/** Accepts a store event or a placement; a placement contributes its own id and title. */
export function toICS(event: CalEvent | PlacedEvent, { prodId }: ToICSOptions = {}): string {
  const src = "source" in event ? event.source : event;
  const now = new Date();
  const lines = ["BEGIN:VEVENT", `UID:${event.id}@kloq`, `DTSTAMP:${utcStamp(now)}`];

  const start = at(src.start, now);
  if (src.allDay) {
    // `CalEvent.end` is already the exclusive end DTEND wants
    const stored = at(src.end, addDays(start, 1));
    const end = stored.getTime() > start.getTime() ? stored : addDays(start, 1);
    lines.push(`DTSTART;VALUE=DATE:${dateStamp(start)}`, `DTEND;VALUE=DATE:${dateStamp(end)}`);
  } else {
    lines.push(`DTSTART:${dateTimeStamp(start)}`, `DTEND:${dateTimeStamp(at(src.end, start))}`);
  }

  lines.push(`SUMMARY:${escapeText(eventTitle(event))}`);
  if (event.description) lines.push(`DESCRIPTION:${escapeText(event.description)}`);

  if (src.location) lines.push(`LOCATION:${escapeText(src.location)}`);
  if (src.meetingUrl) lines.push(`URL:${escapeText(src.meetingUrl)}`);
  if (src.rrule) lines.push(`RRULE:${src.rrule.replace(/^RRULE:/i, "")}`);
  // OPAQUE is the RFC default
  if (!isBusy(src)) lines.push("TRANSP:TRANSPARENT");
  if (src.organizer) lines.push(`ORGANIZER:mailto:${src.organizer}`);
  for (const a of src.attendees ?? []) {
    const params = [
      a.name ? `CN=${quoteParam(a.name)}` : null,
      `ROLE=${a.optional ? "OPT-PARTICIPANT" : "REQ-PARTICIPANT"}`,
      `PARTSTAT=${partstatOf(attendeeStatus(a))}`,
      "RSVP=TRUE",
    ].filter(Boolean);
    lines.push(`ATTENDEE;${params.join(";")}:mailto:${a.email}`);
  }

  lines.push("END:VEVENT");
  return vcalendar(lines, prodId);
}

export function downloadICS(event: CalEvent | PlacedEvent, opts: ToICSOptions = {}): void {
  const blob = new Blob([toICS(event, opts)], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(event.title || "event").replace(/[^\w-]+/g, "-").toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
