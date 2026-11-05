interface EventRef {
  title?: string;
}

export interface WhenRef {
  day?: string;
  time?: string;
  /** when true, `time` is ignored */
  allDay?: boolean;
}

export function eventName(e: EventRef | undefined): string {
  const t = e?.title?.trim();
  return t ? t : "Untitled event";
}

export function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function describeWhen(when: WhenRef | undefined): string {
  if (!when) return "";
  const parts: string[] = [];
  if (when.day) parts.push(when.day);
  if (when.allDay) parts.push("all day");
  else if (when.time) parts.push(when.time);
  return parts.join(", ");
}

const withWhen = (head: string, when: WhenRef | undefined, joiner = "to") => {
  const tail = describeWhen(when);
  if (!tail) return head;
  return joiner ? `${head} ${joiner} ${tail}` : `${head} ${tail}`;
};

export function announceMoved(e: EventRef, when: WhenRef): string {
  return withWhen(`${eventName(e)} moved`, when);
}

export function announceResized(e: EventRef, when: WhenRef): string {
  return withWhen(`${eventName(e)} resized`, when);
}

export function announceSpanned(e: EventRef, when: WhenRef): string {
  return withWhen(`${eventName(e)} now spans`, when, "");
}

export function announceCreated(e: EventRef, when: WhenRef): string {
  const tail = describeWhen(when);
  const name = e.title?.trim();
  const head = name ? `${name} created` : "New event created";
  return tail ? `${head}, ${tail}` : head;
}

export function announceDuplicated(e: EventRef, when: WhenRef): string {
  return withWhen(`${eventName(e)} duplicated`, when);
}

export function announceDeleted(events: readonly EventRef[]): string {
  if (events.length === 0) return "";
  if (events.length === 1) return `${eventName(events[0])} deleted`;
  return `${count(events.length, "event")} deleted`;
}

export function announceColor(events: readonly EventRef[], color: string): string {
  if (events.length === 0) return "";
  if (events.length === 1) return `${eventName(events[0])} is now ${color}`;
  return `${count(events.length, "event")} are now ${color}`;
}

export function announceCalendar(e: EventRef, calendar: string): string {
  return `${eventName(e)} moved to ${calendar}`;
}

export function announceAllDay(e: EventRef, allDay: boolean, when?: WhenRef): string {
  const name = eventName(e);
  if (!allDay) return withWhen(`${name} is no longer all day, moved`, when);
  // the day only — the full `when` clause would read "all day, Tuesday, all day"
  const tail = when?.day ?? "";
  return tail ? `${name} is now all day, ${tail}` : `${name} is now all day`;
}

/** Named for the sentence, not the engine: a lane move and a lane resize are both "span". */
export type RefusedGesture = "create" | "move" | "resize" | "span" | "duplicate" | "paste";

const REFUSED_VERB: Record<Exclude<RefusedGesture, "create">, string> = {
  move: "cannot be moved there",
  resize: "cannot be resized that far",
  span: "cannot span those days",
  duplicate: "cannot be duplicated there",
  paste: "cannot be pasted there",
};

/** A refused drop. Said once per gesture, never per frame. */
export function announceRefused(gesture: RefusedGesture, e?: EventRef): string {
  if (gesture === "create") return "Cannot create an event there";
  return `${eventName(e)} ${REFUSED_VERB[gesture]}`;
}

export function describeUnavailable(when: WhenRef): string {
  const tail = describeWhen(when);
  return tail ? `Unavailable, ${tail}` : "Unavailable";
}

/** Deliberately undescriptive: the store knows that something changed, not what. */
export const announceUndo = () => "Undone";
export const announceRedo = () => "Redone";

export function announceSelection(n: number): string {
  if (n === 0) return "Selection cleared";
  return `${count(n, "event")} selected`;
}

export function announceView(view: string, range?: string): string {
  return range ? `${view}, ${range}` : view;
}

/** A view the box is too narrow for, then where the calendar landed instead. */
export function announceFolded(asked: string, where: string): string {
  return `${asked} needs a wider calendar. ${where}`;
}

/** `formatDay` is injected so the caller owns locale and zone — this module never touches `Intl`. */
export function describeRange(days: readonly Date[], formatDay: (d: Date) => string): string {
  if (days.length === 0) return "";
  const first = formatDay(days[0]);
  if (days.length === 1) return first;
  const last = formatDay(days[days.length - 1]);
  return first === last ? first : `${first} to ${last}`;
}

/**
 * Optimistic commit rejected and rolled back. The one assertive announcement:
 * the visual tell is a shake, which `prefers-reduced-motion` suppresses.
 */
export function announceReverted(events: readonly EventRef[]): string {
  if (events.length === 0) return "Change could not be saved and was undone";
  if (events.length === 1) return `${eventName(events[0])} could not be saved and was put back`;
  return `${count(events.length, "change")} could not be saved and were put back`;
}
