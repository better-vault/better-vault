"use client";

import {
  Copy01Icon,
  Delete02Icon,
  GroupItemsIcon,
  LayerBringForwardIcon,
  LayerBringToFrontIcon,
  LayerSendBackwardIcon,
  LayerSendToBackIcon,
  LockIcon,
  SquareUnlock01Icon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  UngroupItemsIcon,
} from "@hugeicons/core-free-icons";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "@/components/icon";
import { ButtonGroup } from "@/components/panelui/button-group";
import { Card } from "@/components/panelui/card";
import { Select } from "@/components/panelui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  applyStyle,
  deleteSelected,
  duplicateSelected,
  groupSelected,
  reorderSelected,
  toggleLock,
  ungroupSelected,
} from "./actions";
import { BoardButton } from "./board-button";
import { fillCss, swatchClass } from "./palette";
import type { LayerMove } from "./scene";
import {
  arrowheads,
  boardColors,
  edgeKinds,
  fillStyles,
  fontKinds,
  fontSizes,
  roughnesses,
  strokeStyles,
  strokeWidths,
  textAligns,
  type Arrowhead,
  type BoardColor,
  type BoardElement,
  type DrawStyle,
  type ElementType,
} from "./schema";
import { fontFamily } from "./text";
import { drawingTools } from "./tools-meta";
import type { BoardModel } from "./use-board";

/** The style an element is drawn in, over the style for new elements. */
function styleOf(element: BoardElement, fallback: DrawStyle): DrawStyle {
  return {
    ...fallback,
    stroke: element.stroke,
    fill: element.fill,
    fillStyle: element.fillStyle,
    strokeWidth: element.strokeWidth,
    strokeStyle: element.strokeStyle,
    roughness: element.roughness,
    edges: element.edges,
    opacity: element.opacity,
    ...(element.type === "text"
      ? { font: element.font, fontSize: element.fontSize, align: element.align }
      : {}),
    ...(element.type === "line" || element.type === "arrow"
      ? { start: element.start, end: element.end }
      : {}),
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

/** A Panel button track where one choice is pressed. */
function Choice<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; content: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <Field label={label}>
      <ButtonGroup aria-label={label} className="w-full *:flex-1">
        {options.map((option) => (
          <BoardButton
            key={String(option.value)}
            label={option.label}
            side="right"
            pressed={value === option.value}
            onClick={() => onChange(option.value)}
          >
            {option.content}
          </BoardButton>
        ))}
      </ButtonGroup>
    </Field>
  );
}

const swatch =
  "relative flex size-6 cursor-pointer items-center justify-center rounded-full ring-1 ring-foreground/15 outline-none ring-inset focus-visible:ring-2 focus-visible:ring-ring aria-checked:outline-2 aria-checked:outline-offset-2 aria-checked:outline-info";

function Swatches({
  label,
  value,
  fill,
  onChange,
}: {
  label: string;
  value: BoardColor | "none";
  /** Background swatches: pale tints, and "none". */
  fill?: boolean;
  onChange: (value: BoardColor | "none") => void;
}) {
  const { t } = useTranslation("studio");
  return (
    <Field label={label}>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
        {fill ? (
          <button
            type="button"
            role="radio"
            aria-checked={value === "none"}
            aria-label={t("whiteboard.properties.none")}
            title={t("whiteboard.properties.none")}
            className={cn(swatch, "overflow-hidden bg-background")}
            onClick={() => onChange("none")}
          >
            <span className="absolute h-px w-7 -rotate-45 bg-destructive" />
          </button>
        ) : null}
        {boardColors.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={value === color}
            aria-label={t(`whiteboard.colors.${color}`)}
            title={t(`whiteboard.colors.${color}`)}
            className={cn(swatch, fill ? undefined : swatchClass[color])}
            style={fill ? { background: fillCss(color) } : undefined}
            onClick={() => onChange(color)}
          />
        ))}
      </div>
    </Field>
  );
}

// Small drawings of each choice, in the button's text colour.
const glyph = "size-4 overflow-visible";
const fillGlyph: Record<(typeof fillStyles)[number], ReactNode> = {
  hachure: (
    <svg viewBox="0 0 16 16" className={glyph} fill="none" stroke="currentColor" strokeWidth={1.2}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
      <path d="M2 10 10 2M2 14 14 2M6 14 14 6" />
    </svg>
  ),
  "cross-hatch": (
    <svg viewBox="0 0 16 16" className={glyph} fill="none" stroke="currentColor" strokeWidth={1.2}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" />
      <path d="M2 10 10 2M2 14 14 2M6 14 14 6M6 2l8 8M2 2l12 12M2 6l8 8" />
    </svg>
  ),
  solid: (
    <svg viewBox="0 0 16 16" className={glyph}>
      <rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="currentColor" />
    </svg>
  ),
};
const dashGlyph: Record<(typeof strokeStyles)[number], string | undefined> = {
  solid: undefined,
  dashed: "4 3",
  dotted: "0.5 3",
};
const roughGlyph = ["M1 8h14", "M1 9c3-2 5 1 7-1s4-1 7-1", "M1 10c2-5 3 3 5-2s3 4 5-1 2 1 4-2"];

export function PropertiesPanel({ board }: { board: BoardModel }) {
  const { t } = useTranslation("studio");
  const selected = board.selectedElements;
  const targets = selected.filter((element) => !element.locked);
  const types = new Set<ElementType>(
    selected.length > 0
      ? targets.map((element) => element.type)
      : drawingTools.has(board.tool)
        ? [board.tool as ElementType]
        : [],
  );
  if (selected.length === 0 && types.size === 0) return null;

  const value = targets[0] ? styleOf(targets[0], board.style) : board.style;
  const set = (patch: Partial<DrawStyle>, key?: string) => applyStyle(board, patch, key);
  const shapes = types.has("rectangle") || types.has("diamond") || types.has("ellipse");
  const linear = types.has("line") || types.has("arrow");
  const pen = types.has("freedraw");
  const text = types.has("text");
  const outlined = shapes || linear;
  const ids = new Set(targets.map((element) => element.id));
  const grouped = targets.some((element) => element.groupIds.length > 0);
  const allLocked = selected.length > 0 && targets.length === 0;
  const p = (key: string) => t(`whiteboard.properties.${key}` as "whiteboard.properties.title");

  const arrowheadItems = (["none", ...arrowheads] as const).map((kind) => ({
    value: kind,
    label: t(`whiteboard.properties.arrowheadKinds.${kind}`),
  }));
  const arrowheadSelect = (side: "start" | "end") => (
    <div className="min-w-0 flex-1 space-y-1">
      <p className="text-[0.6875rem] text-muted-foreground">{p(side)}</p>
      <Select
        items={arrowheadItems}
        value={value[side] ?? "none"}
        onValueChange={(next) => set({ [side]: next === "none" ? null : (next as Arrowhead) })}
      >
        <Select.Trigger size="sm" aria-label={`${p("arrowheads")}: ${p(side)}`}>
          <Select.Value />
        </Select.Trigger>
        <Select.Content>
          {arrowheadItems.map((item) => (
            <Select.Item key={item.value} value={item.value}>
              {item.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select>
    </div>
  );

  return (
    <Card
      size="sm"
      aria-label={p("title")}
      className="pointer-events-auto flex max-h-full min-h-0 w-60 flex-col bg-background/95 shadow-sm backdrop-blur"
    >
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-3">
          {!allLocked && (outlined || pen || text) ? (
            <Swatches
              label={p("stroke")}
              value={value.stroke}
              onChange={(stroke) => stroke !== "none" && set({ stroke })}
            />
          ) : null}
          {shapes ? (
            <Swatches
              fill
              label={p("background")}
              value={value.fill}
              onChange={(fill) => set({ fill })}
            />
          ) : null}
          {shapes && value.fill !== "none" ? (
            <Choice
              label={p("fillStyle")}
              value={value.fillStyle}
              onChange={(fillStyle) => set({ fillStyle })}
              options={fillStyles.map((style) => ({
                value: style,
                label: t(`whiteboard.properties.fillStyles.${style}`),
                content: fillGlyph[style],
              }))}
            />
          ) : null}
          {outlined || pen ? (
            <Choice
              label={p("strokeWidth")}
              value={value.strokeWidth}
              onChange={(strokeWidth) => set({ strokeWidth })}
              options={strokeWidths.map((width) => ({
                value: width,
                label: t(`whiteboard.properties.strokeWidths.${width}`),
                content: (
                  <span className="w-4 rounded-full bg-current" style={{ height: width + 0.5 }} />
                ),
              }))}
            />
          ) : null}
          {outlined ? (
            <Choice
              label={p("strokeStyle")}
              value={value.strokeStyle}
              onChange={(strokeStyle) => set({ strokeStyle })}
              options={strokeStyles.map((style) => ({
                value: style,
                label: t(`whiteboard.properties.strokeStyles.${style}`),
                content: (
                  <svg viewBox="0 0 16 16" className={glyph}>
                    <path
                      d="M1 8h14"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeDasharray={dashGlyph[style]}
                    />
                  </svg>
                ),
              }))}
            />
          ) : null}
          {outlined ? (
            <Choice
              label={p("sloppiness")}
              value={value.roughness}
              onChange={(roughness) => set({ roughness })}
              options={roughnesses.map((level) => ({
                value: level,
                label: t(`whiteboard.properties.roughness.${level}`),
                content: (
                  <svg viewBox="0 0 16 16" className={glyph} fill="none">
                    <path
                      d={roughGlyph[level]}
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                  </svg>
                ),
              }))}
            />
          ) : null}
          {types.has("rectangle") || types.has("diamond") || linear ? (
            <Choice
              label={p("edges")}
              value={value.edges}
              onChange={(edges) => set({ edges })}
              options={edgeKinds.map((kind) => ({
                value: kind,
                label: t(`whiteboard.properties.edgeKinds.${kind}`),
                content: (
                  <svg viewBox="0 0 16 16" className={glyph} fill="none">
                    <path
                      d={kind === "sharp" ? "M2 14V2h12" : "M2 14V8a6 6 0 0 1 6-6h6"}
                      stroke="currentColor"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                    />
                  </svg>
                ),
              }))}
            />
          ) : null}
          {linear ? (
            <Field label={p("arrowheads")}>
              <div className="flex gap-2">
                {arrowheadSelect("start")}
                {arrowheadSelect("end")}
              </div>
            </Field>
          ) : null}
          {text ? (
            <>
              <Choice
                label={p("font")}
                value={value.font}
                onChange={(font) => set({ font })}
                options={fontKinds.map((font) => ({
                  value: font,
                  label: t(`whiteboard.properties.fonts.${font}`),
                  content: (
                    <span
                      className="text-[0.9375rem] leading-none"
                      style={{ fontFamily: fontFamily[font] }}
                    >
                      Aa
                    </span>
                  ),
                }))}
              />
              <Choice
                label={p("fontSize")}
                value={value.fontSize}
                onChange={(fontSize) => set({ fontSize })}
                options={fontSizes.map((size, at) => ({
                  value: size,
                  label: t(`whiteboard.properties.fontSizes.${size}`),
                  content: (
                    <span className="text-xs font-semibold">{["S", "M", "L", "XL"][at]}</span>
                  ),
                }))}
              />
              <Choice
                label={p("align")}
                value={value.align}
                onChange={(align) => set({ align })}
                options={textAligns.map((align) => ({
                  value: align,
                  label: t(`whiteboard.properties.aligns.${align}`),
                  content: (
                    <Icon
                      icon={
                        align === "start"
                          ? TextAlignLeftIcon
                          : align === "center"
                            ? TextAlignCenterIcon
                            : TextAlignRightIcon
                      }
                      size={16}
                      className="rtl:-scale-x-100"
                    />
                  ),
                }))}
              />
            </>
          ) : null}
          {!allLocked ? (
            <Field label={`${p("opacity")} · ${value.opacity} %`}>
              <Slider
                aria-label={p("opacity")}
                min={0}
                max={100}
                step={5}
                value={[value.opacity]}
                onValueChange={(next) => {
                  const opacity = Array.isArray(next) ? next[0] : next;
                  if (typeof opacity === "number") set({ opacity }, "opacity");
                }}
                className="py-1.5"
              />
            </Field>
          ) : null}
          {selected.length > 0 ? (
            <>
              {!allLocked ? (
                <Field label={p("layers")}>
                  <ButtonGroup aria-label={p("layers")} className="w-full *:flex-1">
                    {(
                      [
                        ["back", LayerSendToBackIcon],
                        ["backward", LayerSendBackwardIcon],
                        ["forward", LayerBringForwardIcon],
                        ["front", LayerBringToFrontIcon],
                      ] as const
                    ).map(([move, icon]) => (
                      <BoardButton
                        key={move}
                        side="right"
                        label={t(`whiteboard.properties.layerMoves.${move}`)}
                        onClick={() => reorderSelected(board, move as LayerMove)}
                      >
                        <Icon icon={icon} size={16} />
                      </BoardButton>
                    ))}
                  </ButtonGroup>
                </Field>
              ) : null}
              <Field label={p("actions")}>
                <ButtonGroup aria-label={p("actions")} className="w-full *:flex-1">
                  {!allLocked ? (
                    <BoardButton
                      side="right"
                      label={t("whiteboard.actions.duplicate")}
                      onClick={() => duplicateSelected(board)}
                    >
                      <Icon icon={Copy01Icon} size={16} />
                    </BoardButton>
                  ) : null}
                  {ids.size > 1 ? (
                    <BoardButton
                      side="right"
                      label={t("whiteboard.actions.group")}
                      onClick={() => groupSelected(board)}
                    >
                      <Icon icon={GroupItemsIcon} size={16} />
                    </BoardButton>
                  ) : null}
                  {grouped ? (
                    <BoardButton
                      side="right"
                      label={t("whiteboard.actions.ungroup")}
                      onClick={() => ungroupSelected(board)}
                    >
                      <Icon icon={UngroupItemsIcon} size={16} />
                    </BoardButton>
                  ) : null}
                  <BoardButton
                    side="right"
                    label={
                      allLocked ? t("whiteboard.actions.unlock") : t("whiteboard.actions.lock")
                    }
                    onClick={() => toggleLock(board)}
                  >
                    <Icon icon={allLocked ? SquareUnlock01Icon : LockIcon} size={16} />
                  </BoardButton>
                  {!allLocked ? (
                    <BoardButton
                      side="right"
                      label={t("whiteboard.actions.delete")}
                      className="hover:text-destructive!"
                      onClick={() => deleteSelected(board)}
                    >
                      <Icon icon={Delete02Icon} size={16} />
                    </BoardButton>
                  ) : null}
                </ButtonGroup>
              </Field>
            </>
          ) : null}
        </div>
      </ScrollArea>
    </Card>
  );
}
