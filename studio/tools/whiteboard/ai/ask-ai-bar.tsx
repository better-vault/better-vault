import {
  ArrowUp02Icon,
  Cancel01Icon,
  Mic02Icon,
  SparklesIcon,
  StopIcon,
  Tick02Icon,
} from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { Spinner } from "@/components/panelui/spinner";
import { useWhisperState } from "@/lib/voice/whisper";
import { cn } from "@/lib/utils";
import type { AskStatus } from "./use-ask-ai";
import { useVoice } from "./use-voice";

const round =
  "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-40";

/**
 * The "Ask AI" field at the foot of the board: one slim line to type a
 * question, or the microphone to say it. Speech is turned into text on the
 * device and put in the field; nothing is asked until the user sends it.
 */
export function AskAiBar({
  status,
  ready,
  about = 0,
  onClearAbout,
  onAsk,
  onStop,
  onClose,
}: {
  status: AskStatus;
  ready: boolean;
  /** How many selected items the question is about; 0 for the whole board. */
  about?: number;
  onClearAbout?: () => void;
  onAsk: (question: string) => void;
  onStop: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("studio");
  const [draft, setDraft] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const whisper = useWhisperState();
  const heard = useCallback((text: string) => {
    if (!text) return;
    setDraft((before) => (before.trim() ? `${before.trim()} ${text}` : text));
    requestAnimationFrame(() => field.current?.focus());
  }, []);
  const failed = useCallback(
    (message: string) => toast.error(t("whiteboard.ai.voiceError", { error: message })),
    [t],
  );
  const mic = useVoice(heard, failed);
  const busy = status !== "idle";

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (mic.recording) mic.cancel();
      else if (!busy) onClose();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [busy, mic, onClose]);

  const send = () => {
    const question = draft.trim();
    if (!question || busy || !ready) return;
    onAsk(question);
    setDraft("");
  };

  const hint = mic.transcribing
    ? whisper.phase === "loading"
      ? t("whiteboard.ai.voiceLoading", { percent: Math.round(whisper.progress * 100) })
      : t("whiteboard.ai.transcribing")
    : status === "thinking"
      ? t("whiteboard.ai.thinking")
      : status === "writing"
        ? t("whiteboard.ai.writing")
        : null;

  return (
    <div className="pointer-events-auto flex w-[min(30rem,calc(100%-2rem))] animate-in flex-col items-center gap-1.5 fade-in slide-in-from-bottom-2">
      {about > 0 ? (
        <span className="flex items-center gap-1 rounded-full bg-popover py-0.5 ps-2.5 pe-0.5 text-xs text-muted-foreground shadow-sm ring-1 ring-border">
          {t("whiteboard.ai.about", { count: about })}
          <button
            type="button"
            onClick={onClearAbout}
            aria-label={t("whiteboard.ai.clearAbout")}
            title={t("whiteboard.ai.clearAbout")}
            className="flex size-5 cursor-pointer items-center justify-center rounded-full hover:bg-accent hover:text-foreground"
          >
            <Icon icon={Cancel01Icon} size={10} />
          </button>
        </span>
      ) : null}
      <div
        className={cn(
          "flex h-11 w-full items-center gap-1 rounded-full bg-popover ps-3.5 pe-1.5 shadow-lg ring-1 ring-border transition-shadow",
          !mic.recording && "focus-within:ring-ring/60",
        )}
      >
        {mic.recording ? (
          <>
            <span className="relative flex size-2.5 shrink-0">
              <span className="absolute inset-0 animate-ping rounded-full bg-destructive/60 motion-reduce:animate-none" />
              <span className="relative size-2.5 rounded-full bg-destructive" />
            </span>
            <Wave levels={mic.levels} />
            <span className="w-9 shrink-0 text-end text-xs text-muted-foreground tabular-nums">
              {Math.floor(mic.seconds / 60)}:{String(mic.seconds % 60).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={mic.cancel}
              aria-label={t("whiteboard.ai.cancelRecording")}
              title={t("whiteboard.ai.cancelRecording")}
              className={cn(round, "text-muted-foreground hover:bg-accent hover:text-foreground")}
            >
              <Icon icon={Cancel01Icon} size={14} />
            </button>
            <button
              type="button"
              onClick={mic.done}
              aria-label={t("whiteboard.ai.finishRecording")}
              title={t("whiteboard.ai.finishRecording")}
              className={cn(round, "bg-primary text-primary-foreground hover:bg-primary/90")}
            >
              <Icon icon={Tick02Icon} size={15} />
            </button>
          </>
        ) : (
          <>
            {busy || mic.transcribing ? (
              <Spinner className="size-4 shrink-0 text-chart-5" />
            ) : (
              <Icon icon={SparklesIcon} size={16} className="shrink-0 text-chart-5" />
            )}
            <input
              ref={field}
              autoFocus
              value={draft}
              disabled={!ready}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder={
                !ready
                  ? t("whiteboard.ai.setUp")
                  : (hint ??
                    (about > 0
                      ? t("whiteboard.ai.placeholderAbout")
                      : t("whiteboard.ai.placeholder")))
              }
              aria-label={t("whiteboard.ai.placeholder")}
              className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            />
            {mic.available && !busy ? (
              <button
                type="button"
                onClick={() => void mic.start()}
                disabled={!ready || mic.transcribing}
                aria-label={t("whiteboard.ai.voice")}
                title={t("whiteboard.ai.voice")}
                className={cn(round, "text-muted-foreground hover:bg-accent hover:text-foreground")}
              >
                <Icon icon={Mic02Icon} size={16} />
              </button>
            ) : null}
            {busy ? (
              <button
                type="button"
                onClick={onStop}
                aria-label={t("whiteboard.ai.stop")}
                title={t("whiteboard.ai.stop")}
                className={cn(round, "bg-foreground text-background hover:bg-foreground/90")}
              >
                <Icon icon={StopIcon} size={13} />
              </button>
            ) : (
              <button
                type="button"
                onClick={send}
                disabled={!draft.trim() || !ready}
                aria-label={t("whiteboard.ai.send")}
                title={t("whiteboard.ai.send")}
                className={cn(round, "bg-primary text-primary-foreground hover:bg-primary/90")}
              >
                <Icon icon={ArrowUp02Icon} size={15} />
              </button>
            )}
            {!busy ? (
              <button
                type="button"
                onClick={onClose}
                aria-label={t("whiteboard.ai.close")}
                title={t("whiteboard.ai.close")}
                className={cn(
                  round,
                  "size-7 text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon icon={Cancel01Icon} size={13} />
              </button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/** A small live wave of bars that follows the microphone's loudness. */
function Wave({ levels }: { levels: number[] }) {
  return (
    <span
      aria-hidden
      className="flex h-6 min-w-0 flex-1 items-center justify-center gap-[3px] px-2"
    >
      {levels.map((value, at) => (
        <span
          key={at}
          className="w-[3px] rounded-full bg-foreground/70 transition-[height] duration-75"
          style={{ height: `${Math.max(3, Math.round(value * 22))}px` }}
        />
      ))}
    </span>
  );
}

/** The pen: a small dot with a soft halo, where the AI is writing. */
export function PenCursor({ at }: { at: [number, number] | null }) {
  if (!at) return null;
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-[left,top] duration-75 ease-out"
      style={{ left: at[0], top: at[1] }}
    >
      <span className="absolute inset-0 -m-3 animate-pulse rounded-full bg-chart-5/25 motion-reduce:animate-none" />
      <span className="relative block size-2.5 rounded-full bg-chart-5 shadow-[0_0_0_3px_var(--background)]" />
    </span>
  );
}
