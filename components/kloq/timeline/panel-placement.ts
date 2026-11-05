import { displayDate, minutesOfDate, parseInstant, wallMinutesBetween } from "../lib/instant";
import type { PlacedOccurrence } from "../lib/projection";

const MS_PER_DAY = 86_400_000;

export interface PanelPlacement {
  event: PlacedOccurrence;
  namesLong: string[];
  namesShort: string[];
}

export function panelPlacement(
  placed: PlacedOccurrence,
  zone: string | undefined,
  locale: string | undefined,
): PanelPlacement {
  const startMs = parseInstant(placed.start);
  const endMs = parseInstant(placed.end);
  const first = displayDate(startMs, zone);
  const days = placed.allDay ? Math.max(1, Math.round((endMs - startMs) / MS_PER_DAY)) : 1;
  const dates = Array.from({ length: days }, (_, i) => {
    const d = new Date(first);
    d.setDate(first.getDate() + i);
    return d;
  });
  const startMin = minutesOfDate(first);
  return {
    event: {
      ...placed,
      dayIndex: 0,
      endDayIndex: days - 1,
      startMin: placed.allDay ? 0 : startMin,
      endMin: placed.allDay ? 0 : startMin + wallMinutesBetween(placed.start, placed.end, zone),
      segment: { i: 0, n: 1 },
    },
    namesLong: dates.map((d) => d.toLocaleDateString(locale, { weekday: "long" })),
    namesShort: dates.map((d) => d.toLocaleDateString(locale, { weekday: "short" })),
  };
}
