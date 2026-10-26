import type { Conversation } from "@/lib/db/database";

export const historyGroups = ["today", "yesterday", "week", "older"] as const;
export type HistoryGroup = (typeof historyGroups)[number];

const DAY = 24 * 60 * 60 * 1000;

/**
 * Conversations grouped by when they were last used: today, yesterday, the
 * 7 days before, and older, keeping their order. Days follow local midnight.
 */
export function groupByDay(
  conversations: readonly Conversation[],
  now = Date.now(),
): { group: HistoryGroup; conversations: Conversation[] }[] {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  const today = midnight.getTime();
  const groupOf = (time: number): HistoryGroup =>
    time >= today
      ? "today"
      : time >= today - DAY
        ? "yesterday"
        : time >= today - 7 * DAY
          ? "week"
          : "older";
  const out = new Map<HistoryGroup, Conversation[]>();
  for (const conversation of conversations) {
    const group = groupOf(conversation.updatedAt);
    out.set(group, [...(out.get(group) ?? []), conversation]);
  }
  return historyGroups.flatMap((group) =>
    out.has(group) ? [{ group, conversations: out.get(group)! }] : [],
  );
}
