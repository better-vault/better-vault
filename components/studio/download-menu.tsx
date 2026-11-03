import { ArrowDown01Icon, Download04Icon, Loading03Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { buttonVariants } from "@/components/panelui/button";
import { Menu } from "@/components/panelui/menu";
import { StorageLogo } from "@/components/settings/storage-panel";
import { storageIds, storages } from "@/lib/storage/catalog";
import { isStorageReady, useStorageSettings } from "@/lib/storage/settings";
import { isFileExport, type ExportOption } from "@/studio/types";
import { useExporter } from "./use-exporter";

/** "Download" with the formats an output can be saved as. */
export function DownloadMenu<Data>({
  title,
  data,
  options,
}: {
  title: string;
  data: Data;
  options: readonly ExportOption<Data>[];
}) {
  const { t } = useTranslation("studio");
  const { busy, save, saveTo } = useExporter();
  const storage = useStorageSettings();
  const connected = storage ? storageIds.filter((id) => isStorageReady(storage, id)) : [];
  const files = options.filter(isFileExport);
  return (
    <Menu>
      <Menu.Trigger
        disabled={busy}
        className={buttonVariants({ variant: "outline", shape: "pill", size: "sm" })}
      >
        <Icon
          icon={busy ? Loading03Icon : Download04Icon}
          size={16}
          className={busy ? "animate-spin" : undefined}
        />
        {t("viewer.download")}
        <Icon icon={ArrowDown01Icon} size={14} className="text-muted-foreground" />
      </Menu.Trigger>
      <Menu.Content align="end">
        <Menu.Group>
          <Menu.GroupLabel>{t("viewer.downloadAs")}</Menu.GroupLabel>
          {options.map((option) => (
            <Menu.Item key={option.format} onClick={() => void save(title, data, option)}>
              {t(`viewer.formats.${option.format}`)}
            </Menu.Item>
          ))}
        </Menu.Group>
        {connected.length > 0 && files.length > 0 ? (
          <>
            <Menu.Separator />
            <Menu.Group>
              <Menu.GroupLabel>{t("viewer.saveTo")}</Menu.GroupLabel>
              {connected.map((service) => (
                <Menu.Sub key={service}>
                  <Menu.SubTrigger>
                    <StorageLogo id={service} size={16} />
                    {storages[service].name}
                  </Menu.SubTrigger>
                  <Menu.SubContent side="inline-start">
                    {files.map((option) => (
                      <Menu.Item
                        key={option.format}
                        onClick={() => void saveTo(service, title, data, option)}
                      >
                        {t(`viewer.formats.${option.format}`)}
                      </Menu.Item>
                    ))}
                  </Menu.SubContent>
                </Menu.Sub>
              ))}
            </Menu.Group>
          </>
        ) : null}
      </Menu.Content>
    </Menu>
  );
}
