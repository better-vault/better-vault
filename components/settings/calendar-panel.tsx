import {
  Add01Icon,
  Calendar01Icon,
  Delete02Icon,
  Download04Icon,
  GoogleIcon,
  Link04Icon,
  Mail01Icon,
  RefreshIcon,
} from "@hugeicons/core-free-icons";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Segmented } from "@/components/common/segmented";
import { Icon, type IconSvgElement } from "@/components/icon";
import { Select } from "@/components/panelui/select";
import { Sheet } from "@/components/panelui/sheet";
import { Switch } from "@/components/panelui/switch";
import {
  calendarViews,
  updateCalendarSettings,
  useCalendarSettings,
  type CalendarSubscription,
} from "@/lib/calendar/settings";
import { refreshSubscription, removeSubscription } from "@/lib/calendar/subscriptions";
import { cn } from "@/lib/utils";

/** Accounts that need a sign-in of their own; they come in a later version. */
const planned: { id: string; icon: IconSvgElement }[] = [
  { id: "google", icon: GoogleIcon },
  { id: "outlook", icon: Mail01Icon },
  { id: "apple", icon: Calendar01Icon },
  { id: "export", icon: Download04Icon },
];

const hours = Array.from({ length: 25 }, (_, hour) => hour);

/**
 * Settings → Calendar: how the calendar looks, and the calendars followed by
 * their .ics address. Subscribing opens a dialog, so the sheet closes first.
 */
export function CalendarPanel({ onSubscribe }: { onSubscribe: () => void }) {
  const { t, i18n } = useTranslation("settings");
  const settings = useCalendarSettings();
  if (!settings) return null;
  const working = settings.workingHours;
  const hourLabel = (hour: number) =>
    new Date(2000, 0, 1, hour % 24).toLocaleTimeString(i18n.language, {
      hour: "numeric",
      hour12: settings.timeFormat === "auto" ? undefined : settings.timeFormat === "12",
    });

  return (
    <>
      <Sheet.Header title={t("calendar.title")} description={t("calendar.description")} />
      <Sheet.Body>
        <div className="flex flex-col gap-6 pb-4">
          <section aria-label={t("calendar.preferences")} className="flex flex-col gap-4">
            <h3 className="text-xs font-medium text-muted-foreground">
              {t("calendar.preferences")}
            </h3>
            <Field label={t("calendar.items.weekStart.label")}>
              <Segmented
                aria-label={t("calendar.items.weekStart.label")}
                value={String(settings.weekStartsOn) as "0" | "1" | "6"}
                onValueChange={(value) =>
                  void updateCalendarSettings({ weekStartsOn: Number(value) as 0 | 1 | 6 })
                }
                className="w-full *:flex-1"
                options={[
                  { value: "1", label: t("calendar.days.monday") },
                  { value: "0", label: t("calendar.days.sunday") },
                  { value: "6", label: t("calendar.days.saturday") },
                ]}
              />
            </Field>
            <Field
              label={t("calendar.items.defaultView.label")}
              hint={t("calendar.items.defaultView.hint")}
            >
              <Segmented
                aria-label={t("calendar.items.defaultView.label")}
                value={settings.defaultView}
                onValueChange={(defaultView) => void updateCalendarSettings({ defaultView })}
                className="w-full *:flex-1"
                options={calendarViews.map((value) => ({
                  value,
                  label: t(`calendar.views.${value}`),
                }))}
              />
            </Field>
            <Field label={t("calendar.items.timeFormat.label")}>
              <Segmented
                aria-label={t("calendar.items.timeFormat.label")}
                value={settings.timeFormat}
                onValueChange={(timeFormat) => void updateCalendarSettings({ timeFormat })}
                className="w-full *:flex-1"
                options={[
                  { value: "auto", label: t("calendar.timeFormats.auto") },
                  { value: "12", label: t("calendar.timeFormats.12") },
                  { value: "24", label: t("calendar.timeFormats.24") },
                ]}
              />
            </Field>
            <SwitchRow
              label={t("calendar.items.weekNumbers.label")}
              hint={t("calendar.items.weekNumbers.hint")}
              checked={settings.weekNumbers}
              onChange={(weekNumbers) => void updateCalendarSettings({ weekNumbers })}
            />
            <SwitchRow
              label={t("calendar.items.workingHours.label")}
              hint={t("calendar.items.workingHours.hint")}
              checked={working !== false}
              onChange={(on) =>
                void updateCalendarSettings({ workingHours: on ? { start: 9, end: 17 } : false })
              }
            />
            {working ? (
              <div className="grid grid-cols-2 gap-3">
                <HourSelect
                  label={t("calendar.workingFrom")}
                  value={working.start}
                  options={hours.filter((hour) => hour < working.end)}
                  format={hourLabel}
                  onChange={(start) =>
                    void updateCalendarSettings({ workingHours: { ...working, start } })
                  }
                />
                <HourSelect
                  label={t("calendar.workingTo")}
                  value={working.end}
                  options={hours.filter((hour) => hour > working.start)}
                  format={hourLabel}
                  onChange={(end) =>
                    void updateCalendarSettings({ workingHours: { ...working, end } })
                  }
                />
              </div>
            ) : null}
          </section>

          <Group title={t("calendar.subscriptions")}>
            {settings.subscriptions.map((subscription) => (
              <SubscriptionRow key={subscription.id} subscription={subscription} />
            ))}
            <button
              type="button"
              onClick={onSubscribe}
              className="flex w-full cursor-pointer items-center gap-3 rounded-2xl px-2.5 py-2.5 text-start outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
                <Icon icon={settings.subscriptions.length ? Add01Icon : Link04Icon} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">
                  {t("calendar.items.subscribe.label")}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {t("calendar.items.subscribe.hint")}
                </span>
              </span>
            </button>
          </Group>

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
        </div>
      </Sheet.Body>
    </>
  );
}

function SwitchRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );
}

function HourSelect({
  label,
  value,
  options,
  format,
  onChange,
}: {
  label: string;
  value: number;
  options: number[];
  format: (hour: number) => string;
  onChange: (hour: number) => void;
}) {
  return (
    <Field label={label}>
      <Select
        items={options.map((hour) => ({ value: hour, label: format(hour) }))}
        value={value}
        onValueChange={(next) => typeof next === "number" && onChange(next)}
      >
        <Select.Trigger aria-label={label} className="w-full">
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {options.map((hour) => (
            <Select.Item key={hour} value={hour}>
              {format(hour)}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    </Field>
  );
}

const swatch: Record<CalendarSubscription["color"], string> = {
  blue: "bg-info",
  violet: "bg-chart-5",
  emerald: "bg-success",
  amber: "bg-warning",
  rose: "bg-destructive",
};

/** A followed calendar: refresh it now, or stop following it (its entries go too). */
function SubscriptionRow({ subscription }: { subscription: CalendarSubscription }) {
  const { t } = useTranslation("settings");
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex items-center gap-3 rounded-2xl px-2.5 py-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted">
        <span className={cn("size-3 rounded-full", swatch[subscription.color])} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{subscription.title}</span>
        <span className="block truncate text-xs text-muted-foreground" dir="ltr">
          {subscription.url}
        </span>
      </span>
      <button
        type="button"
        disabled={busy}
        aria-label={t("calendar.refresh")}
        title={t("calendar.refresh")}
        onClick={() => void run(() => refreshSubscription(subscription), t("calendar.refreshed"))}
        className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <Icon icon={RefreshIcon} size={16} className={cn(busy && "animate-spin")} />
      </button>
      <button
        type="button"
        disabled={busy}
        aria-label={t("calendar.unsubscribe")}
        title={t("calendar.unsubscribe")}
        onClick={() =>
          void run(() => removeSubscription(subscription.id), t("calendar.unsubscribed"))
        }
        className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
      >
        <Icon icon={Delete02Icon} size={16} />
      </button>
    </div>
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
