import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { OutputChrome } from "./form";

const floating =
  "pointer-events-auto flex size-10 cursor-pointer items-center justify-center rounded-2xl border bg-background/95 shadow-sm backdrop-blur transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-muted";

/**
 * The top-start controls of an immersive viewer (a whiteboard, a mind map):
 * back to the Studio list, and the output's icon, which shows its name and
 * details when pointed at or tapped.
 */
export function OutputInfo({ chrome }: { chrome: OutputChrome }) {
  const { t } = useTranslation("studio");
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={chrome.onClose}
        aria-label={t("viewer.back")}
        title={t("viewer.back")}
        className={floating}
      >
        <Icon icon={ArrowLeft01Icon} size={18} className="rtl:rotate-180" />
      </button>
      <HoverCard open={open} onOpenChange={setOpen}>
        <HoverCardTrigger
          delay={150}
          closeDelay={100}
          render={
            <button
              type="button"
              aria-label={`${chrome.title} · ${chrome.meta}`}
              onClick={() => setOpen(true)}
              className={floating}
            />
          }
        >
          <Icon icon={chrome.icon} size={18} className={chrome.tint} />
        </HoverCardTrigger>
        <HoverCardContent
          side="bottom"
          align="start"
          sideOffset={8}
          className="w-72 rounded-2xl p-3"
        >
          <p className="text-sm font-semibold break-words">{chrome.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{chrome.meta}</p>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}
