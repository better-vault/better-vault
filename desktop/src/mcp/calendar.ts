import { z } from "zod";
import { calendarEntry, entriesBetween } from "../../../lib/calendar/entries";
import type { CalendarEntry } from "../../../lib/db/types";
import { failure, guarded, text, turnedOff, type ToolContext } from "./context";

/** The calendar (kloq's entries, kept in the app's store). */
export function registerCalendarTools(ctx: ToolContext) {
  const { mcp, store, log, changed, canWrite } = ctx;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const entryOut = (entry: CalendarEntry) => ({
    id: entry.id,
    title: entry.title,
    start: entry.start,
    end: entry.end,
    allDay: entry.allDay || undefined,
    description: typeof entry.description === "string" ? entry.description : undefined,
    location: typeof entry.location === "string" ? entry.location : undefined,
    recurring: entry.rrule ? true : undefined,
  });

  const when = {
    start: z
      .string()
      .describe(
        "Local start: YYYY-MM-DDTHH:mm for a timed event, or YYYY-MM-DD for an all-day one",
      ),
    end: z
      .string()
      .optional()
      .describe("Local end in the same form. Timed: one hour after start when left out."),
  };

  mcp.registerTool(
    "list_events",
    {
      description: `List the calendar's events between two days (inclusive). Times are in the user's time zone (${timeZone}).`,
      inputSchema: {
        from: z.string().describe("First day, YYYY-MM-DD"),
        to: z.string().describe("Last day, YYYY-MM-DD"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ from, to }) =>
      guarded(() => {
        log("list_events");
        return text(entriesBetween(store.listCalendar(), from, to).slice(0, 300).map(entryOut));
      }),
  );

  mcp.registerTool(
    "create_event",
    {
      description: "Add an event to the user's calendar.",
      inputSchema: {
        title: z.string().min(1).max(200),
        ...when,
        description: z.string().max(4000).optional(),
        location: z.string().max(200).optional(),
      },
    },
    async (input) =>
      guarded(() => {
        if (!canWrite("calendar")) return turnedOff("calendar");
        log("create_event");
        const entry = calendarEntry(input, timeZone);
        store.saveCalendar([...store.listCalendar(), entry]);
        changed(["calendar"]);
        return text({ created: entryOut(entry) });
      }),
  );

  mcp.registerTool(
    "update_event",
    {
      description:
        "Change an event: its title, time, description or location. Fields left out stay as they are.",
      inputSchema: {
        id: z.string(),
        title: z.string().min(1).max(200).optional(),
        start: when.start.optional(),
        end: when.end,
        description: z.string().max(4000).optional(),
        location: z.string().max(200).optional(),
      },
    },
    async ({ id, title, start, end, description, location }) =>
      guarded(() => {
        if (!canWrite("calendar")) return turnedOff("calendar");
        log("update_event");
        const entries = store.listCalendar();
        const existing = entries.find((entry) => entry.id === id);
        if (!existing) return failure("No event with that id. list_events gives the ids.");
        const timing = start
          ? calendarEntry({ title: existing.title, start, end }, timeZone)
          : null;
        const updated: CalendarEntry = {
          ...existing,
          ...(title ? { title: title.trim() } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(location !== undefined ? { location } : {}),
          ...(timing
            ? {
                start: timing.start,
                end: timing.end,
                allDay: timing.allDay ?? false,
                ...(timing.timeZone ? { timeZone: timing.timeZone } : {}),
              }
            : {}),
        };
        store.saveCalendar(entries.map((entry) => (entry.id === id ? updated : entry)));
        changed(["calendar"]);
        return text({ updated: entryOut(updated) });
      }),
  );

  mcp.registerTool(
    "delete_event",
    {
      description: "Delete an event from the calendar.",
      inputSchema: { id: z.string() },
      annotations: { destructiveHint: true },
    },
    async ({ id }) =>
      guarded(() => {
        if (!canWrite("calendar")) return turnedOff("calendar");
        log("delete_event");
        const entries = store.listCalendar();
        const existing = entries.find((entry) => entry.id === id);
        if (!existing) return failure("No event with that id.");
        store.saveCalendar(entries.filter((entry) => entry.id !== id));
        changed(["calendar"]);
        return text({ deleted: existing.title });
      }),
  );
}
