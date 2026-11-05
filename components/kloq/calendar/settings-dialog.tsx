"use client";

/**
 * The settings dialog — General, Calendar accounts, Conferencing, Notifications.
 * Fully controlled: a `value`/`onChange` pair over a plain {@link KloqPreferences}.
 */

import { Bell, CalendarCog, Settings2, Video } from "@/components/kloq/lib/icons";
import * as React from "react";
import {
  type CalendarAccount,
  type CalendarSource,
  CONFERENCING_PROVIDERS,
  type ConferencingProvider,
  defaultAccount,
  providerLabel,
  useCalendarSources,
} from "../lib/calendar-sources";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogPopup, DialogTitle } from "../ui/dialog";
import { Label } from "../ui/label";
import { SegmentedControl, SegmentedControlItem } from "../ui/segmented-control";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Separator } from "../ui/separator";
import { Switch } from "../ui/switch";
import { Tabs, TabsList, TabsPanel, TabsTab } from "../ui/tabs";
import { CalendarList } from "./calendar-list";
import { SectionLabel } from "./panel-rows";
import { useReturnFocus } from "./use-return-focus";

/** Which day a week starts on. `0` Sunday, `1` Monday, `6` Saturday. */
export type WeekStart = 0 | 1 | 6;

/** What the arrow keys move by: `"range"` steps a whole visible range, `"day"` one day. */
export type NavigationKeys = "range" | "day";

/** Everything the dialog edits. Flat, serialisable, nothing optional. */
export interface KloqPreferences {
  /** show Saturday and Sunday columns */
  showWeekends: boolean;
  /** show events you've declined */
  showDeclinedEvents: boolean;
  /** ISO week numbers in the gutter */
  showWeekNumbers: boolean;
  weekStartsOn: WeekStart;
  navigationKeys: NavigationKeys;
  /** BCP 47 tag, or `""` for "follow the system" */
  language: string;

  /** the host may show desktop notifications at all */
  desktopNotifications: boolean;
  /** fire an alert before each event */
  eventReminders: boolean;
  /** the default reminder offset stamped on new events, in minutes */
  defaultReminderMinutes: number;
  /** a once-a-morning summary of the day */
  dailyAgenda: boolean;
}

/** The values a host starts from. Matches `<Kloq>`'s own defaults. */
export const DEFAULT_PREFERENCES: KloqPreferences = {
  showWeekends: true,
  showDeclinedEvents: true,
  showWeekNumbers: false,
  weekStartsOn: 1,
  navigationKeys: "range",
  language: "",
  desktopNotifications: false,
  eventReminders: true,
  defaultReminderMinutes: 10,
  dailyAgenda: false,
};

/** Languages the built-in picker offers. A host passes its own. */
export const LANGUAGE_OPTIONS: readonly { id: string; label: string }[] = [
  { id: "", label: "System" },
  { id: "en-US", label: "English (US)" },
  { id: "en-GB", label: "English (UK)" },
  { id: "de-DE", label: "Deutsch" },
  { id: "fr-FR", label: "Français" },
];

const WEEK_START_OPTIONS = [
  { id: "0", label: "Sunday" },
  { id: "1", label: "Monday" },
  { id: "6", label: "Saturday" },
] as const;

const NAVIGATION_OPTIONS = [
  { id: "range", label: "Whole view" },
  { id: "day", label: "One day" },
] as const;

const REMINDER_OPTIONS = [
  { id: "0", label: "At start" },
  { id: "5", label: "5 min" },
  { id: "10", label: "10 min" },
  { id: "15", label: "15 min" },
  { id: "30", label: "30 min" },
] as const;

/** The dialog's four panes, in order. */
export type SettingsSection = "general" | "accounts" | "conferencing" | "notifications";

const SECTIONS: {
  id: SettingsSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "accounts", label: "Calendar accounts", icon: CalendarCog },
  { id: "conferencing", label: "Conferencing", icon: Video },
  { id: "notifications", label: "Notifications", icon: Bell },
];

export interface SettingsDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The current preferences. Fully controlled — no shadow copy. */
  value: KloqPreferences;
  /** A preference changed. The whole object, so a host can persist one blob. */
  onChange: (next: KloqPreferences) => void;

  /** Accounts to render. Omit to read the calendar-source registry. */
  accounts?: CalendarAccount[];
  /** Calendars to render. Omit to read the registry. */
  sources?: CalendarSource[];
  /** Conferencing options. Default: `CONFERENCING_PROVIDERS`. */
  conferencing?: readonly ConferencingProvider[];
  /** Languages offered. Default: {@link LANGUAGE_OPTIONS}. */
  languages?: readonly { id: string; label: string }[];

  /** "Add calendar account" was pressed. Omit and the button isn't rendered. */
  onAddAccount?: () => void;
  /** Forwarded to `CalendarList`. Omit → the registry. */
  onDisconnectAccount?: (accountId: string) => void;
  /** Forwarded to `CalendarList`. Omit → the registry. */
  onSetAccountConferencing?: (accountId: string, conferencing: string) => void;

  /** Which pane opens first. Default `"general"`. */
  defaultSection?: SettingsSection;
  className?: string;
}

export function SettingsDialog({
  open,
  onOpenChange,
  value,
  onChange,
  accounts,
  sources,
  conferencing = CONFERENCING_PROVIDERS,
  languages = LANGUAGE_OPTIONS,
  onAddAccount,
  onDisconnectAccount,
  onSetAccountConferencing,
  defaultSection = "general",
  className,
}: SettingsDialogProps): React.ReactElement {
  const [section, setSection] = React.useState<SettingsSection>(defaultSection);
  // Re-sync during render, not in an effect, so a reopen never paints the last pane.
  const [wasOpen, setWasOpen] = React.useState(open);
  const [lastDefault, setLastDefault] = React.useState(defaultSection);
  if (open !== wasOpen || defaultSection !== lastDefault) {
    setWasOpen(open);
    setLastDefault(defaultSection);
    if (open !== false) setSection(defaultSection);
  }

  const set = <K extends keyof KloqPreferences>(key: K, next: KloqPreferences[K]) =>
    onChange({ ...value, [key]: next });

  const finalFocus = useReturnFocus(open);
  const wide = React.useSyncExternalStore(subscribeWide, isWide, () => true);

  const panes: Record<SettingsSection, React.ReactNode> = {
    general: <GeneralSection value={value} set={set} languages={languages} stacked={!wide} />,
    accounts: (
      <div className="flex flex-col gap-3">
        <CalendarList
          accounts={accounts}
          sources={sources}
          heading={null}
          accountActions
          conferencing={conferencing}
          onDisconnectAccount={onDisconnectAccount}
          onSetAccountConferencing={onSetAccountConferencing}
          empty={<p className="text-sm text-muted-foreground">No accounts connected.</p>}
        />
        {onAddAccount && (
          <Button variant="outline" size="sm" onClick={onAddAccount}>
            Add calendar account
          </Button>
        )}
      </div>
    ),
    conferencing: (
      <ConferencingSection
        accounts={accounts}
        conferencing={conferencing}
        onSetAccountConferencing={onSetAccountConferencing}
      />
    ),
    notifications: <NotificationsSection value={value} set={set} />,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup
        className={cn("max-w-2xl max-sm:h-[calc(100dvh-(--spacing(12)))]", className)}
        finalFocus={finalFocus}
        data-craft="settings-dialog"
        data-craft-label="Settings — General / Accounts / Conferencing / Notifications"
      >
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Preferences are reported to the host — this dialog stores nothing.
          </DialogDescription>
        </DialogHeader>

        {wide ? (
          <Tabs
            value={section}
            onValueChange={(next) => setSection(next as SettingsSection)}
            orientation="vertical"
            className="min-h-92 gap-4 px-6 pb-6"
          >
            <TabsList
              variant="underline"
              aria-label="Settings sections"
              className="w-44 shrink-0 self-start"
            >
              {SECTIONS.map((s) => (
                <TabsTab key={s.id} value={s.id}>
                  <s.icon />
                  {s.label}
                </TabsTab>
              ))}
            </TabsList>
            {SECTIONS.map((s) => (
              <TabsPanel key={s.id} value={s.id} className="min-h-0 min-w-0 overflow-y-auto">
                {panes[s.id]}
              </TabsPanel>
            ))}
          </Tabs>
        ) : (
          // phones: four tabs do not fit a 320px strip, so the section is a Select and the
          // sheet keeps one height while the pane scrolls
          <div className="flex min-h-0 flex-1 flex-col gap-3 px-6 pb-6">
            <Select
              items={SECTIONS.map((s) => ({ value: s.id, label: s.label }))}
              value={section}
              onValueChange={(next) => setSection(next as SettingsSection)}
            >
              <SelectTrigger aria-label="Settings section">
                <SelectValue />
              </SelectTrigger>
              <SelectPopup>
                {SECTIONS.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectPopup>
            </Select>
            <div
              role="region"
              aria-label={SECTIONS.find((s) => s.id === section)?.label}
              className="min-h-0 flex-1 overflow-y-auto"
            >
              {panes[section]}
            </div>
          </div>
        )}
      </DialogPopup>
    </Dialog>
  );
}

const WIDE = "(min-width: 640px)";
const isWide = () => window.matchMedia(WIDE).matches;
function subscribeWide(onChange: () => void) {
  const mq = window.matchMedia(WIDE);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

type Setter = <K extends keyof KloqPreferences>(key: K, next: KloqPreferences[K]) => void;

function Row({
  label,
  hint,
  htmlFor,
  inline = false,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  /** a small control (a switch) stays beside its label at every width */
  inline?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "flex py-2",
        inline
          ? "items-start justify-between gap-4"
          : "flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
      )}
    >
      <div className={cn("min-w-0", inline ? "flex-1" : "sm:flex-1")}>
        <Label htmlFor={htmlFor} className="font-normal">
          {label}
        </Label>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className={cn("min-w-0", inline ? "shrink-0 pt-0.5" : "sm:shrink-0 sm:pt-0.5")}>
        {children}
      </div>
    </div>
  );
}

function Choice({
  label,
  options,
  value,
  onChange,
  fill,
}: {
  /** share the row's width between the options: the stacked phone layout */
  fill?: boolean;
  label: string;
  options: readonly { id: string; label: string }[];
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  return (
    <SegmentedControl
      size="sm"
      aria-label={label}
      fill={fill}
      value={value}
      onValueChange={(id) => onChange(id as string)}
    >
      {options.map((o) => (
        <SegmentedControlItem key={o.id} value={o.id}>
          {o.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

function Picker({
  id,
  label,
  options,
  value,
  onChange,
}: {
  id?: string;
  label: string;
  options: readonly { id: string; label: string }[];
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  const items = options.map((o) => ({ value: o.id, label: o.label }));
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(v as string)}>
      <SelectTrigger id={id} size="sm" aria-label={label} className="sm:w-44">
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        {items.map((it) => (
          <SelectItem key={it.value} value={it.value}>
            {it.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}

function GeneralSection({
  value,
  set,
  languages,
  stacked,
}: {
  stacked: boolean;
  value: KloqPreferences;
  set: Setter;
  languages: readonly { id: string; label: string }[];
}): React.ReactElement {
  return (
    <div className="flex flex-col divide-y">
      <Row
        label="Show weekends"
        hint="Saturday and Sunday columns"
        htmlFor="kloq-pref-weekends"
        inline
      >
        <Switch
          id="kloq-pref-weekends"
          checked={value.showWeekends}
          onCheckedChange={(v) => set("showWeekends", v === true)}
        />
      </Row>

      <Row
        label="Show declined events"
        hint="Events you've said no to stay on the grid"
        htmlFor="kloq-pref-declined"
        inline
      >
        <Switch
          id="kloq-pref-declined"
          checked={value.showDeclinedEvents}
          onCheckedChange={(v) => set("showDeclinedEvents", v === true)}
        />
      </Row>

      <Row
        label="Show week numbers"
        hint="ISO week number beside the date"
        htmlFor="kloq-pref-weeknums"
        inline
      >
        <Switch
          id="kloq-pref-weeknums"
          checked={value.showWeekNumbers}
          onCheckedChange={(v) => set("showWeekNumbers", v === true)}
        />
      </Row>

      <Row label="Start week on">
        <Choice
          fill={stacked}
          label="Start week on"
          options={WEEK_START_OPTIONS}
          value={String(value.weekStartsOn)}
          onChange={(id) => set("weekStartsOn", Number(id) as WeekStart)}
        />
      </Row>

      <Row label="Arrow keys move by" hint="What ← and → step through">
        <Choice
          fill={stacked}
          label="Arrow keys move by"
          options={NAVIGATION_OPTIONS}
          value={value.navigationKeys}
          onChange={(id) => set("navigationKeys", id as NavigationKeys)}
        />
      </Row>

      <Row label="Language" hint="Dates, times and weekday names" htmlFor="kloq-pref-language">
        <Picker
          id="kloq-pref-language"
          label="Language"
          options={languages}
          value={value.language}
          onChange={(id) => set("language", id)}
        />
      </Row>
    </div>
  );
}

// Conferencing is per account: the link is minted by the account that owns the calendar.
function ConferencingSection({
  accounts,
  conferencing,
  onSetAccountConferencing,
}: {
  accounts?: CalendarAccount[];
  conferencing: readonly ConferencingProvider[];
  onSetAccountConferencing?: (accountId: string, conferencing: string) => void;
}): React.ReactElement {
  const registry = useCalendarSources();
  const list = accounts ?? registry.accounts;
  const primary = defaultAccount(list);

  if (list.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Connect an account to choose how meetings are hosted.
      </p>
    );

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        New events use the conferencing set on the account they&rsquo;re created in
        {primary ? ` — currently ${primary.label}` : ""}. Nothing here mints a link; the
        host&rsquo;s create path reads the choice and does that.
      </p>
      <Separator />
      <div className="flex flex-col divide-y">
        {list.map((account) => (
          <Row key={account.id} label={account.label} hint={providerLabel(account)}>
            <Picker
              label={`Conferencing for ${account.label}`}
              options={conferencing}
              value={account.defaultConferencing ?? conferencing[0]?.id}
              onChange={(id) => onSetAccountConferencing?.(account.id, id)}
            />
          </Row>
        ))}
      </div>
    </div>
  );
}

function NotificationsSection({
  value,
  set,
}: {
  value: KloqPreferences;
  set: Setter;
}): React.ReactElement {
  return (
    <div className="flex flex-col divide-y">
      <Row
        label="Desktop notifications"
        hint="The host asks the browser for permission; the package never does"
        htmlFor="kloq-pref-desktop"
        inline
      >
        <Switch
          id="kloq-pref-desktop"
          checked={value.desktopNotifications}
          onCheckedChange={(v) => set("desktopNotifications", v === true)}
        />
      </Row>

      <Row
        label="Event reminders"
        hint="Alert before an event starts"
        htmlFor="kloq-pref-reminders"
        inline
      >
        <Switch
          id="kloq-pref-reminders"
          checked={value.eventReminders}
          onCheckedChange={(v) => set("eventReminders", v === true)}
        />
      </Row>

      <Row
        label="Default reminder"
        hint="Stamped on newly created events"
        htmlFor="kloq-pref-default-reminder"
      >
        <Picker
          id="kloq-pref-default-reminder"
          label="Default reminder"
          options={REMINDER_OPTIONS}
          value={String(value.defaultReminderMinutes)}
          onChange={(id) => set("defaultReminderMinutes", Number(id))}
        />
      </Row>

      <Row label="Daily agenda" hint="One summary each morning" htmlFor="kloq-pref-agenda" inline>
        <Switch
          id="kloq-pref-agenda"
          checked={value.dailyAgenda}
          onCheckedChange={(v) => set("dailyAgenda", v === true)}
        />
      </Row>

      <SectionLabel as="h3" className="pt-3">
        Delivery
      </SectionLabel>
      <p className="py-2 text-xs text-muted-foreground">
        These switches record your preferences. kloq surfaces reminders in the calendar; delivering
        notifications is up to your app.
      </p>
    </div>
  );
}
