import type { QuickAddTokenKind } from "./quick-add";

/**
 * How each understood phrase is labelled and drawn, everywhere quick add is shown. Themes may
 * give two kinds the same colour, so each also has its own underline style; `mark` carries both
 * and reads on plain text as well as in the field.
 */
export const QUICK_ADD_KINDS: Record<
  QuickAddTokenKind,
  { label: string; mark: string; swatch: string }
> = {
  date: { label: "date", mark: "decoration-solid decoration-info bg-info/12", swatch: "bg-info" },
  time: {
    label: "time",
    mark: "decoration-double decoration-brand bg-brand/12",
    swatch: "bg-brand",
  },
  duration: {
    label: "duration",
    mark: "decoration-dotted decoration-success bg-success/12",
    swatch: "bg-success",
  },
  location: {
    label: "location",
    mark: "decoration-dashed decoration-warning bg-warning/16",
    swatch: "bg-warning",
  },
  attendee: {
    label: "person",
    mark: "decoration-wavy decoration-primary bg-primary/10",
    swatch: "bg-primary",
  },
};

export const QUICK_ADD_KIND_ORDER = Object.keys(QUICK_ADD_KINDS) as QuickAddTokenKind[];
