import { useState } from "react";

export type Field = "rrule" | "reminders" | "location" | "meetingUrl" | "attendees";

export interface Disclosure {
  id: string;
  fields: Partial<Record<Field, boolean>>;
  draft: string;
  invalid: boolean;
}

const fresh = (id: string): Disclosure => ({ id, fields: {}, draft: "", invalid: false });

/** Which optional rows the panel shows, plus the guest-input draft; keyed by event id so switching events needs no reset. */
export function useDisclosure(
  eventId: string,
  hasValue: Record<Field, boolean>,
  focusField: (f: Field) => void,
) {
  const [disc, setDisc] = useState<Disclosure>(() => fresh(eventId));
  const d = disc.id === eventId ? disc : fresh(eventId);
  const shows = (f: Field) => hasValue[f] || d.fields[f] === true;
  const reveal = (f: Field) => {
    setDisc({ ...d, fields: { ...d.fields, [f]: true } });
    requestAnimationFrame(() => focusField(f));
  };
  return { d, draft: d.draft, invalid: d.invalid, setDisc, shows, reveal };
}
