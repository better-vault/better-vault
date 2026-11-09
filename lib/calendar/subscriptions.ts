import { parseICS } from "@/components/kloq/lib/ics-import";
import { calendarStore } from "@/lib/db/calendar";
import type { CalendarEntry } from "@/lib/db/types";
import {
  getCalendarSettings,
  updateCalendarSettings,
  type CalendarColor,
  type CalendarSubscription,
} from "./settings";

/** Entries are fetched again when the calendar opens, at most this often. */
const REFRESH_EVERY = 6 * 60 * 60 * 1000;

/** Fired when entries change outside the calendar, so an open calendar reloads them. */
export const CALENDAR_RELOAD = "better-vault:calendar-reload";

/** `webcal://` is `https://` for a calendar app. */
export function normalizeCalendarUrl(input: string): string {
  return input.trim().replace(/^webcals?:\/\//i, "https://");
}

export interface CalendarPreview {
  url: string;
  /** The name the file gives itself, if any. */
  name: string;
  count: number;
  text: string;
}

/** Fetches an .ics address through the app's API (browsers can't reach most of them directly). */
export async function previewCalendar(input: string): Promise<CalendarPreview> {
  const url = normalizeCalendarUrl(input);
  const response = await fetch("/api/calendar/fetch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const result = (await response.json().catch(() => ({}))) as {
    text?: string;
    name?: string;
    error?: string;
  };
  if (!response.ok || typeof result.text !== "string") {
    throw new Error(result.error ?? response.statusText);
  }
  const { events } = parseICS(result.text);
  return { url, name: result.name ?? "", count: events.length, text: result.text };
}

function entriesOf(text: string, subscription: CalendarSubscription): CalendarEntry[] {
  const { events } = parseICS(text, {
    color: subscription.color,
    calendarId: subscription.id,
    idPrefix: `${subscription.id}:`,
  });
  return events as unknown as CalendarEntry[];
}

/** What counts as an edit: the fields a person changes in the calendar. */
function fingerprint(entry: CalendarEntry): string {
  return JSON.stringify([
    entry.title,
    entry.start,
    entry.end,
    entry.allDay ?? false,
    entry.location ?? "",
    entry.description ?? "",
    entry.color ?? "",
  ]);
}

/**
 * Puts a subscription's fresh entries in the calendar. Entries the user
 * edited or deleted since the last fetch stay as they are; the rest follow
 * the feed. Returns the new fingerprints to remember.
 */
async function mergeEntries(
  subscription: CalendarSubscription,
  fresh: CalendarEntry[],
): Promise<Record<string, string>> {
  const all = await calendarStore.load();
  const originals = subscription.originals ?? {};
  const mine = new Map(
    all.filter((entry) => entry.calendarId === subscription.id).map((entry) => [entry.id, entry]),
  );
  const edited = (id: string) => {
    const before = originals[id];
    if (before === undefined) return false;
    const current = mine.get(id);
    return current === undefined || fingerprint(current) !== before;
  };
  const kept: CalendarEntry[] = [];
  const next: Record<string, string> = {};
  for (const entry of fresh) {
    next[entry.id] = fingerprint(entry);
    if (!edited(entry.id)) kept.push(entry);
    else if (mine.has(entry.id)) kept.push(mine.get(entry.id)!);
    // edited and missing: the user deleted it, so it stays deleted
  }
  // Entries the feed dropped are kept only if the user edited them.
  for (const [id, entry] of mine) {
    if (!(id in next) && edited(id)) kept.push(entry);
  }
  await calendarStore.save([
    ...all.filter((entry) => entry.calendarId !== subscription.id),
    ...kept,
  ]);
  window.dispatchEvent(new Event(CALENDAR_RELOAD));
  return next;
}

export async function addSubscription(
  preview: CalendarPreview,
  { title, color }: { title: string; color: CalendarColor },
): Promise<CalendarSubscription> {
  const subscription: CalendarSubscription = {
    id: `sub-${crypto.randomUUID()}`,
    url: preview.url,
    title: title.trim() || preview.name || new URL(preview.url).hostname,
    color,
    fetchedAt: Date.now(),
  };
  subscription.originals = await mergeEntries(subscription, entriesOf(preview.text, subscription));
  await updateCalendarSettings((current) => ({
    subscriptions: [...current.subscriptions, subscription],
  }));
  return subscription;
}

export async function refreshSubscription(subscription: CalendarSubscription): Promise<void> {
  const preview = await previewCalendar(subscription.url);
  const originals = await mergeEntries(subscription, entriesOf(preview.text, subscription));
  await updateCalendarSettings((current) => ({
    subscriptions: current.subscriptions.map((each) =>
      each.id === subscription.id ? { ...each, fetchedAt: Date.now(), originals } : each,
    ),
  }));
}

export async function removeSubscription(id: string): Promise<void> {
  const all = await calendarStore.load();
  await calendarStore.save(all.filter((entry) => entry.calendarId !== id));
  window.dispatchEvent(new Event(CALENDAR_RELOAD));
  await updateCalendarSettings((current) => ({
    subscriptions: current.subscriptions.filter((each) => each.id !== id),
  }));
}

/** Refreshes subscriptions older than six hours; failures keep the old entries. */
export async function refreshStaleSubscriptions(): Promise<void> {
  const { subscriptions } = await getCalendarSettings();
  // Subscriptions from before edits were tracked (no `originals`) refresh at once,
  // which also makes their entries editable.
  const stale = subscriptions.filter(
    (each) => !each.originals || Date.now() - each.fetchedAt > REFRESH_EVERY,
  );
  for (const subscription of stale) {
    await refreshSubscription(subscription).catch(() => {});
  }
}
