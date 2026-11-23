import {
  ArrowExpand01Icon,
  BulbIcon,
  Copy01Icon,
  CursorRectangleSelection01Icon,
  Delete02Icon,
  Globe02Icon,
  Layers01Icon,
  LayerBringToFrontIcon,
  LayerSendToBackIcon,
  LinkSquare02Icon,
  Quiz01Icon,
  SparklesIcon,
  SquareLock02Icon,
  SquareUnlock02Icon,
  Table02Icon,
  Unlink04Icon,
} from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { MenuActions, type MenuAction } from "@/components/common/action-menu";
import { ContextMenu, ContextMenuTrigger } from "@/components/common/context-menu";
import { Menu } from "@/components/panelui/menu";
import {
  copySelection,
  deleteSelected,
  duplicateSelected,
  fitContent,
  groupSelected,
  reorderSelected,
  selectAll,
  toggleLock,
  ungroupSelected,
  type Size,
} from "./actions";
import type { BoardElement } from "./schema";
import type { BoardModel } from "./use-board";

/**
 * The board's right-click menu. On a selection it asks the AI about it (in
 * your words, or with a ready question) and offers the usual edits; on the
 * empty board it opens Ask AI and selection tools.
 */
export function BoardContextMenu({
  board,
  size,
  onAsk,
  onAskAbout,
  children,
}: {
  board: BoardModel;
  size: () => Size;
  /** Opens the Ask AI field, about the selection when there is one. */
  onAsk: (about: BoardElement[] | null) => void;
  /** Asks a ready question about the selection at once. */
  onAskAbout: (question: string, about: BoardElement[]) => void;
  children: ReactNode;
}) {
  const { t } = useTranslation("studio");
  const selected = board.selectedElements;
  const some = selected.length > 0;
  const grouped = selected.some((element) => element.groupIds.length > 0);
  const locked = some && selected.every((element) => element.locked);
  const preset = (key: "explain" | "table" | "quiz" | "sources") =>
    onAskAbout(t(`whiteboard.ai.presets.${key}.question`), selected);

  const actions: MenuAction[] = some
    ? [
        {
          kind: "item",
          id: "ask",
          label: t("whiteboard.ai.askAbout"),
          icon: SparklesIcon,
          onSelect: () => onAsk(selected),
        },
        {
          kind: "sub",
          id: "quick",
          label: t("whiteboard.ai.quick"),
          icon: BulbIcon,
          items: [
            {
              kind: "item",
              id: "explain",
              label: t("whiteboard.ai.presets.explain.label"),
              icon: BulbIcon,
              onSelect: () => preset("explain"),
            },
            {
              kind: "item",
              id: "table",
              label: t("whiteboard.ai.presets.table.label"),
              icon: Table02Icon,
              onSelect: () => preset("table"),
            },
            {
              kind: "item",
              id: "quiz",
              label: t("whiteboard.ai.presets.quiz.label"),
              icon: Quiz01Icon,
              onSelect: () => preset("quiz"),
            },
            {
              kind: "item",
              id: "sources",
              label: t("whiteboard.ai.presets.sources.label"),
              icon: Globe02Icon,
              onSelect: () => preset("sources"),
            },
          ],
        },
        { kind: "separator", id: "s1" },
        {
          kind: "item",
          id: "copy",
          label: t("whiteboard.actions.copy"),
          icon: Copy01Icon,
          onSelect: () => void copySelection(board),
        },
        {
          kind: "item",
          id: "duplicate",
          label: t("whiteboard.actions.duplicate"),
          icon: Layers01Icon,
          onSelect: () => duplicateSelected(board),
        },
        grouped
          ? {
              kind: "item",
              id: "ungroup",
              label: t("whiteboard.actions.ungroup"),
              icon: Unlink04Icon,
              onSelect: () => ungroupSelected(board),
            }
          : {
              kind: "item",
              id: "group",
              label: t("whiteboard.actions.group"),
              icon: LinkSquare02Icon,
              onSelect: () => groupSelected(board),
            },
        {
          kind: "item",
          id: "front",
          label: t("whiteboard.actions.toFront"),
          icon: LayerBringToFrontIcon,
          onSelect: () => reorderSelected(board, "front"),
        },
        {
          kind: "item",
          id: "back",
          label: t("whiteboard.actions.toBack"),
          icon: LayerSendToBackIcon,
          onSelect: () => reorderSelected(board, "back"),
        },
        {
          kind: "item",
          id: "lock",
          label: locked ? t("whiteboard.actions.unlock") : t("whiteboard.actions.lock"),
          icon: locked ? SquareUnlock02Icon : SquareLock02Icon,
          onSelect: () => toggleLock(board),
        },
        { kind: "separator", id: "s2" },
        {
          kind: "item",
          id: "delete",
          label: t("whiteboard.actions.delete"),
          icon: Delete02Icon,
          destructive: true,
          onSelect: () => deleteSelected(board),
        },
      ]
    : [
        {
          kind: "item",
          id: "ask",
          label: t("whiteboard.ai.menu"),
          icon: SparklesIcon,
          onSelect: () => onAsk(null),
        },
        { kind: "separator", id: "s1" },
        {
          kind: "item",
          id: "all",
          label: t("whiteboard.actions.selectAll"),
          icon: CursorRectangleSelection01Icon,
          onSelect: () => selectAll(board),
        },
        {
          kind: "item",
          id: "fit",
          label: t("whiteboard.actions.fit"),
          icon: ArrowExpand01Icon,
          onSelect: () => fitContent(board, size()),
        },
      ];

  return (
    <ContextMenu>
      <ContextMenuTrigger render={<div className="contents" />}>{children}</ContextMenuTrigger>
      <Menu.Content sideOffset={0} className="min-w-56">
        <MenuActions actions={actions} />
      </Menu.Content>
    </ContextMenu>
  );
}
