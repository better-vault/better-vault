"use client";

import {
  ArrowExpand01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowShrink01Icon,
  PauseIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Markdown } from "@/components/chat/markdown";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Tabs } from "@/components/panelui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ToolViewerProps } from "@/studio/shared/form";
import "./anatomy.css";
import type { AnatomyData } from "./definition";
import { AnatomyStage } from "./stage";

/** Seconds each step shows while the tour plays. */
const TOUR = 6;

type PanelTab = "steps" | "parts";

/**
 * An Anatomy figure on one screen: the figure on the left, and beside it how
 * it works and its parts. Point at a part to see its name; choose it to read
 * what it does.
 */
export function AnatomyViewer({ data, onOpenPassage }: ToolViewerProps<AnatomyData>) {
  const { t } = useTranslation("studio");
  const { scene, passages } = data;
  const steps = scene.steps;
  const [step, setStep] = useState(0);
  const [exploded, setExploded] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<PanelTab>("steps");
  // The tour plays on its own until someone takes over, unless motion is reduced.
  const [playing, setPlaying] = useState(
    () =>
      steps.length > 1 &&
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const rows = useRef(new Map<string, HTMLElement>());

  const assemblies = useMemo(
    () =>
      scene.assemblies
        .map((assembly) => ({
          ...assembly,
          parts: scene.parts.filter((part) => part.assembly === assembly.id),
        }))
        .filter((assembly) => assembly.parts.length > 0),
    [scene],
  );
  const active = hovered ?? selected;
  const current = steps[step];
  const lit = useMemo(() => {
    const focus = current?.focus.length
      ? current.focus
      : scene.parts.filter((part) => part.role === "subject").map((part) => part.id);
    return new Set(focus);
  }, [current, scene]);

  useEffect(() => {
    if (!playing || hovered || selected || steps.length < 2) return;
    const timer = window.setTimeout(
      () => setStep((index) => (index + 1) % steps.length),
      TOUR * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [playing, hovered, selected, step, steps.length]);

  // A part chosen in the figure opens in the parts list.
  useEffect(() => {
    if (selected)
      rows.current.get(selected)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected, tab]);

  const goTo = useCallback(
    (index: number) => {
      setPlaying(false);
      setStep(Math.max(0, Math.min(steps.length - 1, index)));
    },
    [steps.length],
  );
  const toggleApart = useCallback(() => {
    setPlaying(false);
    setExploded((value) => !value);
  }, []);
  const choose = useCallback((id: string | null) => {
    setPlaying(false);
    setSelected((value) => (id === null || value === id ? null : id));
    if (id) setTab("parts");
  }, []);

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight") goTo(step + 1);
    else if (event.key === "ArrowLeft") goTo(step - 1);
    else if (event.key === "e" || event.key === "E") toggleApart();
    else if (event.key === "Escape") setSelected(null);
    else return;
    event.preventDefault();
  };

  return (
    <div className="anatomy flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
      {/* The figure */}
      <section className="relative flex h-[min(72vh,34rem)] min-w-0 flex-col rounded-3xl border bg-card lg:h-auto lg:min-h-[26rem] lg:flex-1">
        <div className="pointer-events-none flex justify-between gap-4 px-5 pt-4 font-mono text-[0.6875rem] tracking-wide text-muted-foreground">
          <span className="text-foreground/70">{t("anatomy.viewer.figure")}</span>
          <span className="truncate tracking-[0.1em] uppercase">{scene.title}</span>
        </div>
        <div
          tabIndex={0}
          onKeyDown={onKeyDown}
          aria-label={t("anatomy.viewer.stageLabel", { title: scene.title })}
          className="relative mx-3 min-h-0 flex-1 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <AnatomyStage
            scene={scene}
            step={step}
            exploded={exploded}
            lit={lit}
            active={active}
            label={scene.object || scene.title}
            onHover={setHovered}
            onSelect={choose}
          />
        </div>
        <div className="pointer-events-none flex items-end justify-between gap-4 px-5 pb-2 font-mono text-[0.6875rem] tracking-wide text-muted-foreground">
          <span className="hidden truncate tracking-[0.1em] uppercase sm:inline">
            {t("anatomy.viewer.hint")}
          </span>
          <span aria-live="polite" className="ms-auto truncate text-foreground/70 tabular-nums">
            {current?.readout}
          </span>
        </div>
        <div className="flex items-center gap-2 border-t px-3 py-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("anatomy.viewer.previous")}
            disabled={step === 0}
            onClick={() => goTo(step - 1)}
          >
            <Icon icon={ArrowLeft01Icon} size={16} className="rtl:rotate-180" />
          </Button>
          <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
            {t("anatomy.viewer.stepShort", { current: step + 1, total: steps.length })}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={t("anatomy.viewer.next")}
            disabled={step >= steps.length - 1}
            onClick={() => goTo(step + 1)}
          >
            <Icon icon={ArrowRight01Icon} size={16} className="rtl:rotate-180" />
          </Button>
          <span className="min-w-0 flex-1 truncate text-sm font-medium">{current?.title}</span>
          {steps.length > 1 ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={playing ? t("anatomy.viewer.pause") : t("anatomy.viewer.play")}
              onClick={() => setPlaying((value) => !value)}
            >
              <Icon icon={playing ? PauseIcon : PlayIcon} size={16} />
            </Button>
          ) : null}
          <Button
            variant="outline"
            shape="pill"
            size="sm"
            aria-pressed={exploded}
            onClick={toggleApart}
          >
            <Icon icon={exploded ? ArrowShrink01Icon : ArrowExpand01Icon} size={16} />
            {exploded ? t("anatomy.viewer.assemble") : t("anatomy.viewer.explode")}
          </Button>
        </div>
      </section>

      {/* How it works, and the parts */}
      <aside className="relative h-[32rem] shrink-0 rounded-3xl border bg-card lg:h-auto lg:w-[22rem]">
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as PanelTab)}
          className="absolute inset-0 gap-0 p-2"
        >
          <Tabs.List className="w-full *:flex-1">
            <Tabs.Trigger value="steps">{t("anatomy.viewer.howItWorks")}</Tabs.Trigger>
            <Tabs.Trigger value="parts">
              {t("anatomy.viewer.partsTab")}
              <Tabs.Badge>{scene.parts.length}</Tabs.Badge>
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="steps" className="min-h-0">
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-4 p-2 pt-4">
                <Markdown
                  text={scene.object}
                  passages={passages}
                  onCite={onOpenPassage}
                  className="px-1 text-sm text-muted-foreground"
                />
                <ol className="flex flex-col gap-1">
                  {steps.map((item, index) => (
                    <li key={index}>
                      <button
                        type="button"
                        onClick={() => goTo(index)}
                        aria-current={index === step ? "step" : undefined}
                        className={cn(
                          "flex w-full cursor-pointer items-start gap-3 rounded-xl px-2.5 py-2 text-start text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          index === step
                            ? "bg-muted"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-px flex size-5 shrink-0 items-center justify-center rounded-full border font-mono text-[0.6875rem] tabular-nums",
                            index === step && "border-foreground bg-foreground text-background",
                          )}
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 font-medium">{item.title}</span>
                      </button>
                      {index === step && item.explanation ? (
                        <Markdown
                          text={item.explanation}
                          passages={passages}
                          onCite={onOpenPassage}
                          className="ps-10 pe-2 pt-1 pb-2 text-sm text-muted-foreground"
                        />
                      ) : null}
                    </li>
                  ))}
                </ol>
                {scene.caption ? (
                  <div className="border-t px-1 pt-3 text-xs text-muted-foreground">
                    <Markdown text={scene.caption} passages={passages} onCite={onOpenPassage} />
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          </Tabs.Content>

          <Tabs.Content value="parts" className="min-h-0">
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-4 p-2 pt-4">
                <p className="px-1 text-xs text-muted-foreground">
                  {t("anatomy.viewer.pointHint")}
                </p>
                {assemblies.map((assembly) => (
                  <div key={assembly.id}>
                    <p className="mb-1 px-2.5 text-xs font-medium text-muted-foreground">
                      {assembly.name}
                    </p>
                    <ul className="flex flex-col">
                      {assembly.parts.map((part) => {
                        const open = selected === part.id;
                        return (
                          <li
                            key={part.id}
                            ref={(node) => {
                              if (node) rows.current.set(part.id, node);
                              else rows.current.delete(part.id);
                            }}
                          >
                            <button
                              type="button"
                              aria-expanded={open}
                              onClick={() => choose(part.id)}
                              onPointerEnter={() => setHovered(part.id)}
                              onPointerLeave={() => setHovered(null)}
                              onFocus={() => setHovered(part.id)}
                              onBlur={() => setHovered(null)}
                              className={cn(
                                "flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-start text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                open
                                  ? "bg-muted"
                                  : active === part.id
                                    ? "bg-muted/60"
                                    : "hover:bg-muted/60",
                              )}
                            >
                              <span
                                className={cn(
                                  "size-2 shrink-0 rounded-full border",
                                  active === part.id
                                    ? "border-info bg-info"
                                    : lit.has(part.id)
                                      ? "border-foreground bg-foreground"
                                      : "border-muted-foreground/50",
                                )}
                              />
                              <span className="min-w-0 flex-1 truncate">{part.name}</span>
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {t(`anatomy.viewer.roles.${part.role}`)}
                              </span>
                            </button>
                            {open ? (
                              <div className="ps-7 pe-2.5 pt-1 pb-3">
                                <Markdown
                                  text={part.explanation}
                                  passages={passages}
                                  onCite={onOpenPassage}
                                  className="text-sm text-muted-foreground"
                                />
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </Tabs.Content>
        </Tabs>
      </aside>
    </div>
  );
}
