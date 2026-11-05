"use client";

/**
 * The sidebar calendar list — accounts grouped, each calendar a colour dot,
 * a name and a visibility toggle. Reads the registry unless given props.
 */

import { Building2, Calendar as CalendarIcon, Globe, Lock, Mail, Unplug } from "@/components/kloq/lib/icons";
import * as React from "react";
import {
  accountDefaultCalendar,
  type CalendarAccount,
  type CalendarSource,
  CONFERENCING_PROVIDERS,
  type ConferencingProvider,
  conferencingLabel,
  disconnectAccount,
  groupByAccount,
  isVisible,
  providerLabel,
  setAccountConferencing,
  setAccountDefaultCalendar,
  setCalendarVisible,
  setDefaultAccount,
  setDefaultCalendar,
  useCalendarSources,
} from "../lib/calendar-sources";
import { cn } from "../lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { SegmentedControl, SegmentedControlItem } from "../ui/segmented-control";
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from "../ui/select";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { EVENT_COLORS } from "./event-block";

const PROVIDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  google: Mail,
  gmail: Mail,
  outlook: Building2,
  microsoft: Building2,
  office365: Building2,
  caldav: Globe,
  ical: Globe,
  icloud: Globe,
};

// module-scope so the looked-up icon isn't a new component identity per render
function ProviderIcon({
  provider,
  className,
}: {
  provider: string;
  className?: string;
}): React.ReactElement {
  const Icon = PROVIDER_ICONS[provider.toLowerCase()] ?? CalendarIcon;
  return <Icon className={className} />;
}

export interface CalendarListProps {
  /** Accounts to render. Omit to read the registry. */
  accounts?: CalendarAccount[];
  /** Calendars to render. Omit to read the registry. */
  sources?: CalendarSource[];
  /** A calendar's visibility was toggled. Omit → the registry. */
  onToggleVisible?: (id: string, visible: boolean) => void;
  /** A calendar was made the default. Omit → the registry. */
  onSetDefault?: (id: string) => void;
  /** Show the "make default" affordance on writable calendars. */
  allowSetDefault?: boolean;
  /** Render account-management chrome (conferencing picker, default account, Disconnect). */
  accountActions?: boolean;
  /** Conferencing options offered per account. Defaults to `CONFERENCING_PROVIDERS`. */
  conferencing?: readonly ConferencingProvider[];
  /** An account's default conferencing changed. Omit → the registry. */
  onSetAccountConferencing?: (accountId: string, conferencing: string) => void;
  /** An account was made the default. Omit → the registry. */
  onSetDefaultAccount?: (accountId: string) => void;
  /** Disconnect was pressed. Omit → the registry drops the account; no confirmation step. */
  onDisconnectAccount?: (accountId: string) => void;
  /** Section heading; pass `null` for none. Default "Calendars". */
  heading?: React.ReactNode;
  /** Rendered when nothing is registered. Default: render nothing at all. */
  empty?: React.ReactNode;
  className?: string;
}

export function CalendarList({
  accounts,
  sources,
  onToggleVisible,
  onSetDefault,
  allowSetDefault = true,
  accountActions = false,
  conferencing = CONFERENCING_PROVIDERS,
  onSetAccountConferencing,
  onSetDefaultAccount,
  onDisconnectAccount,
  heading = "Calendars",
  empty = null,
  className,
}: CalendarListProps): React.ReactElement | null {
  const registry = useCalendarSources();
  const resolvedAccounts = accounts ?? registry.accounts;
  const resolvedSources = sources ?? registry.sources;

  const groups = React.useMemo(
    () => groupByAccount(resolvedAccounts, resolvedSources),
    [resolvedAccounts, resolvedSources],
  );

  const toggle = React.useCallback(
    (cal: CalendarSource) => {
      const next = !isVisible(cal);
      if (onToggleVisible) onToggleVisible(cal.id, next);
      else setCalendarVisible(cal.id, next);
    },
    [onToggleVisible],
  );

  const makeDefault = React.useCallback(
    (cal: CalendarSource) => {
      // account-scoped and global defaults move together, or badge and create path disagree
      if (onSetDefault) onSetDefault(cal.id);
      else {
        setDefaultCalendar(cal.id);
        setAccountDefaultCalendar(cal.accountId, cal.id);
      }
    },
    [onSetDefault],
  );

  const setConferencing = React.useCallback(
    (accountId: string, id: string) => {
      if (onSetAccountConferencing) onSetAccountConferencing(accountId, id);
      else setAccountConferencing(accountId, id);
    },
    [onSetAccountConferencing],
  );

  const makeDefaultAccount = React.useCallback(
    (accountId: string) => {
      if (onSetDefaultAccount) onSetDefaultAccount(accountId);
      else setDefaultAccount(accountId);
    },
    [onSetDefaultAccount],
  );

  const disconnect = React.useCallback(
    (accountId: string) => {
      if (onDisconnectAccount) onDisconnectAccount(accountId);
      else disconnectAccount(accountId);
    },
    [onDisconnectAccount],
  );

  if (groups.length === 0) return empty === null ? null : <>{empty}</>;

  return (
    <div
      data-craft="calendar-list"
      data-craft-label="Accounts → calendars"
      className={cn("flex flex-col gap-3 text-sm", className)}
    >
      {heading !== null && (
        <h2 className="font-heading px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {heading}
        </h2>
      )}

      {groups.map((group) => (
        <section
          key={group.account.id}
          aria-label={group.account.label}
          data-craft="calendar-account"
          className="group/account flex flex-col gap-1"
        >
          <AccountHeader
            account={group.account}
            calendars={group.calendars}
            actions={accountActions}
            conferencing={conferencing}
            onSetConferencing={setConferencing}
            onMakeDefault={makeDefaultAccount}
            onDisconnect={disconnect}
          />

          {group.calendars.length === 0 ? (
            <p className="px-1 py-1 text-xs text-muted-foreground">No calendars</p>
          ) : (
            <ul className="flex flex-col">
              {group.calendars.map((cal) => (
                <CalendarRow
                  key={cal.id}
                  calendar={cal}
                  onToggle={toggle}
                  onMakeDefault={allowSetDefault ? makeDefault : undefined}
                />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function AccountHeader({
  account,
  calendars,
  actions,
  conferencing,
  onSetConferencing,
  onMakeDefault,
  onDisconnect,
}: {
  account: CalendarAccount;
  calendars: CalendarSource[];
  actions: boolean;
  conferencing: readonly ConferencingProvider[];
  onSetConferencing: (accountId: string, id: string) => void;
  onMakeDefault: (accountId: string) => void;
  onDisconnect: (accountId: string) => void;
}): React.ReactElement {
  const conference = conferencingLabel(account, conferencing);
  const landing = accountDefaultCalendar(account, calendars);

  return (
    <header className="flex flex-col gap-1 px-1">
      <div className="flex items-center gap-2">
        {account.avatarUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={account.avatarUrl}
            alt=""
            className="size-5 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-5 shrink-0 items-center justify-center rounded-full border text-muted-foreground"
          >
            <ProviderIcon provider={account.provider} className="size-3" />
          </span>
        )}

        <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {account.label}
        </span>

        {account.isDefault && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Badge variant="outline" size="sm">
                  Default
                </Badge>
              }
            />
            <TooltipPopup>
              New events land in this account
              {landing ? ` — ${landing.name}` : ""}
            </TooltipPopup>
          </Tooltip>
        )}

        {actions && !account.isDefault && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onMakeDefault(account.id)}
            className={cn(
              REVEAL,
              "group-hover/account:opacity-100 group-focus-within/account:opacity-100",
            )}
          >
            Set default
          </Button>
        )}

        {actions && (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={`Disconnect ${account.label}`}
                  onClick={() => onDisconnect(account.id)}
                  className={cn(
                    REVEAL,
                    "hover:text-destructive-foreground group-hover/account:opacity-100 group-focus-within/account:opacity-100",
                  )}
                >
                  <Unplug />
                </Button>
              }
            />
            <TooltipPopup>Disconnect — removes its calendars</TooltipPopup>
          </Tooltip>
        )}

        {!actions && (
          <span className="shrink-0 text-3xs text-muted-foreground uppercase">
            {providerLabel(account)}
          </span>
        )}
      </div>

      {actions ? (
        <div className="flex flex-wrap items-center justify-between gap-1.5 ps-7">
          <span className="text-2xs text-muted-foreground">{providerLabel(account)}</span>
          <Select
            items={conferencing.map((c) => ({ value: c.id, label: c.label }))}
            value={account.defaultConferencing ?? conferencing[0]?.id}
            onValueChange={(id) => id && onSetConferencing(account.id, id as string)}
          >
            <SelectTrigger
              size="xs"
              className="w-auto min-w-28"
              aria-label={`Default conferencing for ${account.label}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectPopup size="xs">
              {conferencing.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>
        </div>
      ) : (
        conference && <span className="ps-7 text-2xs text-muted-foreground">{conference}</span>
      )}
    </header>
  );
}

/** One-of-many choice on the `SegmentedControl` primitive, fed from `{ id, label }` options. */
export function SegmentedChoice<T extends { id: string; label: string }>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly T[];
  value: string | undefined;
  onChange: (id: string) => void;
  className?: string;
}): React.ReactElement {
  return (
    <SegmentedControl
      size="xs"
      aria-label={label}
      value={value}
      onValueChange={(id) => onChange(id as string)}
      className={className}
    >
      {options.map((o) => (
        <SegmentedControlItem key={o.id} value={o.id}>
          {o.label}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}

function CalendarRow({
  calendar,
  onToggle,
  onMakeDefault,
}: {
  calendar: CalendarSource;
  onToggle: (cal: CalendarSource) => void;
  onMakeDefault?: (cal: CalendarSource) => void;
}): React.ReactElement {
  const visible = isVisible(calendar);
  const swatch = EVENT_COLORS[calendar.color];

  return (
    <li className="group/cal flex items-center gap-1">
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-accent">
        <Checkbox
          checked={visible}
          onCheckedChange={() => onToggle(calendar)}
          // the calendar's own colour fills the box
          style={
            {
              "--primary": swatch.solid,
              "--primary-foreground": "var(--color-white)",
              borderColor: visible ? undefined : swatch.solid,
            } as React.CSSProperties
          }
        />

        <span
          className={cn(
            "truncate transition-colors",
            visible ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {calendar.name}
        </span>

        {calendar.readOnly && (
          <Tooltip>
            <TooltipTrigger
              render={
                <span className="shrink-0 text-muted-foreground">
                  <Lock className="size-3" aria-label="Read-only" />
                </span>
              }
            />
            <TooltipPopup>Read-only — events can&rsquo;t be edited here</TooltipPopup>
          </Tooltip>
        )}
      </label>

      {calendar.isDefault ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Badge variant="outline" size="sm">
                Default
              </Badge>
            }
          />
          <TooltipPopup>New events land here</TooltipPopup>
        </Tooltip>
      ) : (
        onMakeDefault &&
        !calendar.readOnly && (
          <Button
            variant="ghost"
            size="xs"
            onClick={() => onMakeDefault(calendar)}
            className={cn(REVEAL, "group-hover/cal:opacity-100 group-focus-within/cal:opacity-100")}
          >
            Set default
          </Button>
        )
      )}
    </li>
  );
}

// always in the a11y tree; only visible on hover/focus
const REVEAL =
  "shrink-0 text-muted-foreground opacity-0 transition-opacity focus-visible:opacity-100 pointer-coarse:opacity-100";
