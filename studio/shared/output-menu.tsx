import {
  Delete02Icon,
  Download04Icon,
  Loading03Icon,
  MoreHorizontalIcon,
  PencilEdit01Icon,
  WhiteboardIcon,
} from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Menu } from "@/components/panelui/menu";
import { storages } from "@/lib/storage/catalog";
import type { OutputChrome } from "./form";

/**
 * An immersive viewer's actions: downloads, the tool's own items, annotate,
 * rename and delete. `floating` draws the trigger for use over a canvas.
 */
export function OutputMenu({
  chrome,
  children,
  floating = false,
}: {
  chrome: OutputChrome;
  /** The tool's own items, after the downloads. */
  children?: ReactNode;
  floating?: boolean;
}) {
  const { t } = useTranslation("studio");
  const { t: tCommon } = useTranslation();
  return (
    <Menu>
      <Menu.Trigger
        render={
          <Button
            variant={floating ? "outline" : "ghost"}
            size="icon"
            shape={floating ? "pill" : "default"}
            aria-label={t("viewer.actions")}
            className={
              floating ? "pointer-events-auto bg-background/95 shadow-sm backdrop-blur" : undefined
            }
          />
        }
      >
        <Icon
          icon={chrome.busy ? Loading03Icon : MoreHorizontalIcon}
          size={18}
          className={chrome.busy ? "animate-spin" : undefined}
        />
      </Menu.Trigger>
      <Menu.Content align="end" className="min-w-52">
        {chrome.downloads.length > 0 ? (
          <Menu.Sub>
            <Menu.SubTrigger disabled={chrome.busy}>
              <Icon icon={Download04Icon} />
              {t("whiteboard.actions.download")}
            </Menu.SubTrigger>
            <Menu.SubContent side="inline-start">
              {chrome.downloads.map((download) => (
                <Menu.Item key={download.format} onClick={download.onSelect}>
                  {download.label}
                </Menu.Item>
              ))}
            </Menu.SubContent>
          </Menu.Sub>
        ) : null}
        {chrome.cloud.map((target) =>
          target.formats.length > 0 ? (
            <Menu.Sub key={target.service}>
              <Menu.SubTrigger disabled={chrome.busy}>
                <img src={storages[target.service].logo} alt="" width={16} height={16} />
                {t("viewer.saveToService", { name: target.name })}
              </Menu.SubTrigger>
              <Menu.SubContent side="inline-start">
                {target.formats.map((format) => (
                  <Menu.Item key={format.format} onClick={format.onSelect}>
                    {format.label}
                  </Menu.Item>
                ))}
              </Menu.SubContent>
            </Menu.Sub>
          ) : null,
        )}
        {children}
        {chrome.onAnnotate ? (
          <Menu.Item onClick={chrome.onAnnotate}>
            <Icon icon={WhiteboardIcon} />
            {t("viewer.annotate")}
          </Menu.Item>
        ) : null}
        <Menu.Separator />
        <Menu.Item onClick={chrome.onRename}>
          <Icon icon={PencilEdit01Icon} />
          {tCommon("actions.rename")}
        </Menu.Item>
        <Menu.Item variant="destructive" onClick={chrome.onDelete}>
          <Icon icon={Delete02Icon} />
          {tCommon("actions.delete")}
        </Menu.Item>
      </Menu.Content>
    </Menu>
  );
}
