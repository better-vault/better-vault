import { useRef, useState } from "react";
import { MS_PER_MINUTE } from "../lib/date-math";
import { parseQuickAdd } from "../lib/quick-add";
import { useKloqSettings } from "./settings-context";

/** Inline "9:00 – 10:30"-style editing of a timed event's span, parsed by quick-add. */
export function useTimeEdit({
  enabled,
  spanStartMin,
  spanEndMin,
  onEditTime,
}: {
  enabled: boolean;
  spanStartMin: number;
  spanEndMin: number;
  onEditTime?: (startMin: number, endMin: number) => void;
}) {
  const g = useKloqSettings();
  const [timeEditing, setTimeEditing] = useState(false);
  const [timeDraft, setTimeDraft] = useState("");
  const [timeInvalid, setTimeInvalid] = useState(false);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const beginTimeEdit = () => {
    if (!enabled) return;
    setTimeDraft(g.formatRange(spanStartMin, spanEndMin));
    setTimeInvalid(false);
    setTimeEditing(true);
    requestAnimationFrame(() => timeInputRef.current?.select());
  };
  const commitTimeEdit = () => {
    const r = parseQuickAdd(timeDraft, g.displayNow());
    const heardATime = r.start !== null && !r.allDay && r.tokens.some((t) => t.kind === "time");
    if (!heardATime) {
      setTimeInvalid(true);
      return;
    }
    const startMin = r.start!.getHours() * 60 + r.start!.getMinutes();
    const duration = r.end
      ? Math.round((r.end.getTime() - r.start!.getTime()) / MS_PER_MINUTE)
      : spanEndMin - spanStartMin;
    if (duration <= 0) {
      setTimeInvalid(true);
      return;
    }
    onEditTime!(startMin, startMin + duration);
    setTimeEditing(false);
  };
  return {
    editing: timeEditing,
    draft: timeDraft,
    invalid: timeInvalid,
    inputRef: timeInputRef,
    begin: beginTimeEdit,
    commit: commitTimeEdit,
    setDraft: setTimeDraft,
    setEditing: setTimeEditing,
    setInvalid: setTimeInvalid,
  };
}
