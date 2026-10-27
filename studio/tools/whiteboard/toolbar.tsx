"use client";

import { LockIcon, SquareUnlock01Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { ButtonGroup } from "@/components/panelui/button-group";
import { BoardButton } from "./board-button";
import { toolMeta, type BoardTool } from "./tools-meta";
import type { BoardModel } from "./use-board";

const groups: { id: "navigate" | "shapes" | "draw"; tools: BoardTool[] }[] = [
  { id: "navigate", tools: ["hand", "selection"] },
  { id: "shapes", tools: ["rectangle", "diamond", "ellipse", "arrow", "line"] },
  { id: "draw", tools: ["freedraw", "text", "image", "eraser"] },
];

/** The tools, in Panel button tracks: the tool lock, then moving, shapes, and drawing. */
export function Toolbar({
  board,
  onChoose,
}: {
  board: BoardModel;
  onChoose: (tool: BoardTool) => void;
}) {
  const { t } = useTranslation("studio");
  const keys = (tool: BoardTool) =>
    [toolMeta[tool].key.toUpperCase(), toolMeta[tool].digit]
      .filter(Boolean)
      .join(` ${t("whiteboard.or")} `);

  return (
    <ButtonGroup
      aria-label={t("whiteboard.toolbar")}
      className="pointer-events-auto max-w-full [scrollbar-width:none] overflow-x-auto rounded-2xl border bg-background/95 p-1.5 shadow-sm backdrop-blur"
    >
      <ButtonGroup aria-label={t("whiteboard.toolLock")}>
        <BoardButton
          label={t("whiteboard.toolLock")}
          hint={t("whiteboard.keyHint", { tool: t("whiteboard.toolLock"), keys: "Q" })}
          pressed={board.toolLocked}
          onClick={() => board.setToolLocked((locked) => !locked)}
        >
          <Icon icon={board.toolLocked ? LockIcon : SquareUnlock01Icon} size={17} />
        </BoardButton>
      </ButtonGroup>
      {groups.map((group) => (
        <ButtonGroup key={group.id} aria-label={t(`whiteboard.groups.${group.id}`)}>
          {group.tools.map((tool) => (
            <BoardButton
              key={tool}
              label={t(`whiteboard.tools.${tool}`)}
              hint={t("whiteboard.keyHint", {
                tool: t(`whiteboard.tools.${tool}`),
                keys: keys(tool),
              })}
              pressed={board.tool === tool}
              onClick={() => onChoose(tool)}
            >
              <Icon icon={toolMeta[tool].icon} size={17} />
              {toolMeta[tool].digit ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute end-0.5 bottom-0 text-[0.5625rem] leading-none text-muted-foreground/70 tabular-nums"
                >
                  {toolMeta[tool].digit}
                </span>
              ) : null}
            </BoardButton>
          ))}
        </ButtonGroup>
      ))}
    </ButtonGroup>
  );
}
