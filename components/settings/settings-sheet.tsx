import {
  AiBrain01Icon,
  Calendar03Icon,
  CloudServerIcon,
  Database01Icon,
  InformationCircleIcon,
  LanguageSkillIcon,
  PaintBoardIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { useNavigate } from "react-router";
import { useEffect, useRef, useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Sheet } from "@/components/panelui/sheet";
import { useTheme } from "@/components/providers/theme-provider";
import { providerIds } from "@/lib/ai/catalog";
import { deleteAllData } from "@/lib/db/backup";
import { isProviderReady, useSettings } from "@/lib/db/settings";
import { getLanguage } from "@/lib/i18n/config";
import { useUpdates } from "@/lib/updates/use-updates";
import { appVersion } from "@/lib/version";
import { Avatar } from "@/components/account/avatar";
import { useProfile } from "@/lib/db/profile";
import { AboutPanel } from "./about-panel";
import { AccountPanel } from "./account-panel";
import { StoragePanel } from "./storage-panel";
import { storageIds } from "@/lib/storage/catalog";
import { isStorageReady, useStorageSettings } from "@/lib/storage/settings";
import { AppearancePanel } from "./appearance-panel";
import { CalendarPanel } from "./calendar-panel";
import { CalendarSubscribeDialog } from "./calendar-subscribe-dialog";
import { ChatGPTDialog } from "./chatgpt-dialog";
import { DataPanel } from "./data-panel";
import { LanguagePanel } from "./language-panel";
import { ProvidersPanel } from "./providers-panel";
import { SettingsRow } from "./settings-row";
import { routes } from "@/lib/routes";

interface SettingsSheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The button that opens the sheet, with its own content. Default: a round ghost button with the gear. */
  trigger?: ReactElement;
  /** A page (`appearance`, `providers`, …) to open on top as soon as the sheet opens. */
  page?: SettingsPage | null;
}

export const settingsPages = [
  "account",
  "providers",
  "storage",
  "appearance",
  "calendar",
  "language",
  "data",
  "about",
] as const;
export type SettingsPage = (typeof settingsPages)[number];

/**
 * Opens one of the sheet's pages from code: it presses a hidden trigger for
 * that page, the way a row would be pressed.
 */
function OpenPage({ page }: { page: SettingsPage }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => button.current?.click(), 0);
    return () => clearTimeout(timer);
  }, [page]);
  return (
    <Sheet.Trigger
      to={page}
      render={<button ref={button} type="button" hidden aria-hidden tabIndex={-1} />}
    />
  );
}

/**
 * General settings. Each row opens a sheet of its own on top. A choice that
 * needs a dialog closes the sheets first.
 */
export function SettingsSheet({ open: openProp, onOpenChange, trigger, page }: SettingsSheetProps) {
  const { t, i18n } = useTranslation("settings");
  const navigate = useNavigate();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [chatGPTOpen, setChatGPTOpen] = useState(false);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const { t: tCommon } = useTranslation();
  const { theme, accent } = useTheme();
  const settings = useSettings();
  const updates = useUpdates();
  const profile = useProfile();
  const storage = useStorageSettings();
  const connected = storage ? storageIds.filter((id) => isStorageReady(storage, id)).length : 0;
  const updateVersion =
    updates.state.status === "available" ||
    updates.state.status === "downloading" ||
    updates.state.status === "ready"
      ? updates.state.version
      : null;
  const ready = settings ? providerIds.filter((id) => isProviderReady(settings, id)).length : 0;

  return (
    <>
      <Sheet side="left" open={open} onOpenChange={setOpen}>
        {trigger ? (
          <Sheet.Trigger render={trigger} />
        ) : (
          <Sheet.Trigger
            render={<Button variant="ghost" shape="pill" size="icon" aria-label={t("title")} />}
          >
            <Icon icon={Settings01Icon} />
          </Sheet.Trigger>
        )}
        <Sheet.Content closeLabel={tCommon("actions.close")}>
          <Sheet.Header title={t("title")} description={t("description")} />
          {page ? <OpenPage page={page} /> : null}
          <Sheet.Body>
            <nav className="-mx-2 flex flex-col gap-0.5">
              <SettingsRow
                to="account"
                icon={<Avatar profile={profile} size={36} />}
                label={profile?.name || t("rows.account")}
                hint={profile?.name ? t("rows.accountHint") : t("rows.accountSetUp")}
              />
              <SettingsRow
                to="providers"
                icon={AiBrain01Icon}
                label={t("rows.providers")}
                hint={
                  ready > 0 ? t("rows.providersHint", { count: ready }) : t("rows.providersNone")
                }
              />
              <SettingsRow
                to="storage"
                icon={CloudServerIcon}
                label={t("rows.storage")}
                hint={
                  connected > 0
                    ? t("rows.storageHint", { count: connected })
                    : t("rows.storageNone")
                }
              />
              <SettingsRow
                to="appearance"
                icon={PaintBoardIcon}
                label={t("rows.appearance")}
                hint={`${t(`appearance.${theme}`)} · ${t(`appearance.accents.${accent}`)}`}
              />
              <SettingsRow
                to="calendar"
                icon={Calendar03Icon}
                label={t("rows.calendar")}
                hint={t("rows.calendarHint")}
              />
              <SettingsRow
                to="language"
                icon={LanguageSkillIcon}
                label={t("rows.language")}
                hint={getLanguage(i18n.language).nativeName}
              />
              <SettingsRow to="data" icon={Database01Icon} label={t("rows.data")} />
              <SettingsRow
                to="about"
                icon={InformationCircleIcon}
                label={t("rows.about")}
                hint={
                  updateVersion
                    ? t("updates.availableShort", { version: updateVersion })
                    : t("about.version", { version: appVersion })
                }
                end={
                  updateVersion ? (
                    <span aria-hidden className="size-2 rounded-full bg-info" />
                  ) : undefined
                }
              />
            </nav>
          </Sheet.Body>

          <Sheet.Next name="account" closeLabel={tCommon("actions.close")}>
            <AccountPanel />
          </Sheet.Next>
          <Sheet.Next name="providers" closeLabel={tCommon("actions.close")}>
            <ProvidersPanel
              onChatGPTSignIn={() => {
                setOpen(false);
                setChatGPTOpen(true);
              }}
            />
          </Sheet.Next>
          <Sheet.Next name="storage" closeLabel={tCommon("actions.close")}>
            <StoragePanel />
          </Sheet.Next>
          <Sheet.Next name="appearance" closeLabel={tCommon("actions.close")}>
            <AppearancePanel />
          </Sheet.Next>
          <Sheet.Next name="calendar" closeLabel={tCommon("actions.close")}>
            <CalendarPanel
              onSubscribe={() => {
                setOpen(false);
                setSubscribeOpen(true);
              }}
            />
          </Sheet.Next>
          <Sheet.Next name="language" closeLabel={tCommon("actions.close")}>
            <LanguagePanel />
          </Sheet.Next>
          <Sheet.Next name="data" closeLabel={tCommon("actions.close")}>
            <DataPanel
              onDeleteAll={() => {
                setOpen(false);
                setConfirmDeleteAll(true);
              }}
            />
          </Sheet.Next>
          <Sheet.Next name="about" closeLabel={tCommon("actions.close")}>
            <AboutPanel updates={updates} />
          </Sheet.Next>
        </Sheet.Content>
      </Sheet>
      <ChatGPTDialog open={chatGPTOpen} onOpenChange={setChatGPTOpen} />
      <CalendarSubscribeDialog open={subscribeOpen} onOpenChange={setSubscribeOpen} />
      <ConfirmDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        title={t("data.deleteAllConfirm.title")}
        body={t("data.deleteAllConfirm.body")}
        confirmLabel={t("data.deleteAllConfirm.confirm")}
        onConfirm={async () => {
          await deleteAllData();
          toast.success(t("data.deleted"));
          navigate(routes.home);
        }}
      />
    </>
  );
}
