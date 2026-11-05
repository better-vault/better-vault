import { store } from "./store";
import type { CalendarEntry } from "./types";

/**
 * Where the calendar keeps its entries: the app's own store (IndexedDB on the
 * web, SQLite on desktop), so they are local like everything else and go
 * into backups. kloq hands over its whole list on every committed change.
 */
export const calendarStore = {
  load: (): Promise<CalendarEntry[]> => store().listCalendar(),
  save: (entries: readonly CalendarEntry[]): Promise<void> => store().saveCalendar([...entries]),
};
