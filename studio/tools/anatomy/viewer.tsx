"use client";

import {
  ArrowExpand01Icon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  ArrowShrink01Icon,
  PauseIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Markdown } from "@/components/chat/markdown";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { cn } from "@/lib/utils";
import type { ToolViewerProps } from "@/studio/shared/form";
import "./anatomy.css";
import type { AnatomyData } from "./definition";
import { AnatomyStage } from "./stage";

/** Seconds each step shows while the tour plays. */
const TOUR = 6;

/** An Anatomy figure: point at a part to read about it, step through how it works, take it apart. */
export function AnatomyViewer({ data, onOpenPassage }: ToolViewerProps<AnatomyData>) {
  const { t } = useTranslation("studio");
  const { scene, passages } = data;
  const steps = scene.steps;
  const [step, setStep] = useState(0);
  const [exploded, setExploded] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  // The tour plays on its own until someone takes over, unless motion is reduced.
  const [playing, setPlaying] = useState(
    () =>
      steps.length > 1 &&
      typeof window !== "undefined" &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  const byId = useMemo(() => new Map(scene.parts.map((part) => [part.id, part])), [scene]);
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
  const activePart = active ? byId.get(active) : undefined;
  const current = steps[step];
  const lit = useMemo(() => {
    if (active) return new Set([active]);
    const focus = current?.focus.length
      ? current.focus
      : scene.parts.filter((part) => part.role === "subject").map((part) => part.id);
    return new Set(focus);
  }, [active, current, scene]);

  useEffect(() => {
    if (!playing || hovered || steps.length < 2) return;
    const timer = window.setTimeout(
      () => setStep((index) => (index + 1) % steps.length),
      TOUR * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [playing, hovered, step, steps.length]);

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

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight") goTo(step + 1);
    else if (event.key === "ArrowLeft") goTo(step - 1);
    else if (event.key === "e" || event.key === "E") toggleApart();
    else if (event.key === "Escape") setSelected(null);
    else return;
    event.preventDefault();
  };

  const readout = activePart ? activePart.name : (current?.readout ?? "");

  return (
    <div className="anatomy flex flex-col gap-8 pb-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <figure className="min-w-0">
          <div
            tabIndex={0}
            onKeyDown={onKeyDown}
            aria-label={t("anatomy.viewer.stageLabel", { title: scene.title })}
            className="relative rounded-3xl border bg-card px-3 py-11 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-8"
          >
            <div className="pointer-events-none absolute inset-x-5 top-4 flex justify-between gap-4 font-mono text-[0.6875rem] tracking-wide text-muted-foreground">
              <span className="text-foreground/70">{t("anatomy.viewer.figure")}</span>
              <span className="truncate tracking-[0.1em] uppercase">{scene.title}</span>
            </div>
            <AnatomyStage
              scene={scene}
              step={step}
              exploded={exploded}
              lit={lit}
              label={scene.object || scene.title}
              onHover={setHovered}
              onSelect={(id) => {
                setPlaying(false);
                setSelected((value) => (value === id ? null : id));
              }}
            />
            <div className="pointer-events-none absolute inset-x-5 bottom-4 flex items-end justify-between gap-4 font-mono text-[0.6875rem] tracking-wide text-muted-foreground">
              <span className="hidden tracking-[0.1em] uppercase sm:inline">
                {t("anatomy.viewer.hint")}
              </span>
              <span aria-live="polite" className="ms-auto truncate text-foreground/70 tabular-nums">
                {readout}
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("anatomy.viewer.previous")}
                disabled={step === 0}
                onClick={() => goTo(step - 1)}
              >
                <Icon icon={ArrowLeft01Icon} size={16} className="rtl:rotate-180" />
              </Button>
              <span className="min-w-20 text-center text-sm text-muted-foreground tabular-nums">
                {t("anatomy.viewer.step", { current: step + 1, total: steps.length })}
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
              {steps.length > 1 ? (
                <Button variant="ghost" size="sm" onClick={() => setPlaying((value) => !value)}>
                  <Icon icon={playing ? PauseIcon : PlayIcon} size={16} />
                  {playing ? t("anatomy.viewer.pause") : t("anatomy.viewer.play")}
                </Button>
              ) : null}
            </div>
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

          {scene.caption ? (
            <figcaption className="mt-4 text-sm leading-relaxed text-muted-foreground">
              <Markdown text={scene.caption} passages={passages} onCite={onOpenPassage} />
            </figcaption>
          ) : null}
        </figure>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-2 lg:self-start">
          <section className="min-h-44 rounded-2xl border bg-card p-4" aria-live="polite">
            {activePart ? (
              <>
                <p className="font-medium">{activePart.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t(`anatomy.viewer.roles.${activePart.role}`)}
                  {scene.assemblies.find((assembly) => assembly.id === activePart.assembly)?.name
                    ? ` · ${scene.assemblies.find((assembly) => assembly.id === activePart.assembly)?.name}`
                    : ""}
                </p>
                <Markdown
                  text={activePart.explanation}
                  passages={passages}
                  onCite={onOpenPassage}
                  className="mt-2 text-sm"
                />
              </>
            ) : (
              <>
                <p className="font-medium">{t("anatomy.viewer.about")}</p>
                <Markdown
                  text={scene.object}
                  passages={passages}
                  onCite={onOpenPassage}
                  className="mt-2 text-sm text-muted-foreground"
                />
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("anatomy.viewer.pointHint")}
                </p>
              </>
            )}
          </section>

          {steps.length > 0 ? (
            <section>
              <h3 className="mb-2 px-1 text-sm font-medium">{t("anatomy.viewer.howItWorks")}</h3>
              <ol className="flex flex-col gap-1">
                {steps.map((item, index) => (
                  <li key={index}>
                    <button
                      type="button"
                      onClick={() => goTo(index)}
                      aria-current={index === step ? "step" : undefined}
                      className={cn(
                        "flex w-full cursor-pointer items-start gap-3 rounded-xl px-3 py-2 text-start text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
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
                        className="px-3 ps-11 pt-1 pb-2 text-sm text-muted-foreground"
                      />
                    ) : null}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </aside>
      </div>

      <section>
        <h3 className="mb-3 text-sm font-medium">
          {t("anatomy.viewer.parts", { count: scene.parts.length })}
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assemblies.map((assembly) => (
            <div key={assembly.id} className="min-w-0">
              <p className="mb-1.5 text-xs text-muted-foreground">{assembly.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {assembly.parts.map((part) => (
                  <button
                    key={part.id}
                    type="button"
                    onPointerEnter={() => setHovered(part.id)}
                    onPointerLeave={() => setHovered(null)}
                    onFocus={() => setHovered(part.id)}
                    onBlur={() => setHovered(null)}
                    onClick={() => {
                      setPlaying(false);
                      setSelected((value) => (value === part.id ? null : part.id));
                    }}
                    aria-pressed={selected === part.id}
                    className={cn(
                      "cursor-pointer rounded-full border px-2.5 py-1 text-xs transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      active === part.id
                        ? "border-foreground bg-foreground text-background"
                        : "bg-card hover:bg-muted",
                    )}
                  >
                    {part.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
