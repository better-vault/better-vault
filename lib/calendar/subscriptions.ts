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
  return events.map((event) => ({ ...event, readOnly: true }) as unknown as CalendarEntry);
}

/** Swaps one subscription's entries for new ones, keeping everything else. */
async function replaceEntries(subscriptionId: string, next: CalendarEntry[]) {
  const all = await calendarStore.load();
  await calendarStore.save([
    ...all.filter((entry) => entry.calendarId !== subscriptionId),
    ...next,
  ]);
  window.dispatchEvent(new Event(CALENDAR_RELOAD));
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
  await replaceEntries(subscription.id, entriesOf(preview.text, subscription));
  await updateCalendarSettings((current) => ({
    subscriptions: [...current.subscriptions, subscription],
  }));
  return subscription;
}

export async function refreshSubscription(subscription: CalendarSubscription): Promise<void> {
  const preview = await previewCalendar(subscription.url);
  await replaceEntries(subscription.id, entriesOf(preview.text, subscription));
  await updateCalendarSettings((current) => ({
    subscriptions: current.subscriptions.map((each) =>
      each.id === subscription.id ? { ...each, fetchedAt: Date.now() } : each,
    ),
  }));
}

export async function removeSubscription(id: string): Promise<void> {
  await replaceEntries(id, []);
  await updateCalendarSettings((current) => ({
    subscriptions: current.subscriptions.filter((each) => each.id !== id),
  }));
}

/** Refreshes subscriptions older than six hours; failures keep the old entries. */
export async function refreshStaleSubscriptions(): Promise<void> {
  const { subscriptions } = await getCalendarSettings();
  const stale = subscriptions.filter((each) => Date.now() - each.fetchedAt > REFRESH_EVERY);
  for (const subscription of stale) {
    await refreshSubscription(subscription).catch(() => {});
  }
}
