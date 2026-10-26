"use client";

import {
  AiBrain01Icon,
  Database01Icon,
  InformationCircleIcon,
  LanguageSkillIcon,
  PaintBoardIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";
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
import { appVersion } from "@/lib/version";
import { AboutPanel } from "./about-panel";
import { AppearancePanel } from "./appearance-panel";
import { DataPanel } from "./data-panel";
import { LanguagePanel } from "./language-panel";
import { ProvidersPanel } from "./providers-panel";
import { SettingsRow } from "./settings-row";

interface SettingsSheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The button that opens the sheet, with its own content. Default: a round ghost button with the gear. */
  trigger?: ReactElement;
}

/**
 * General settings. Each row opens a sheet of its own on top. A choice that
 * needs a dialog closes the sheets first.
 */
export function SettingsSheet({ open: openProp, onOpenChange, trigger }: SettingsSheetProps) {
  const { t, i18n } = useTranslation("settings");
  const router = useRouter();
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setOwnOpen(next);
    onOpenChange?.(next);
  };
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const { t: tCommon } = useTranslation();
  const { theme } = useTheme();
  const settings = useSettings();
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
          <Sheet.Body>
            <nav className="-mx-2 flex flex-col gap-0.5">
              <SettingsRow
                to="providers"
                icon={AiBrain01Icon}
                label={t("rows.providers")}
                hint={
                  ready > 0 ? t("rows.providersHint", { count: ready }) : t("rows.providersNone")
                }
              />
              <SettingsRow
                to="appearance"
                icon={PaintBoardIcon}
                label={t("rows.appearance")}
                hint={t(`appearance.${theme}`)}
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
                hint={t("about.version", { version: appVersion })}
              />
            </nav>
          </Sheet.Body>

          <Sheet.Next name="providers" closeLabel={tCommon("actions.close")}>
            <ProvidersPanel />
          </Sheet.Next>
          <Sheet.Next name="appearance" closeLabel={tCommon("actions.close")}>
            <AppearancePanel />
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
            <AboutPanel />
          </Sheet.Next>
        </Sheet.Content>
      </Sheet>
      <ConfirmDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        title={t("data.deleteAllConfirm.title")}
        body={t("data.deleteAllConfirm.body")}
        confirmLabel={t("data.deleteAllConfirm.confirm")}
        onConfirm={async () => {
          await deleteAllData();
          toast.success(t("data.deleted"));
          router.push("/");
        }}
      />
    </>
  );
}
