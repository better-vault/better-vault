import type { Attendee, AttendeeStatus, CalEvent } from "./calendar-types";
import { plural } from "./event-text";

// permissive on purpose: UI-side sanity checking, not RFC 5322
const EMAIL_RE = /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Normalised identity for an address. */
export const emailKey = (email: string) => email.trim().toLowerCase();

/** Parse `sam@acme.com` or `Sam Rivera <sam@acme.com>` into an attendee; `null` if no valid address. */
export function parseAttendee(raw: string): Attendee | null {
  const input = raw.trim();
  if (!input) return null;

  const angled = /^(.*?)<([^<>]+)>$/.exec(input);
  if (angled) {
    const email = angled[2].trim();
    if (!isValidEmail(email)) return null;
    const name = angled[1]
      .trim()
      .replace(/^["']|["']$/g, "")
      .trim();
    return name ? { email, name, status: "pending" } : { email, status: "pending" };
  }

  if (!isValidEmail(input)) return null;
  return { email: input, status: "pending" };
}

/** Split a pasted blob into entries on commas, semicolons (not inside `<...>`) and newlines. */
export function splitAttendeeInput(raw: string): string[] {
  return raw
    .split(/[,;\n]+(?![^<]*>)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Append one entry, deduped by email. `null` when unparseable or already present. */
export function addAttendee(list: readonly Attendee[] | undefined, raw: string): Attendee[] | null {
  const parsed = parseAttendee(raw);
  if (!parsed) return null;
  const current = list ?? [];
  if (current.some((a) => emailKey(a.email) === emailKey(parsed.email))) return null;
  return [...current, parsed];
}

/** Append every parseable, non-duplicate entry in a pasted blob. */
export function addAttendees(
  list: readonly Attendee[] | undefined,
  raw: string,
): Attendee[] | null {
  let next: Attendee[] | null = null;
  for (const entry of splitAttendeeInput(raw)) {
    const grown = addAttendee(next ?? list, entry);
    if (grown) next = grown;
  }
  return next;
}

export function removeAttendee(list: readonly Attendee[] | undefined, email: string): Attendee[] {
  return (list ?? []).filter((a) => emailKey(a.email) !== emailKey(email));
}

/** Display name, else the address. */
export function attendeeLabel(a: Attendee): string {
  return a.name?.trim() || a.email;
}

/** Two-letter initials: "Sam Rivera" → "SR", "sam.rivera@x" → "SR", "sam@x" → "SA". */
export function initialsFor(a: Pick<Attendee, "email" | "name">): string {
  const source = a.name?.trim() || a.email.split("@")[0] || "";
  const words = source.split(/[\s._\-+]+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) {
    const letters = words[0].replace(/[^\p{L}\p{N}]/gu, "");
    return (letters.slice(0, 2) || "?").toUpperCase();
  }
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Stable hue for an address (FNV-1a). */
export function avatarHue(email: string): number {
  const key = emailKey(email);
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h % 360;
}

export const attendeeStatus = (a: Attendee): AttendeeStatus => a.status ?? "pending";

export interface AttendeeSummary {
  total: number;
  accepted: number;
  declined: number;
  tentative: number;
  pending: number;
}

export function summarize(list: readonly Attendee[] | undefined): AttendeeSummary {
  const s: AttendeeSummary = {
    total: 0,
    accepted: 0,
    declined: 0,
    tentative: 0,
    pending: 0,
  };
  for (const a of list ?? []) {
    s.total++;
    s[attendeeStatus(a)]++;
  }
  return s;
}

/** "3 guests · 2 yes". */
export function summaryLabel(list: readonly Attendee[] | undefined): string {
  const s = summarize(list);
  if (s.total === 0) return "No guests";
  const head = plural(s.total, "guest");
  const parts: string[] = [];
  if (s.accepted) parts.push(`${s.accepted} yes`);
  if (s.declined) parts.push(`${s.declined} no`);
  if (s.tentative) parts.push(`${s.tentative} maybe`);
  return parts.length ? `${head} · ${parts.join(", ")}` : head;
}

const CYCLE: AttendeeStatus[] = ["pending", "accepted", "tentative", "declined"];

export function cycleStatus(status: AttendeeStatus | undefined): AttendeeStatus {
  const i = CYCLE.indexOf(status ?? "pending");
  return CYCLE[(i + 1) % CYCLE.length];
}

export const STATUS_LABEL: Record<AttendeeStatus, string> = {
  accepted: "Accepted",
  declined: "Declined",
  tentative: "Maybe",
  pending: "Awaiting reply",
};

/** Find someone on the list by address, case-insensitively. */
export function findAttendee(
  list: readonly Attendee[] | undefined,
  email: string | undefined,
): Attendee | undefined {
  if (!email) return undefined;
  const key = emailKey(email);
  return (list ?? []).find((a) => emailKey(a.email) === key);
}

/** Set one person's RSVP. `null` when nothing would change. */
export function setAttendeeStatus(
  list: readonly Attendee[] | undefined,
  email: string,
  status: AttendeeStatus,
): Attendee[] | null {
  const key = emailKey(email);
  let changed = false;
  const next = (list ?? []).map((a) => {
    if (emailKey(a.email) !== key || attendeeStatus(a) === status) return a;
    changed = true;
    return { ...a, status };
  });
  return changed ? next : null;
}

/** Flip one person between required and optional. `null` when nothing would change; `false` is written as an absent key. */
export function setAttendeeOptional(
  list: readonly Attendee[] | undefined,
  email: string,
  optional: boolean,
): Attendee[] | null {
  const key = emailKey(email);
  let changed = false;
  const next = (list ?? []).map((a) => {
    if (emailKey(a.email) !== key || Boolean(a.optional) === optional) return a;
    changed = true;
    if (optional) return { ...a, optional: true };
    const { optional: _drop, ...rest } = a;
    return rest;
  });
  return changed ? next : null;
}

export function toggleAttendeeOptional(
  list: readonly Attendee[] | undefined,
  email: string,
): Attendee[] | null {
  const current = findAttendee(list, email);
  if (!current) return null;
  return setAttendeeOptional(list, email, !current.optional);
}

/** The organiser, normalised, or `undefined`. Deliberately not "the first attendee". */
export function organizerOf(event: Pick<CalEvent, "organizer">): string | undefined {
  const email = event.organizer?.trim();
  return email ? emailKey(email) : undefined;
}

/** Is this address the organiser of that event? */
export function isOrganizer(
  event: Pick<CalEvent, "organizer">,
  email: string | undefined,
): boolean {
  if (!email) return false;
  return organizerOf(event) === emailKey(email);
}

/** The RSVP control's three answers. `pending` isn't offered. */
export const RSVP_CHOICES: readonly {
  status: Extract<AttendeeStatus, "accepted" | "tentative" | "declined">;
  label: string;
}[] = [
  { status: "accepted", label: "Yes" },
  { status: "tentative", label: "Maybe" },
  { status: "declined", label: "No" },
];

/** Is this an absolute http(s) link worth a Join button? */
export function isJoinableUrl(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** "meet.google.com/abc-defg" — host + path, no scheme. */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.host}${path}`.replace(/\/$/, "");
  } catch {
    return url.trim();
  }
}
