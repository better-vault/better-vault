import { Asterisk, X } from "@/components/kloq/lib/icons";
import type { ReactElement } from "react";
import {
  attendeeLabel,
  attendeeStatus,
  avatarHue,
  initialsFor,
  STATUS_LABEL,
} from "../lib/attendees";
import type { Attendee, AttendeeStatus } from "../lib/event-types";
import { cn } from "../lib/utils";
import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

const STATUS_DOT: Record<AttendeeStatus, string> = {
  accepted: "bg-success",
  declined: "bg-destructive",
  tentative: "bg-warning",
  pending: "bg-muted-foreground/40",
};

function Action({ tip, children }: { tip: string; children: ReactElement }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipPopup>{tip}</TooltipPopup>
    </Tooltip>
  );
}

export function AttendeeChip({
  attendee,
  readOnly,
  organizer,
  you,
  onRemove,
  onCycle,
  onToggleOptional,
}: {
  attendee: Attendee;
  readOnly: boolean;
  /** RFC 5545 ORGANIZER */
  organizer: boolean;
  you: boolean;
  onRemove: () => void;
  onCycle: () => void;
  onToggleOptional: () => void;
}) {
  const hue = avatarHue(attendee.email);
  const status = attendeeStatus(attendee);
  const label = attendeeLabel(attendee);
  return (
    <li className="group/att flex items-center gap-2 rounded-md py-0.5 ps-2.5 pe-1 transition-colors hover:bg-accent/60">
      <span className="relative shrink-0">
        <span
          aria-hidden
          className={cn(
            "grid size-6 place-items-center rounded-full font-medium text-3xs tabular-nums",
            status === "declined" && "opacity-56",
          )}
          style={{
            backgroundColor: `color-mix(in oklab, hsl(${hue} 68% 50%) 18%, transparent)`,
            color: `color-mix(in oklab, hsl(${hue} 68% 46%) 28%, var(--foreground))`,
          }}
        >
          {initialsFor(attendee)}
        </span>
        <span
          aria-hidden
          className={cn(
            "absolute -end-px -bottom-px size-2 rounded-full ring-2 ring-card",
            STATUS_DOT[status],
          )}
        />
      </span>

      <span className="min-w-0 flex-1 leading-tight">
        <span
          className={cn(
            "block truncate text-xs text-foreground",
            status === "declined" && "line-through opacity-64",
          )}
        >
          {attendee.name ? (
            <Tooltip>
              <TooltipTrigger render={<span />}>{label}</TooltipTrigger>
              <TooltipPopup>{attendee.email}</TooltipPopup>
            </Tooltip>
          ) : (
            label
          )}
          {you ? <span className="ms-1 text-3xs text-muted-foreground">you</span> : null}
        </span>
        <span className="block truncate text-3xs text-muted-foreground">
          {STATUS_LABEL[status]}
          {organizer ? " · Organizer" : ""}
          {attendee.optional ? " · Optional" : ""}
        </span>
      </span>

      {readOnly ? null : (
        <span className="flex items-center opacity-0 transition-opacity group-hover/att:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100">
          <Action tip={attendee.optional ? "Mark as required" : "Mark as optional"}>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={
                attendee.optional ? `Mark ${label} as required` : `Mark ${label} as optional`
              }
              aria-pressed={attendee.optional === true}
              className={cn("text-muted-foreground", attendee.optional && "text-foreground")}
              onClick={onToggleOptional}
            >
              <Asterisk />
            </Button>
          </Action>
          <Action tip={`${STATUS_LABEL[status]} — change`}>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Set RSVP for ${label} — currently ${STATUS_LABEL[status]}`}
              className="text-muted-foreground"
              onClick={onCycle}
            >
              <span aria-hidden className={cn("size-2.5 rounded-full", STATUS_DOT[status])} />
            </Button>
          </Action>
          <Action tip="Remove guest">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={`Remove ${label}`}
              className="text-muted-foreground hover:text-destructive-foreground"
              onClick={onRemove}
            >
              <X />
            </Button>
          </Action>
        </span>
      )}
    </li>
  );
}
