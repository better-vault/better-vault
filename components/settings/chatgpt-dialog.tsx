"use client";

import { Loading03Icon } from "@hugeicons/core-free-icons";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { ProviderIcon } from "@/components/provider-icon";
import { Button, buttonVariants } from "@/components/panelui/button";
import { Dialog } from "@/components/panelui/dialog";
import {
  accountLabel,
  cancelChatGPTLogin,
  chatGPTUsageUrl,
  pollChatGPTLogin,
  startChatGPTLogin,
  type ChatGPTAccount,
} from "@/lib/chatgpt/client";
import { updateProvider } from "@/lib/db/settings";

/** Set once the first-sign-in welcome has been shown, as OpenAI's guidelines ask. */
const WELCOMED_KEY = "better-vault:chatgpt-welcomed";

type Step =
  | { kind: "intro" }
  | { kind: "waiting"; url: string }
  | { kind: "welcome" }
  | { kind: "failed"; error: string };

interface ChatGPTDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Continue with ChatGPT: opens OpenAI's sign-in in the browser, waits for the
 * local server to receive it, then saves who signed in.
 */
export function ChatGPTDialog({ open, onOpenChange }: ChatGPTDialogProps) {
  const { t: tCommon } = useTranslation();
  // Cancelling a pending sign-in is the steps' job; they register it here.
  const cancelRef = useRef<(() => void) | null>(null);
  const change = (next: boolean) => {
    if (!next) cancelRef.current?.();
    onOpenChange(next);
  };
  return (
    <Dialog open={open} onOpenChange={change}>
      <Dialog.Content size="sm" closeLabel={tCommon("actions.close")}>
        {/* Mounted only while open, so each opening starts from the first step. */}
        <ChatGPTSteps cancelRef={cancelRef} close={() => change(false)} />
      </Dialog.Content>
    </Dialog>
  );
}

function ChatGPTSteps({
  cancelRef,
  close,
}: {
  cancelRef: { current: (() => void) | null };
  close: () => void;
}) {
  const { t } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
  const [step, setStep] = useState<Step>({ kind: "intro" });
  const [starting, setStarting] = useState(false);
  const loginId = useRef<string | null>(null);

  // Closing while the browser is still open on ChatGPT stops that sign-in.
  useEffect(() => {
    cancelRef.current = () => {
      if (!loginId.current) return;
      loginId.current = null;
      void cancelChatGPTLogin().catch(() => {});
    };
    return () => {
      cancelRef.current = null;
    };
  }, [cancelRef]);

  const finish = useEffectEvent(async (account: ChatGPTAccount) => {
    await updateProvider("openai", {
      chatgpt: { email: account.email, name: account.name },
      enabled: true,
    });
    if (!account.planUsage) {
      setStep({ kind: "failed", error: t("chatgpt.noPlanUsage") });
      return;
    }
    if (localStorage.getItem(WELCOMED_KEY)) {
      toast.success(t("chatgpt.dialog.signedIn", { account: accountLabel(account) }));
      close();
      return;
    }
    localStorage.setItem(WELCOMED_KEY, "1");
    setStep({ kind: "welcome" });
  });

  // While waiting, ask the server how the sign-in is going.
  useEffect(() => {
    if (step.kind !== "waiting") return;
    let stopped = false;
    const timer = setInterval(async () => {
      const id = loginId.current;
      if (!id) return;
      try {
        const state = await pollChatGPTLogin(id);
        if (stopped) return;
        if (state.status === "done") {
          loginId.current = null;
          await finish(state.account);
        } else if (state.status === "failed") {
          loginId.current = null;
          setStep({ kind: "failed", error: state.error });
        } else if (state.status === "idle") {
          loginId.current = null;
          setStep({ kind: "intro" });
        }
      } catch {
        // The server is busy or restarting; try again on the next tick.
      }
    }, 1500);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [step.kind]);

  async function start(newAccount: boolean) {
    // Opened now, while the click still counts, so a popup blocker lets it
    // through; it is pointed at ChatGPT once the server answers. The desktop
    // app opens links in the default browser instead and returns no window.
    const tab = window.open("", "_blank");
    setStarting(true);
    try {
      const { id, url } = await startChatGPTLogin(newAccount);
      loginId.current = id;
      if (tab) tab.location.href = url;
      else window.open(url, "_blank", "noopener,noreferrer");
      setStep({ kind: "waiting", url });
    } catch (error) {
      tab?.close();
      setStep({ kind: "failed", error: error instanceof Error ? error.message : String(error) });
    } finally {
      setStarting(false);
    }
  }

  return (
    <>
      {step.kind === "welcome" ? (
        <>
          <Dialog.Header title={t("chatgpt.dialog.welcomeTitle")} />
          <Dialog.Body>
            <p className="text-sm text-muted-foreground">{t("chatgpt.dialog.welcome")}</p>
          </Dialog.Body>
          <Dialog.Footer>
            <a
              href={chatGPTUsageUrl}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "secondary" })}
            >
              {t("chatgpt.manageUsage")}
            </a>
            <Button onClick={close}>{t("chatgpt.dialog.gotIt")}</Button>
          </Dialog.Footer>
        </>
      ) : (
        <>
          <Dialog.Header
            title={t("chatgpt.dialog.title")}
            description={t("chatgpt.dialog.description")}
          />
          <Dialog.Body>
            {step.kind === "intro" ? (
              <p className="text-sm text-muted-foreground">{t("chatgpt.dialog.steps")}</p>
            ) : step.kind === "waiting" ? (
              <div className="flex flex-col gap-3 text-sm">
                <p className="flex items-center gap-2 text-muted-foreground">
                  <Icon icon={Loading03Icon} size={16} className="animate-spin" />
                  {t("chatgpt.dialog.waiting")}
                </p>
                <a
                  href={step.url}
                  target="_blank"
                  rel="noreferrer"
                  className="self-start text-foreground underline underline-offset-4"
                >
                  {t("chatgpt.dialog.openAgain")}
                </a>
              </div>
            ) : (
              <div className="flex flex-col gap-3 text-sm">
                <p className="text-destructive">
                  {t("chatgpt.dialog.failed", { error: step.error })}
                </p>
                <button
                  type="button"
                  disabled={starting}
                  onClick={() => void start(true)}
                  className="cursor-pointer self-start text-foreground underline underline-offset-4 disabled:opacity-50"
                >
                  {t("chatgpt.dialog.differentAccount")}
                </button>
              </div>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            <Button variant="secondary" onClick={close}>
              {tCommon("actions.cancel")}
            </Button>
            {step.kind === "waiting" ? null : (
              <Button disabled={starting} onClick={() => void start(false)}>
                {starting ? (
                  <Icon icon={Loading03Icon} size={16} className="animate-spin" />
                ) : (
                  <ProviderIcon provider="openai" size={16} />
                )}
                {step.kind === "failed" ? t("chatgpt.dialog.tryAgain") : t("chatgpt.dialog.open")}
              </Button>
            )}
          </Dialog.Footer>
        </>
      )}
    </>
  );
}
