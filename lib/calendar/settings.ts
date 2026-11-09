import { useStoreQuery } from "@/lib/db/live";
import { store } from "@/lib/db/store";

/** The colours kloq can draw an entry in. */
export const calendarColors = ["blue", "violet", "emerald", "amber", "rose"] as const;
export type CalendarColor = (typeof calendarColors)[number];

export const calendarViews = ["day", "week", "month", "agenda"] as const;
export type CalendarDefaultView = (typeof calendarViews)[number];

/** A calendar followed by its .ics address; its entries carry its id as `calendarId`. */
export interface CalendarSubscription {
  id: string;
  url: string;
  title: string;
  color: CalendarColor;
  /** When its entries were last fetched, in ms. */
  fetchedAt: number;
}

/** Settings → Calendar, kept with the other settings on this device. */
export interface CalendarSettings {
  /** 0 = Sunday, 1 = Monday, 6 = Saturday. */
  weekStartsOn: 0 | 1 | 6;
  defaultView: CalendarDefaultView;
  /** "auto" follows the language. */
  timeFormat: "auto" | "12" | "24";
  weekNumbers: boolean;
  /** Working hours tinted on the grid, or false for none. */
  workingHours: { start: number; end: number } | false;
  subscriptions: CalendarSubscription[];
}

const key = "calendar";

export function defaultCalendarSettings(): CalendarSettings {
  return {
    weekStartsOn: 1,
    defaultView: "week",
    timeFormat: "auto",
    weekNumbers: false,
    workingHours: { start: 9, end: 17 },
    subscriptions: [],
  };
}

export async function getCalendarSettings(): Promise<CalendarSettings> {
  const saved = (await store().getSetting(key)) as Partial<CalendarSettings> | undefined;
  return { ...defaultCalendarSettings(), ...saved };
}

export async function updateCalendarSettings(
  patch: Partial<CalendarSettings> | ((current: CalendarSettings) => Partial<CalendarSettings>),
): Promise<CalendarSettings> {
  const current = await getCalendarSettings();
  const next = { ...current, ...(typeof patch === "function" ? patch(current) : patch) };
  await store().putSetting(key, next);
  return next;
}

export function useCalendarSettings(): CalendarSettings | undefined {
  return useStoreQuery(() => getCalendarSettings(), [], ["settings"]);
}

/** kloq's `hour12`: undefined lets the language decide. */
export function hour12Of(format: CalendarSettings["timeFormat"]): boolean | undefined {
  return format === "auto" ? undefined : format === "12";
}
