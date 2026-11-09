import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Field } from "@/components/common/field";
import { Button } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import { Input } from "@/components/panelui/input";
import { calendarColors, type CalendarColor } from "@/lib/calendar/settings";
import {
  addSubscription,
  previewCalendar,
  type CalendarPreview,
} from "@/lib/calendar/subscriptions";
import { cn } from "@/lib/utils";

const swatch: Record<CalendarColor, string> = {
  blue: "bg-info",
  violet: "bg-chart-5",
  emerald: "bg-success",
  amber: "bg-warning",
  rose: "bg-destructive",
};

interface CalendarSubscribeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Subscribe to a calendar: paste an .ics address, see what it holds, then
 * give it a title and a colour before its entries join the calendar.
 */
export function CalendarSubscribeDialog({ open, onOpenChange }: CalendarSubscribeDialogProps) {
  const { t: tCommon } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="sm" closeLabel={tCommon("actions.close")}>
        {/* Mounted only while open, so each opening starts from the address. */}
        <SubscribeSteps close={() => onOpenChange(false)} />
      </Dialog.Content>
    </Dialog>
  );
}

function SubscribeSteps({ close }: { close: () => void }) {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  const urlId = useId();
  const titleId = useId();
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<CalendarPreview | null>(null);
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<CalendarColor>("blue");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchIt() {
    setBusy(true);
    setError(null);
    try {
      const next = await previewCalendar(url);
      setPreview(next);
      setTitle(next.name || new URL(next.url).hostname);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!preview) return;
    setBusy(true);
    try {
      const subscription = await addSubscription(preview, { title, color });
      toast.success(t("calendar.subscribe.added", { title: subscription.title }));
      close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  }

  if (!preview) {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (url.trim()) void fetchIt();
        }}
      >
        <Dialog.Header
          title={t("calendar.subscribe.title")}
          description={t("calendar.subscribe.description")}
        />
        <Dialog.Body>
          <Field label={t("calendar.subscribe.url")} htmlFor={urlId} hint={error ?? undefined}>
            <Input
              id={urlId}
              type="url"
              inputMode="url"
              dir="ltr"
              autoFocus
              required
              placeholder="webcal://…/calendar.ics"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              aria-invalid={error ? true : undefined}
            />
          </Field>
        </Dialog.Body>
        <Dialog.Footer>
          <Button type="button" variant="secondary" onClick={close}>
            {tCommon("actions.cancel")}
          </Button>
          <Button type="submit" disabled={busy || !url.trim()}>
            {busy ? t("calendar.subscribe.fetching") : t("calendar.subscribe.fetch")}
          </Button>
        </Dialog.Footer>
      </form>
    );
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Dialog.Header
        title={t("calendar.subscribe.reviewTitle")}
        description={t("calendar.subscribe.found", { count: preview.count })}
      />
      <Dialog.Body>
        <div className="flex flex-col gap-4">
          <Field label={t("calendar.subscribe.name")} htmlFor={titleId} hint={error ?? undefined}>
            <Input
              id={titleId}
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>
          <Field label={t("calendar.subscribe.color")}>
            <div
              role="radiogroup"
              aria-label={t("calendar.subscribe.color")}
              className="flex gap-2"
            >
              {calendarColors.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={color === value}
                  aria-label={t(`calendar.colors.${value}`)}
                  title={t(`calendar.colors.${value}`)}
                  onClick={() => setColor(value)}
                  className={cn(
                    "size-7 cursor-pointer rounded-full ring-offset-2 ring-offset-background outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40",
                    swatch[value],
                    color === value && "ring-2 ring-foreground",
                  )}
                />
              ))}
            </div>
          </Field>
          <p className="truncate text-xs text-muted-foreground" dir="ltr">
            {preview.url}
          </p>
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <Button type="button" variant="secondary" onClick={() => setPreview(null)}>
          {tCommon("actions.back")}
        </Button>
        <Button type="submit" disabled={busy}>
          {t("calendar.subscribe.add")}
        </Button>
      </Dialog.Footer>
    </form>
  );
}
