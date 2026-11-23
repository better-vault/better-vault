import {
  Calendar03Icon,
  CodeIcon,
  FilterHorizontalIcon,
  Copy01Icon,
  Files01Icon,
  MagicWand01Icon,
  Note01Icon,
  Notebook01Icon,
  PlugSocketIcon,
  PuzzleIcon,
  RefreshIcon,
  SquareLock02Icon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";
import type { IconSvgElement } from "@hugeicons/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { Sheet } from "@/components/panelui/sheet";
import { Switch } from "@/components/panelui/switch";
import { Tabs } from "@/components/panelui/tabs";
import { desktopBridge, type McpPermission, type McpState } from "@/lib/desktop/bridge";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const clients = ["claude-code", "cursor", "codex", "claude-desktop"] as const;
type Client = (typeof clients)[number];

const clientNames: Record<Client, string> = {
  "claude-code": "Claude Code",
  cursor: "Cursor",
  codex: "Codex",
  "claude-desktop": "Claude Desktop",
};

/** Where each agent's setup goes, shown above it (file names, not translated). */
const clientPlaces: Record<Client, string> = {
  "claude-code": "Terminal",
  cursor: ".cursor/mcp.json",
  codex: "~/.codex/config.toml",
  "claude-desktop": "claude_desktop_config.json",
};

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

/** Each area agents may change, in the order of the permissions card. */
const areas: { key: McpPermission; icon: IconSvgElement }[] = [
  { key: "allowNotebooks", icon: Notebook01Icon },
  { key: "allowSources", icon: Files01Icon },
  { key: "allowNotes", icon: Note01Icon },
  { key: "allowSkills", icon: MagicWand01Icon },
  { key: "allowCalendar", icon: Calendar03Icon },
  { key: "allowPlugins", icon: PuzzleIcon },
];

/** Whether the desktop app's MCP server is running; false on the web. */
export function useMcpRunning(): boolean {
  const bridge = desktopBridge();
  const [running, setRunning] = useState(false);
  useEffect(() => {
    if (!bridge) return;
    let live = true;
    void bridge.mcp.state().then((state) => live && setRunning(state.running));
    const off = bridge.mcp.onState((state) => setRunning(state.running));
    return () => {
      live = false;
      off();
    };
  }, [bridge]);
  return running;
}

/**
 * Settings → MCP: lets AI agents on this computer use everything in
 * better-vault (notebooks, sources, notes, skills, the calendar, chats,
 * Studio outputs, bots and plugins) through the desktop app's MCP server.
 * Agents can always read; each area's changes have a switch. The web app
 * can't run a server, so there it says so.
 */
export function McpPanel() {
  const { t, i18n } = useTranslation("settings");
  const { t: tCommon } = useTranslation();
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
          <div className="flex flex-col gap-3 rounded-2xl bg-muted/60 p-4 text-sm">
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
      ? t("mcp.status.running", { address: `127.0.0.1:${state.port}` })
      : t("mcp.status.off");

  return (
    <>
      <Sheet.Header title={t("mcp.title")} description={t("mcp.description")} />
      <Sheet.Body>
        <div className="flex flex-col gap-6 pb-4">
          <label className="flex cursor-pointer items-center gap-3 rounded-2xl bg-muted/60 p-3">
            <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl bg-background ring-1 ring-foreground/[0.06]">
              <Icon icon={PlugSocketIcon} size={18} />
              <span
                aria-hidden
                className={cn(
                  "absolute -end-0.5 -bottom-0.5 size-3 rounded-full ring-2 ring-background",
                  state.error
                    ? "bg-destructive"
                    : state.running
                      ? "bg-success"
                      : "bg-muted-foreground/40",
                )}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{t("mcp.enable")}</span>
              <span
                className={cn(
                  "block truncate text-xs",
                  state.error ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {status}
              </span>
            </span>
            <Switch checked={state.enabled} onCheckedChange={(enabled) => update({ enabled })} />
          </label>

          <Section title={t("mcp.permissions")} hint={t("mcp.permissionsHint")}>
            <div className="divide-y overflow-hidden rounded-2xl border">
              <PermissionRow
                icon={SquareLock02Icon}
                label={t("mcp.readOnly")}
                hint={t("mcp.readOnlyHint")}
                checked={state.readOnly}
                onChange={(readOnly) => update({ readOnly })}
              />
              {areas.map(({ key, icon }) => (
                <PermissionRow
                  key={key}
                  icon={icon}
                  label={t(`mcp.areas.${key}.label`)}
                  hint={t(`mcp.areas.${key}.hint`)}
                  checked={!state.readOnly && state[key]}
                  disabled={state.readOnly}
                  onChange={(value) => update({ [key]: value })}
                />
              ))}
            </div>
          </Section>

          <Section title={t("mcp.script.title")} hint={t("mcp.script.hint")}>
            <div className="divide-y overflow-hidden rounded-2xl border">
              <PermissionRow
                icon={CodeIcon}
                label={t("mcp.script.label")}
                badge={tCommon("badges.beta")}
                hint={t("mcp.script.labelHint")}
                checked={state.vaultScript}
                onChange={(vaultScript) => update({ vaultScript })}
              />
              <PermissionRow
                icon={FilterHorizontalIcon}
                label={t("mcp.script.only")}
                hint={t("mcp.script.onlyHint")}
                checked={state.vaultScript && state.vaultScriptOnly}
                disabled={!state.vaultScript}
                onChange={(vaultScriptOnly) => update({ vaultScriptOnly })}
              />
            </div>
          </Section>

          <Section title={t("mcp.connection")}>
            <div className="divide-y overflow-hidden rounded-2xl border text-sm">
              <div className="flex items-center gap-3 px-3 py-2">
                <span className="w-14 shrink-0 text-xs text-muted-foreground">
                  {t("mcp.address")}
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-xs" dir="ltr">
                  {state.url}
                </code>
                <IconButton
                  label={t("mcp.copy")}
                  icon={Copy01Icon}
                  onClick={() => copy(state.url)}
                />
              </div>
              <div className="flex items-center gap-3 px-3 py-2">
                <span className="w-14 shrink-0 text-xs text-muted-foreground">
                  {t("mcp.token")}
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-xs" dir="ltr">
                  {shown ? state.token : "•".repeat(16)}
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
            </div>
          </Section>

          <Section title={t("mcp.setup")}>
            <Tabs value={client} onValueChange={(next) => setClient(next as Client)}>
              <Tabs.List aria-label={t("mcp.setup")} className="w-full">
                {clients.map((each) => (
                  <Tabs.Trigger key={each} value={each} className="flex-1 px-2 text-[0.8125rem]">
                    {clientNames[each]}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              {clients.map((each) => (
                <Tabs.Content key={each} value={each} className="flex flex-col gap-2">
                  <div className="overflow-hidden rounded-2xl border bg-muted/40">
                    <div className="flex items-center gap-2 border-b bg-background/60 py-1 ps-3 pe-1">
                      <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                        {clientPlaces[each]}
                      </span>
                      <IconButton
                        label={t("mcp.copy")}
                        icon={Copy01Icon}
                        onClick={() => copy(config(each, state))}
                      />
                    </div>
                    <pre
                      className="max-h-44 overflow-auto p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap"
                      dir="ltr"
                    >
                      {config(each, state)}
                    </pre>
                  </div>
                  <p className="text-xs text-muted-foreground">{t(`mcp.hints.${each}`)}</p>
                </Tabs.Content>
              ))}
            </Tabs>
          </Section>

          <Section title={t("mcp.activity")}>
            {state.activity.length === 0 ? (
              <p className="rounded-2xl border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                {t("mcp.noActivity")}
              </p>
            ) : (
              <ul className="divide-y overflow-hidden rounded-2xl border">
                {state.activity.slice(0, 8).map((entry, at) => (
                  <li key={at} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <span className="font-medium">{entry.client}</span>
                    <code className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-muted-foreground">
                      {entry.tool}
                    </code>
                    <span className="ms-auto shrink-0 text-muted-foreground">
                      {formatRelativeTime(entry.at, i18n.language)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </Sheet.Body>
    </>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="px-1">
        <h3 className="text-xs font-medium text-muted-foreground">{title}</h3>
        {hint ? <p className="text-xs text-muted-foreground/80">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

function PermissionRow({
  icon,
  label,
  badge,
  hint,
  checked,
  disabled = false,
  onChange,
}: {
  icon: IconSvgElement;
  label: string;
  /** A small tag after the label, such as "Beta". */
  badge?: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 px-3 py-2.5",
        disabled && "cursor-default opacity-60",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon icon={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm font-medium">
          {label}
          {badge ? (
            <span className="rounded-full bg-info/15 px-1.5 py-0.5 text-[0.6875rem] font-medium text-info">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </label>
  );
}

function IconButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: IconSvgElement;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon icon={icon} size={14} />
    </button>
  );
}
