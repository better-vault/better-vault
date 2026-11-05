import {
  Calendar01Icon,
  Calendar03Icon,
  Clock01Icon,
  Download04Icon,
  GoogleIcon,
  Link04Icon,
  Mail01Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Icon, type IconSvgElement } from "@/components/icon";
import { Sheet } from "@/components/panelui/sheet";

/** What the calendar settings will hold. None of it works yet: each row says so. */
const planned: { id: string; icon: IconSvgElement }[] = [
  { id: "google", icon: GoogleIcon },
  { id: "outlook", icon: Mail01Icon },
  { id: "apple", icon: Calendar01Icon },
  { id: "subscribe", icon: Link04Icon },
  { id: "export", icon: Download04Icon },
];

const preferences: { id: string; icon: IconSvgElement }[] = [
  { id: "weekStart", icon: Calendar03Icon },
  { id: "defaultView", icon: ViewIcon },
  { id: "timeFormat", icon: Clock01Icon },
];

/**
 * Settings → Calendar, kept for a later version like OneDrive in Storage:
 * connected calendars and preferences are listed, marked as coming soon.
 */
export function CalendarPanel() {
  const { t } = useTranslation("settings");
  return (
    <>
      <Sheet.Header title={t("calendar.title")} description={t("calendar.description")} />
      <Sheet.Body>
        <div className="flex flex-col gap-5 pb-4">
          <Group title={t("calendar.accounts")}>
            {planned.map(({ id, icon }) => (
              <SoonRow
                key={id}
                icon={icon}
                label={t(`calendar.items.${id}.label` as "calendar.items.google.label")}
                hint={t(`calendar.items.${id}.hint` as "calendar.items.google.hint")}
              />
            ))}
          </Group>
          <Group title={t("calendar.preferences")}>
            {preferences.map(({ id, icon }) => (
              <SoonRow
                key={id}
                icon={icon}
                label={t(`calendar.items.${id}.label` as "calendar.items.google.label")}
                hint={t(`calendar.items.${id}.hint` as "calendar.items.google.hint")}
              />
            ))}
          </Group>
        </div>
      </Sheet.Body>
    </>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="-mx-2 flex flex-col gap-0.5">
      <h3 className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

/** A row for something planned, drawn like the OneDrive row in Storage. */
function SoonRow({ icon, label, hint }: { icon: IconSvgElement; label: string; hint: string }) {
  const { t } = useTranslation("settings");
  return (
    <div
      aria-disabled
      className="flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 opacity-60"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
        <Icon icon={icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{hint}</span>
      </span>
      <span className="rounded-md border border-border px-1.5 py-0.5 text-xs text-muted-foreground">
        {t("storage.soon")}
      </span>
    </div>
  );
}
