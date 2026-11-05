import { useMemo } from "react";
import { Kloq, KloqToolbar, type CalEvent, type PersistenceAdapter } from "@/components/kloq";
import { calendarStore } from "@/lib/db/calendar";
import type { CalendarEntry } from "@/lib/db/types";

/**
 * The calendar, drawn by kloq (components/kloq): drag on the grid to add an
 * entry, double-click for quick add, drag or pull an edge to change one.
 * Entries are saved in the app's store; kloq's own ⌘K and design mode are
 * off, so the app's command palette keeps ⌘K.
 */
export default function CalendarView() {
  const persistence = useMemo<PersistenceAdapter>(
    () => ({
      load: async () => (await calendarStore.load()) as unknown as CalEvent[],
      save: (events) => {
        void calendarStore.save(events as unknown as CalendarEntry[]);
      },
    }),
    [],
  );
  return (
    <div className="h-full min-h-0">
      <Kloq
        defaultEvents={[]}
        persistence={persistence}
        storage="better-vault-calendar"
        commandPalette={false}
        designMode={false}
      >
        <KloqToolbar />
      </Kloq>
    </div>
  );
}
