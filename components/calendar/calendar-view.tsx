import { useEffect, useMemo, useState } from "react";
import {
  Kloq,
  KloqNav,
  KloqToolbar,
  type CalEvent,
  type PersistenceAdapter,
} from "@/components/kloq";
import { hour12Of, useCalendarSettings } from "@/lib/calendar/settings";
import { CALENDAR_RELOAD, refreshStaleSubscriptions } from "@/lib/calendar/subscriptions";
import { calendarStore } from "@/lib/db/calendar";
import type { CalendarEntry } from "@/lib/db/types";

/**
 * The calendar, drawn by kloq (components/kloq): drag on the grid to add an
 * entry, double-click for quick add, drag or pull an edge to change one.
 * Entries are saved in the app's store; kloq's own ⌘K and design mode are
 * off, so the app's command palette keeps ⌘K. Preferences come from
 * Settings → Calendar, and subscribed calendars refresh when it opens.
 */
export default function CalendarView() {
  const settings = useCalendarSettings();
  // kloq loads entries once; a new key reloads it after a subscription changes them.
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const reload = () => setRevision((value) => value + 1);
    window.addEventListener(CALENDAR_RELOAD, reload);
    void refreshStaleSubscriptions();
    return () => window.removeEventListener(CALENDAR_RELOAD, reload);
  }, []);

  const persistence = useMemo<PersistenceAdapter>(
    () => ({
      load: async () => (await calendarStore.load()) as unknown as CalEvent[],
      save: (events) => {
        void calendarStore.save(events as unknown as CalendarEntry[]);
      },
    }),
    [],
  );
  if (!settings) return null;
  return (
    <div className="h-full min-h-0">
      <Kloq
        key={revision}
        defaultEvents={[]}
        persistence={persistence}
        storage="better-vault-calendar"
        commandPalette={false}
        designMode={false}
        weekStartsOn={settings.weekStartsOn}
        defaultView={settings.defaultView}
        hour12={hour12Of(settings.timeFormat)}
        showWeekNumbers={settings.weekNumbers}
        workingHours={settings.workingHours}
      >
        {/* Only the navigation: kloq's "Restore sample events" would replace the user's entries. */}
        <KloqToolbar>
          <KloqNav />
        </KloqToolbar>
      </Kloq>
    </div>
  );
}
