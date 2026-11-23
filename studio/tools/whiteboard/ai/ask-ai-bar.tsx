import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { Prompt } from "@/components/panelui/prompt";
import type { AskStatus } from "./use-ask-ai";
import { useVoice } from "./use-voice";

/**
 * The compact "Ask AI" field at the foot of the board: one line to type a
 * question, or the microphone to say it.
 */
export function AskAiBar({
  status,
  ready,
  voice,
  about = 0,
  onClearAbout,
  onAsk,
  onStop,
  onClose,
  onSetUp,
}: {
  status: AskStatus;
  ready: boolean;
  voice: { provider: "openai" | "elevenlabs" | "google"; apiKey: string } | null;
  /** How many selected items the question is about; 0 for the whole board. */
  about?: number;
  onClearAbout?: () => void;
  onAsk: (question: string) => void;
  onStop: () => void;
  onClose: () => void;
  onSetUp?: () => void;
}) {
  const { t } = useTranslation("studio");
  const [draft, setDraft] = useState("");
  const heard = useCallback((text: string) => {
    if (text) setDraft(text);
  }, []);
  const failed = useCallback(
    (message: string) => toast.error(t("whiteboard.ai.voiceError", { error: message })),
    [t],
  );
  const mic = useVoice(voice, heard, failed);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape" && status === "idle" && !mic.recording) onClose();
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [mic.recording, onClose, status]);

  return (
    <div className="pointer-events-auto relative w-[min(34rem,calc(100%-2rem))] animate-in fade-in slide-in-from-bottom-2">
      <button
        type="button"
        onClick={onClose}
        aria-label={t("whiteboard.ai.close")}
        className="absolute -end-2.5 -top-2.5 z-10 flex size-6 cursor-pointer items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm ring-1 ring-border hover:text-foreground"
      >
        <Icon icon={Cancel01Icon} size={12} />
      </button>
      {about > 0 ? (
        <div className="mb-1.5 flex justify-center">
          <span className="flex items-center gap-1.5 rounded-full bg-chart-5/15 py-1 ps-3 pe-1 text-xs font-medium text-chart-5 shadow-sm backdrop-blur">
            {t("whiteboard.ai.about", { count: about })}
            <button
              type="button"
              onClick={onClearAbout}
              aria-label={t("whiteboard.ai.clearAbout")}
              title={t("whiteboard.ai.clearAbout")}
              className="flex size-5 cursor-pointer items-center justify-center rounded-full hover:bg-chart-5/20"
            >
              <Icon icon={Cancel01Icon} size={11} />
            </button>
          </span>
        </div>
      ) : null}
      <Prompt
        value={draft}
        onValueChange={setDraft}
        status={status === "idle" ? (mic.transcribing ? "submitted" : "idle") : "streaming"}
        disabled={!ready}
        onStop={onStop}
        onSubmit={({ text }) => {
          const question = text.trim();
          if (!question) return;
          onAsk(question);
          setDraft("");
        }}
        className="shadow-lg"
      >
        <Prompt.Banner open={!ready}>
          {t("whiteboard.ai.setUp")}
          {onSetUp ? (
            <Prompt.BannerAction onClick={onSetUp}>
              {t("whiteboard.ai.setUpAction")}
            </Prompt.BannerAction>
          ) : null}
        </Prompt.Banner>
        <Prompt.Field layout="inline">
          {mic.recording ? (
            <Prompt.Recorder
              level={mic.level}
              placeholder={t("whiteboard.ai.listening")}
              cancelLabel={t("whiteboard.ai.cancelRecording")}
              doneLabel={t("whiteboard.ai.finishRecording")}
              onCancel={mic.cancel}
              onDone={mic.done}
            />
          ) : (
            <>
              <Prompt.Textarea
                autoFocus
                minRows={1}
                maxRows={4}
                placeholder={
                  status === "thinking"
                    ? t("whiteboard.ai.thinking")
                    : status === "writing"
                      ? t("whiteboard.ai.writing")
                      : about > 0
                        ? t("whiteboard.ai.placeholderAbout")
                        : t("whiteboard.ai.placeholder")
                }
                aria-label={t("whiteboard.ai.placeholder")}
              />
              <Prompt.Submit
                sendLabel={t("whiteboard.ai.send")}
                stopLabel={t("whiteboard.ai.stop")}
                onVoice={mic.available ? () => void mic.start() : undefined}
                listening={mic.recording}
              />
            </>
          )}
        </Prompt.Field>
      </Prompt>
    </div>
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
