"use client";

import {
  Delete02Icon,
  Download04Icon,
  EraserIcon,
  FitToScreenIcon,
  GridIcon,
  KeyboardIcon,
  MinusSignIcon,
  MoreHorizontalIcon,
  Loading03Icon,
  PencilEdit01Icon,
  PlusSignIcon,
  Redo02Icon,
  SquareUnlock01Icon,
  Undo02Icon,
} from "@hugeicons/core-free-icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { ButtonGroup } from "@/components/panelui/button-group";
import { Dialog } from "@/components/panelui/dialog";
import { Menu } from "@/components/panelui/menu";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { OutputChrome } from "@/studio/shared/form";
import { clearBoard, fitContent, resetZoom, unlockAll, zoomBy, type Size } from "./actions";
import { BoardButton } from "./board-button";
import { backgrounds, type Background } from "./schema";
import { boardTools, toolMeta } from "./tools-meta";
import type { BoardModel } from "./use-board";

const bar = "pointer-events-auto rounded-2xl border bg-background/95 p-1 shadow-sm backdrop-blur";

/** Zoom and undo, bottom start. */
export function ViewControls({ board, size }: { board: BoardModel; size: () => Size }) {
  const { t } = useTranslation("studio");
  const zoom = Math.round((board.view?.zoom ?? 1) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className={bar}>
        <ButtonGroup aria-label={t("whiteboard.actions.zoom")}>
          <BoardButton
            side="top"
            label={t("whiteboard.actions.zoomOut")}
            onClick={() => zoomBy(board, 1 / 1.25, size())}
          >
            <Icon icon={MinusSignIcon} size={16} />
          </BoardButton>
          <BoardButton
            side="top"
            label={t("whiteboard.actions.resetZoom")}
            className="w-14 text-xs tabular-nums"
            onClick={() => resetZoom(board, size())}
          >
            {zoom} %
          </BoardButton>
          <BoardButton
            side="top"
            label={t("whiteboard.actions.zoomIn")}
            onClick={() => zoomBy(board, 1.25, size())}
          >
            <Icon icon={PlusSignIcon} size={16} />
          </BoardButton>
          <BoardButton
            side="top"
            label={t("whiteboard.actions.fit")}
            onClick={() => fitContent(board, size())}
          >
            <Icon icon={FitToScreenIcon} size={16} />
          </BoardButton>
        </ButtonGroup>
      </div>
      <div className={bar}>
        <ButtonGroup aria-label={t("whiteboard.actions.history")}>
          <BoardButton
            side="top"
            label={t("whiteboard.actions.undo")}
            disabled={!board.canUndo}
            onClick={board.undo}
          >
            <Icon icon={Undo02Icon} size={16} className="rtl:-scale-x-100" />
          </BoardButton>
          <BoardButton
            side="top"
            label={t("whiteboard.actions.redo")}
            disabled={!board.canRedo}
            onClick={board.redo}
          >
            <Icon icon={Redo02Icon} size={16} className="rtl:-scale-x-100" />
          </BoardButton>
        </ButtonGroup>
      </div>
    </div>
  );
}

/** The board menu, bottom end: background, unlock, clear and the shortcuts. */
/**
 * The board's icon, top start: pointing at it (or tapping it) shows the
 * board's name and when it was last edited.
 */
export function BoardInfo({ chrome }: { chrome: OutputChrome }) {
  const [open, setOpen] = useState(false);
  return (
    <HoverCard open={open} onOpenChange={setOpen}>
      <HoverCardTrigger
        delay={150}
        closeDelay={100}
        render={
          <button
            type="button"
            aria-label={`${chrome.title} · ${chrome.meta}`}
            onClick={() => setOpen(true)}
            className="pointer-events-auto flex size-10 cursor-pointer items-center justify-center rounded-2xl border bg-background/95 shadow-sm backdrop-blur transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring data-[popup-open]:bg-muted"
          />
        }
      >
        <Icon icon={chrome.icon} size={18} className={chrome.tint} />
      </HoverCardTrigger>
      <HoverCardContent side="bottom" align="start" sideOffset={8} className="w-72 rounded-2xl p-3">
        <p className="text-sm font-semibold break-words">{chrome.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{chrome.meta}</p>
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * The board menu, bottom end: downloads, background, rename, unlock, the
 * shortcuts, clearing and deleting the board.
 */
export function BoardMenu({ board, chrome }: { board: BoardModel; chrome?: OutputChrome }) {
  const { t } = useTranslation("studio");
  const [shortcuts, setShortcuts] = useState(false);
  const locked = board.elements.some((element) => element.locked);
  return (
    <>
      <Menu>
        <Menu.Trigger
          render={
            <Button
              variant="outline"
              size="icon"
              shape="pill"
              aria-label={t("whiteboard.actions.menu")}
              className="pointer-events-auto bg-background/95 shadow-sm backdrop-blur"
            />
          }
        >
          <Icon
            icon={chrome?.busy ? Loading03Icon : MoreHorizontalIcon}
            size={18}
            className={chrome?.busy ? "animate-spin" : undefined}
          />
        </Menu.Trigger>
        <Menu.Content side="top" align="end" className="min-w-52">
          {chrome && chrome.downloads.length > 0 ? (
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
          <Menu.Sub>
            <Menu.SubTrigger>
              <Icon icon={GridIcon} />
              {t("whiteboard.background")}
            </Menu.SubTrigger>
            <Menu.SubContent side="inline-start">
              <Menu.RadioGroup
                value={board.background}
                onValueChange={(value) => board.setBackground(value as Background)}
              >
                {backgrounds.map((background) => (
                  <Menu.RadioItem key={background} value={background}>
                    {t(`whiteboard.backgrounds.${background}`)}
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.SubContent>
          </Menu.Sub>
          <Menu.Separator />
          {chrome ? (
            <Menu.Item onClick={chrome.onRename}>
              <Icon icon={PencilEdit01Icon} />
              {t("whiteboard.actions.rename")}
            </Menu.Item>
          ) : null}
          <Menu.Item disabled={!locked} onClick={() => unlockAll(board)}>
            <Icon icon={SquareUnlock01Icon} />
            {t("whiteboard.actions.unlockAll")}
          </Menu.Item>
          <Menu.Item onClick={() => setShortcuts(true)}>
            <Icon icon={KeyboardIcon} />
            {t("whiteboard.actions.shortcuts")}
          </Menu.Item>
          <Menu.Separator />
          <Menu.Item disabled={board.elements.length === 0} onClick={() => clearBoard(board)}>
            <Icon icon={EraserIcon} />
            {t("whiteboard.actions.clear")}
          </Menu.Item>
          {chrome ? (
            <Menu.Item variant="destructive" onClick={chrome.onDelete}>
              <Icon icon={Delete02Icon} />
              {t("whiteboard.actions.deleteBoard")}
            </Menu.Item>
          ) : null}
        </Menu.Content>
      </Menu>
      <ShortcutsDialog open={shortcuts} onOpenChange={setShortcuts} />
    </>
  );
}

function Keys({ keys }: { keys: string[] }) {
  return (
    <span className="flex shrink-0 flex-wrap justify-end gap-1">
      {keys.map((key, at) => (
        <kbd
          key={at}
          className="min-w-6 rounded-md border bg-muted px-1.5 py-0.5 text-center font-sans text-[0.6875rem] font-medium text-muted-foreground"
        >
          {key}
        </kbd>
      ))}
    </span>
  );
}

function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation("studio");
  const { t: tCommon } = useTranslation();
  const mac =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const mod = mac ? "⌘" : "Ctrl";
  const alt = mac ? "⌥" : "Alt";
  const k = (key: "drag" | "wheel" | "space" | "arrows" | "pinch") =>
    t(`whiteboard.shortcuts.keys.${key}`);
  const item = (key: string) =>
    t(`whiteboard.shortcuts.items.${key}` as "whiteboard.shortcuts.items.undo");

  const sections: { title: string; rows: [string, string[]][] }[] = [
    {
      title: t("whiteboard.shortcuts.tools"),
      rows: [
        ...boardTools.map((tool): [string, string[]] => [
          t(`whiteboard.tools.${tool}`),
          [toolMeta[tool].key.toUpperCase(), toolMeta[tool].digit ?? ""].filter(Boolean),
        ]),
        [item("toolLock"), ["Q"]],
      ],
    },
    {
      title: t("whiteboard.shortcuts.editing"),
      rows: [
        [item("undo"), [`${mod} Z`]],
        [item("redo"), [`${mod} ⇧ Z`, `${mod} Y`]],
        [item("selectAll"), [`${mod} A`]],
        [item("duplicate"), [`${mod} D`]],
        [item("delete"), ["⌫", "Del"]],
        [item("copy"), [`${mod} C`]],
        [item("paste"), [`${mod} V`]],
        [item("group"), [`${mod} G`]],
        [item("ungroup"), [`${mod} ⇧ G`]],
        [item("lock"), [`${mod} ⇧ L`]],
        [item("forward"), [`${mod} ]`]],
        [item("backward"), [`${mod} [`]],
        [item("front"), [`${mod} ⇧ ]`]],
        [item("back"), [`${mod} ⇧ [`]],
        [item("nudge"), [k("arrows")]],
        [item("editText"), ["Enter"]],
        [item("copyDrag"), [`${alt} ${k("drag")}`]],
        [item("keepShape"), [`⇧ ${k("drag")}`]],
        [item("fromCenter"), [`${alt} ${k("drag")}`]],
        [item("deselect"), ["Esc"]],
      ],
    },
    {
      title: t("whiteboard.shortcuts.view"),
      rows: [
        [item("pan"), [`${k("space")} ${k("drag")}`, k("wheel")]],
        [item("zoom"), [`${mod} ${k("wheel")}`, k("pinch")]],
        [item("zoomIn"), [`${mod} +`]],
        [item("zoomOut"), [`${mod} −`]],
        [item("resetZoom"), [`${mod} 0`]],
        [item("fit"), ["⇧ 1"]],
        [item("fitSelection"), ["⇧ 2"]],
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content size="lg" variant="plain" closeLabel={tCommon("actions.close")}>
        <Dialog.Header
          title={t("whiteboard.shortcuts.title")}
          description={t("whiteboard.shortcuts.description")}
        />
        <Dialog.Body>
          <div className="space-y-5">
            {sections.map((section) => (
              <section key={section.title}>
                <h3 className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  {section.title}
                </h3>
                <ul className="divide-y">
                  {section.rows.map(([label, keys]) => (
                    <li
                      key={label}
                      className="flex items-center justify-between gap-4 py-1.5 text-sm"
                    >
                      <span>{label}</span>
                      <Keys keys={keys} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </Dialog.Body>
      </Dialog.Content>
    </Dialog>
  );
}
