import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEntry } from "@/lib/db/types";
import type { CalendarSettings } from "./settings";

let entries: CalendarEntry[] = [];
let settings: CalendarSettings;

vi.mock("@/lib/db/calendar", () => ({
  calendarStore: {
    load: async () => entries,
    save: async (next: CalendarEntry[]) => {
      entries = [...next];
    },
  },
}));
vi.mock("./settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./settings")>();
  return {
    ...actual,
    getCalendarSettings: async () => settings,
    updateCalendarSettings: async (
      patch: Partial<CalendarSettings> | ((s: CalendarSettings) => Partial<CalendarSettings>),
    ) => {
      settings = { ...settings, ...(typeof patch === "function" ? patch(settings) : patch) };
      return settings;
    },
  };
});

const { addSubscription, refreshSubscription } = await import("./subscriptions");
const { defaultCalendarSettings } = await import("./settings");

function ics(events: { uid: string; summary: string; day: string }[]) {
  return [
    "BEGIN:VCALENDAR",
    ...events.flatMap((e) => [
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `SUMMARY:${e.summary}`,
      `DTSTART;VALUE=DATE:${e.day}`,
      "END:VEVENT",
    ]),
    "END:VCALENDAR",
  ].join("\r\n");
}

function serve(text: string) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ text, name: "Feed" })),
  );
}

beforeEach(() => {
  entries = [{ id: "own", title: "Mine", start: "2026-11-02", end: "2026-11-03", allDay: true }];
  settings = defaultCalendarSettings();
  vi.stubGlobal("window", { dispatchEvent: () => true });
});

describe("calendar subscriptions", () => {
  it("adds editable entries and keeps the user's edits and deletions on refresh", async () => {
    const first = ics([
      { uid: "a", summary: "Lecture", day: "20261110" },
      { uid: "b", summary: "Exam", day: "20261111" },
      { uid: "c", summary: "Lab", day: "20261112" },
    ]);
    serve(first);
    const sub = await addSubscription(
      { url: "https://x.test/feed.ics", name: "Feed", count: 3, text: first },
      { title: "Uni", color: "blue" },
    );
    expect(entries).toHaveLength(4);
    expect(entries.every((entry) => !entry.readOnly)).toBe(true);

    // The user renames "Lecture" and deletes "Lab".
    entries = entries
      .map((entry) => (entry.id === `${sub.id}:a` ? { ...entry, title: "My lecture" } : entry))
      .filter((entry) => entry.id !== `${sub.id}:c`);

    serve(
      ics([
        { uid: "a", summary: "Lecture", day: "20261110" },
        { uid: "b", summary: "Final exam", day: "20261111" },
        { uid: "c", summary: "Lab", day: "20261112" },
        { uid: "d", summary: "New", day: "20261113" },
      ]),
    );
    await refreshSubscription(settings.subscriptions[0]);

    const titles = Object.fromEntries(entries.map((entry) => [entry.id, entry.title]));
    expect(titles).toEqual({
      own: "Mine",
      [`${sub.id}:a`]: "My lecture",
      [`${sub.id}:b`]: "Final exam",
      [`${sub.id}:d`]: "New",
    });
  });
});
