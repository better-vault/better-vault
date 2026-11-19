import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { Plugin } from "@/lib/db/types";
import { handleBridgeCall, pluginPage, type PluginContext } from "@/lib/plugins/bridge";
import { themeTokens } from "@/lib/plugins/manifest";
import { cn } from "@/lib/utils";

/** The app's colour tokens as the page has them now, for the panel's :root. */
function currentTokens(): Record<string, string> {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(
    themeTokens.map((token) => [token, style.getPropertyValue(`--${token}`).trim()]),
  );
}

const currentTheme = (): "light" | "dark" =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

/**
 * One plugin panel, in a sandboxed frame of the plugin host page
 * (public/plugin-host.html). The frame has an opaque origin (no
 * `allow-same-origin`), so it can't touch the app's storage, and the host's
 * policy lets it load nothing and reach no server. It gets its page in one
 * message and talks to the app only through `betterVault.call`, which
 * `handleBridgeCall` checks against what the user granted. If the panel
 * navigates away from the host, the frame is dropped.
 */
export function PluginFrame({
  plugin,
  panelId,
  notebook,
  className,
}: {
  plugin: Plugin;
  panelId: string;
  notebook: { id: string; title: string } | null;
  className?: string;
}) {
  const { t, i18n } = useTranslation("settings");
  const frame = useRef<HTMLIFrameElement>(null);
  const [broken, setBroken] = useState(false);
  const panel = plugin.manifest.contributes.panels.find((each) => each.id === panelId);
  // The latest plugin and context, for the message handler without re-binding it.
  const live = useRef({ plugin, context: null as PluginContext | null });
  useEffect(() => {
    live.current.plugin = plugin;
  }, [plugin]);

  useEffect(() => {
    const target = frame.current;
    if (!target || !panel) return;
    let loaded = false;
    const html = pluginPage(plugin, panel.entry);
    const context = (): PluginContext => ({
      notebook,
      theme: currentTheme(),
      tokens: currentTokens(),
      language: i18n.language,
    });
    const post = (message: unknown) => target.contentWindow?.postMessage(message, "*");
    const sendContext = () => {
      live.current.context = context();
      post({ type: "bv:context", context: live.current.context });
    };

    const onMessage = async (event: MessageEvent) => {
      if (event.source !== target.contentWindow) return;
      const data = event.data as {
        type?: string;
        id?: number;
        method?: string;
        params?: unknown;
        message?: string;
      };
      if (data?.type === "bv:host-ready" && !loaded) {
        loaded = true;
        post({ type: "bv:load", html });
        sendContext();
        return;
      }
      if (!loaded) return;
      if (data?.type === "bv:toast" && typeof data.message === "string") {
        toast(`${live.current.plugin.manifest.name}: ${data.message.slice(0, 200)}`);
        return;
      }
      if (
        data?.type === "bv:call" &&
        typeof data.id === "number" &&
        typeof data.method === "string"
      ) {
        try {
          const result = await handleBridgeCall(
            live.current.plugin,
            data.method,
            data.params,
            live.current.context ?? context(),
          );
          post({ type: "bv:result", id: data.id, result });
        } catch (error) {
          post({
            type: "bv:result",
            id: data.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };

    // The host page loads once, and once more when it becomes the plugin's
    // page; any load after that means the panel navigated away from it.
    let loads = 0;
    const onLoad = () => {
      loads += 1;
      if (loads > (loaded ? 2 : 1)) setBroken(true);
    };

    // Follow the app's theme.
    const observer = new MutationObserver(() => loaded && sendContext());
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    window.addEventListener("message", onMessage);
    target.addEventListener("load", onLoad);
    return () => {
      window.removeEventListener("message", onMessage);
      target.removeEventListener("load", onLoad);
      observer.disconnect();
    };
    // The frame starts over when the plugin, panel or notebook changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugin.id, plugin.updatedAt, panelId, notebook?.id]);

  if (!panel) return null;
  if (broken)
    return (
      <div className="grid h-full place-items-center p-6 text-center text-sm text-muted-foreground">
        {t("plugins.leftPage", { name: plugin.manifest.name })}
      </div>
    );
  return (
    <iframe
      key={`${plugin.id}:${plugin.updatedAt}:${panelId}:${notebook?.id ?? ""}`}
      ref={frame}
      src="/plugin-host.html"
      title={`${plugin.manifest.name}: ${panel.title}`}
      // Scripts only: no same origin (storage, cookies), no popups, forms or top navigation.
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className={cn("block size-full border-0 bg-background", className)}
    />
  );
}
