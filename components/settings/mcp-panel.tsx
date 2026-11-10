import { Copy01Icon, RefreshIcon, ViewIcon, ViewOffIcon } from "@hugeicons/core-free-icons";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Segmented } from "@/components/common/segmented";
import { Icon } from "@/components/icon";
import { Sheet } from "@/components/panelui/sheet";
import { Switch } from "@/components/panelui/switch";
import { desktopBridge, type McpState } from "@/lib/desktop/bridge";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Client = "claude-code" | "cursor" | "codex" | "claude-desktop";

/** The setup each agent needs, with the token filled in. */
function config(client: Client, state: McpState): string {
  const header = `Authorization: Bearer ${state.token}`;
  switch (client) {
    case "claude-code":
      return `claude mcp add --transport http better-vault ${state.url} --header "${header}"`;
    case "cursor":
      return JSON.stringify(
        {
          mcpServers: {
            "better-vault": { url: state.url, headers: { Authorization: `Bearer ${state.token}` } },
          },
        },
        null,
        2,
      );
    case "codex":
      return `[mcp_servers.better-vault]\nurl = "${state.url}"\nhttp_headers = { "Authorization" = "Bearer ${state.token}" }`;
    case "claude-desktop":
      return JSON.stringify(
        {
          mcpServers: {
            "better-vault": {
              command: "npx",
              args: ["-y", "mcp-remote", state.url, "--header", header],
            },
          },
        },
        null,
        2,
      );
  }
}

/**
 * Settings → MCP: lets AI agents on this computer read notebooks and notes
 * and share skills, through the desktop app's MCP server. The web app can't
 * run one, so there it says so.
 */
export function McpPanel() {
  const { t, i18n } = useTranslation("settings");
  const bridge = desktopBridge();
  const [state, setState] = useState<McpState | null>(null);
  const [client, setClient] = useState<Client>("claude-code");
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!bridge) return;
    let live = true;
    void bridge.mcp.state().then((next) => live && setState(next));
    const off = bridge.mcp.onState(setState);
    return () => {
      live = false;
      off();
    };
  }, [bridge]);

  const copy = (value: string) =>
    void navigator.clipboard.writeText(value).then(() => toast.success(t("mcp.copied")));

  if (!bridge) {
    return (
      <>
        <Sheet.Header title={t("mcp.title")} description={t("mcp.description")} />
        <Sheet.Body>
          <div className="flex flex-col gap-3 rounded-2xl bg-muted/50 p-4 text-sm">
            <p className="font-medium">{t("mcp.desktopOnly")}</p>
            <p className="text-muted-foreground">{t("mcp.desktopOnlyBody")}</p>
            <a
              href="https://better-vault.dev/download"
              target="_blank"
              rel="noreferrer noopener"
              className="self-start rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
            >
              {t("mcp.download")}
            </a>
          </div>
        </Sheet.Body>
      </>
    );
  }
  if (!state) return null;

  const update = (patch: Parameters<typeof bridge.mcp.update>[0]) =>
    void bridge.mcp.update(patch).then(setState);
  const status = state.error
    ? t("mcp.status.error", { error: state.error })
    : state.running
      ? t("mcp.status.running", { url: state.url })
      : t("mcp.status.off");

  return (
    <>
      <Sheet.Header title={t("mcp.title")} description={t("mcp.description")} />
      <Sheet.Body>
        <div className="flex flex-col gap-5 pb-4">
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-muted/50 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t("mcp.enable")}</span>
              <span
                className={cn(
                  "block text-xs",
                  state.error ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {status}
              </span>
            </span>
            <Switch checked={state.enabled} onCheckedChange={(enabled) => update({ enabled })} />
          </label>

          <section className="flex flex-col gap-3">
            <h3 className="text-xs font-medium text-muted-foreground">{t("mcp.permissions")}</h3>
            {(
              [
                ["readOnly", t("mcp.readOnly"), t("mcp.readOnlyHint")],
                ["allowNotes", t("mcp.allowNotes"), t("mcp.allowNotesHint")],
                ["allowSkills", t("mcp.allowSkills"), t("mcp.allowSkillsHint")],
              ] as const
            ).map(([key, label, hint]) => (
              <label key={key} className="flex cursor-pointer items-center gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="block text-xs text-muted-foreground">{hint}</span>
                </span>
                <Switch
                  checked={state[key]}
                  disabled={key !== "readOnly" && state.readOnly}
                  onCheckedChange={(value) => update({ [key]: value })}
                />
              </label>
            ))}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">{t("mcp.connection")}</h3>
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs">
              <span className="text-muted-foreground">{t("mcp.address")}</span>
              <code className="min-w-0 flex-1 truncate" dir="ltr">
                {state.url}
              </code>
              <IconButton label={t("mcp.copy")} icon={Copy01Icon} onClick={() => copy(state.url)} />
            </div>
            <div className="flex items-center gap-2 rounded-xl border px-3 py-2 text-xs">
              <span className="text-muted-foreground">{t("mcp.token")}</span>
              <code className="min-w-0 flex-1 truncate" dir="ltr">
                {shown ? state.token : "•".repeat(24)}
              </code>
              <IconButton
                label={shown ? t("mcp.hideToken") : t("mcp.showToken")}
                icon={shown ? ViewOffIcon : ViewIcon}
                onClick={() => setShown((current) => !current)}
              />
              <IconButton
                label={t("mcp.copy")}
                icon={Copy01Icon}
                onClick={() => copy(state.token)}
              />
              <IconButton
                label={t("mcp.regenerate")}
                icon={RefreshIcon}
                onClick={() => void bridge.mcp.regenerateToken().then(setState)}
              />
            </div>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium text-muted-foreground">{t("mcp.setup")}</h3>
            <Segmented<Client>
              size="sm"
              aria-label={t("mcp.setup")}
              value={client}
              onValueChange={setClient}
              className="w-full *:flex-1"
              options={[
                { value: "claude-code", label: "Claude Code" },
                { value: "cursor", label: "Cursor" },
                { value: "codex", label: "Codex" },
                { value: "claude-desktop", label: "Claude Desktop" },
              ]}
            />
            <div className="relative">
              <pre
                className="max-h-48 overflow-auto rounded-xl bg-muted p-3 pe-10 text-xs break-all whitespace-pre-wrap"
                dir="ltr"
              >
                {config(client, state)}
              </pre>
              <span className="absolute end-1.5 top-1.5">
                <IconButton
                  label={t("mcp.copy")}
                  icon={Copy01Icon}
                  onClick={() => copy(config(client, state))}
                />
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t(`mcp.hints.${client}`)}</p>
          </section>

          <section className="flex flex-col gap-1">
            <h3 className="pb-1 text-xs font-medium text-muted-foreground">{t("mcp.activity")}</h3>
            {state.activity.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t("mcp.noActivity")}</p>
            ) : (
              state.activity.slice(0, 12).map((entry, at) => (
                <div key={at} className="flex items-center gap-2 text-xs">
                  <span className="font-medium">{entry.client}</span>
                  <code className="text-muted-foreground">{entry.tool}</code>
                  <span className="ms-auto text-muted-foreground">
                    {formatRelativeTime(entry.at, i18n.language)}
                  </span>
                </div>
              ))
            )}
          </section>
        </div>
      </Sheet.Body>
    </>
  );
}

function IconButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]["icon"];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon icon={icon} size={14} />
    </button>
  );
}
