import {
  ArrowLeft01Icon,
  GoBackward15SecIcon,
  GoForward15SecIcon,
  PauseIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";
import { useTranslation } from "react-i18next";
import { Citation } from "@/components/chat/citation";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Soundwave, useAudioLevel } from "@/components/panelui/soundwave";
import { ScrollArea } from "@/components/ui/scroll-area";
import { loadBlob } from "@/lib/db/blobs";
import { cn } from "@/lib/utils";
import type { ToolViewerProps } from "@/studio/shared/form";
import { OutputMenu } from "@/studio/shared/output-menu";
import type { AudioOverviewData } from "./definition";

const speeds = [1, 1.25, 1.5, 2] as const;
/** How many bars the recording's shape is drawn with. */
const BARS = 120;

/**
 * An Audio Overview on one screen: the player on one side (a wave for each
 * host in their colour, moving while they speak, the recording with each
 * host's turns marked along it, the controls) and the conversation on the
 * other, each host's lines on their own side.
 */
export function AudioOverviewViewer({
  data,
  chrome,
  onOpenPassage,
}: ToolViewerProps<AudioOverviewData>) {
  const { t } = useTranslation("studio");
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  // The same element as `audio`, for changing playback; state is only read.
  const player = useRef<HTMLAudioElement | null>(null);
  const [missing, setMissing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(data.audio.duration);
  const [speed, setSpeed] = useState<(typeof speeds)[number]>(1);
  const [levels, setLevels] = useState<number[] | null>(null);
  const activeLine = useRef<HTMLLIElement | null>(null);
  // How loud the recording is now; it drives the wave of the host speaking.
  const level = useAudioLevel(audio);
  // Phones get smaller waves, so both fit side by side.
  const wide = useMediaQuery("(min-width: 640px)");

  // The recording, from the notebook's files, as an <audio> element.
  useEffect(() => {
    let url: string | null = null;
    let element: HTMLAudioElement | null = null;
    let live = true;
    void loadBlob(data.audio.fileId).then(async (blob) => {
      if (!live) return;
      if (!blob) {
        setMissing(true);
        return;
      }
      url = URL.createObjectURL(blob);
      element = new Audio(url);
      element.preload = "auto";
      element.addEventListener("play", () => setPlaying(true));
      element.addEventListener("pause", () => setPlaying(false));
      element.addEventListener("ended", () => setPlaying(false));
      element.addEventListener("timeupdate", () => setTime(element!.currentTime));
      element.addEventListener("loadedmetadata", () => {
        if (Number.isFinite(element!.duration)) setDuration(element!.duration);
      });
      player.current = element;
      setAudio(element);
      setLevels(await shapeOf(blob));
    });
    return () => {
      live = false;
      element?.pause();
      if (url) URL.revokeObjectURL(url);
    };
  }, [data.audio.fileId]);

  useEffect(() => {
    if (player.current) player.current.playbackRate = speed;
  }, [audio, speed]);

  const current = useMemo(() => {
    let last = -1;
    data.turns.forEach((turn, at) => {
      if (turn.start <= time) last = at;
    });
    return last;
  }, [data.turns, time]);

  // The transcript keeps the line being spoken in view.
  useEffect(() => {
    if (playing) activeLine.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [current, playing]);

  const seek = (seconds: number) => {
    const element = player.current;
    if (!element) return;
    element.currentTime = Math.max(0, Math.min(duration, seconds));
    setTime(element.currentTime);
  };
  const toggle = () => {
    const element = player.current;
    if (!element) return;
    if (element.paused) void element.play();
    else element.pause();
  };

  const speaker = current >= 0 ? data.turns[current].speaker : null;
  const progress = duration > 0 ? time / duration : 0;

  return (
    // Fits the tab on every screen: only the transcript scrolls. Phones stack the
    // player above it, and the transcript takes the height that is left.
    <div className="relative min-h-[32rem] flex-1">
      <div className="absolute inset-0 grid grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:grid-rows-none">
        {/* The player. */}
        <section className="flex min-h-0 flex-col rounded-2xl bg-card ring-1 ring-border">
          <header className="flex items-center gap-2 p-3">
            {chrome ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t("viewer.back")}
                onClick={chrome.onClose}
              >
                <Icon icon={ArrowLeft01Icon} size={18} className="rtl:rotate-180" />
              </Button>
            ) : null}
            <div className="min-w-0 flex-1 px-1">
              <h2 className="truncate text-[0.9375rem] font-medium">{chrome?.title}</h2>
              <p className="truncate font-mono text-xs text-muted-foreground">{chrome?.meta}</p>
            </div>
            {chrome ? <OutputMenu chrome={chrome} /> : null}
          </header>

          {missing ? (
            <p className="flex flex-1 items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {t("audio-overview.viewer.missing")}
            </p>
          ) : (
            <>
              {/* One wave per host, in their colour; only the one speaking moves. */}
              <div
                className={cn(
                  "grid min-h-0 place-items-center gap-4 px-4 py-3 sm:px-6 sm:py-6 lg:flex-1",
                  // A narrator gets one wave, in the middle.
                  data.hosts.length > 1 ? "grid-cols-2" : "grid-cols-1",
                )}
                aria-live="polite"
              >
                {data.hosts.map((host, index) => {
                  const own = index as 0 | 1;
                  const speaking = playing && speaker === own;
                  return (
                    <div key={index} className="flex flex-col items-center gap-3">
                      <Soundwave
                        variant="radial"
                        level={speaking ? level : 0}
                        state={speaking ? "speaking" : "idle"}
                        paused={!speaking}
                        height={wide ? 156 : 96}
                        color={hostWave[own]}
                        className={cn(
                          "transition-opacity",
                          speaking ? "opacity-100" : "opacity-35",
                        )}
                        label={
                          speaking
                            ? t("audio-overview.viewer.speaking", { name: host.name })
                            : host.name
                        }
                      >
                        <Soundwave.Center>
                          <span
                            className={cn(
                              "flex size-10 items-center justify-center rounded-full text-base font-medium sm:size-12 sm:text-lg",
                              hostTile[own],
                            )}
                          >
                            {host.name.slice(0, 1).toLocaleUpperCase()}
                          </span>
                        </Soundwave.Center>
                      </Soundwave>
                      <p
                        className={cn(
                          "text-sm transition-colors",
                          speaker === own ? "text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {host.name}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-2 border-t border-border px-4 pt-3 pb-4 sm:gap-3 sm:px-5 sm:pt-4 sm:pb-5">
                <Timeline
                  data={data}
                  duration={duration}
                  current={current}
                  levels={levels}
                  progress={progress}
                  onSeek={seek}
                />
                <div
                  className="flex items-center justify-between font-mono text-xs text-muted-foreground tabular-nums"
                  dir="ltr"
                >
                  <span className="text-foreground">{clock(time)}</span>
                  <span>
                    {current >= 0
                      ? t("audio-overview.viewer.turnOf", {
                          turn: current + 1,
                          total: data.turns.length,
                        })
                      : null}
                  </span>
                  <span>{clock(duration)}</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-14 font-mono tabular-nums"
                    aria-label={t("audio-overview.viewer.speed", { speed })}
                    onClick={() => setSpeed(speeds[(speeds.indexOf(speed) + 1) % speeds.length])}
                  >
                    {speed}×
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("audio-overview.viewer.back15")}
                    title={t("audio-overview.viewer.back15")}
                    onClick={() => seek(time - 15)}
                    disabled={!audio}
                  >
                    <Icon icon={GoBackward15SecIcon} size={18} />
                  </Button>
                  <Button
                    size="icon-lg"
                    aria-label={
                      playing ? t("audio-overview.viewer.pause") : t("audio-overview.viewer.play")
                    }
                    onClick={toggle}
                    disabled={!audio}
                  >
                    <Icon icon={playing ? PauseIcon : PlayIcon} size={20} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("audio-overview.viewer.forward15")}
                    title={t("audio-overview.viewer.forward15")}
                    onClick={() => seek(time + 15)}
                    disabled={!audio}
                  >
                    <Icon icon={GoForward15SecIcon} size={18} />
                  </Button>
                  {/* Balances the speed button, so play sits in the middle. */}
                  <span aria-hidden className="w-14" />
                </div>
              </div>
            </>
          )}
        </section>

        {/* The transcript, as a conversation: each host on their own side. */}
        <section
          aria-label={t("audio-overview.viewer.transcript")}
          className="flex min-h-0 flex-col rounded-2xl bg-card ring-1 ring-border"
        >
          <header className="px-5 pt-4 pb-2">
            <h3 className="text-sm font-medium">{t("audio-overview.viewer.transcript")}</h3>
          </header>
          <ScrollArea className="min-h-0 flex-1">
            <ol className="flex flex-col px-4 pt-2 pb-4">
              {data.turns.map((turn, index) => (
                <Bubble
                  key={index}
                  lineRef={index === current ? activeLine : undefined}
                  name={(data.hosts[turn.speaker] ?? data.hosts[0]).name}
                  timecode={clock(turn.start)}
                  speaker={turn.speaker}
                  // A host's consecutive lines group under one name.
                  first={index === 0 || data.turns[index - 1].speaker !== turn.speaker}
                  active={index === current}
                  onSelect={() => seek(turn.start)}
                >
                  {turn.text}
                  {turn.cites
                    .map((n) => data.passages.find((passage) => passage.n === n))
                    .filter((passage) => passage !== undefined)
                    .map((passage) => (
                      <span key={passage.n} onClick={(event) => event.stopPropagation()}>
                        <Citation
                          passage={passage}
                          numbers={[passage.n]}
                          onOpen={onOpenPassage}
                          // On a tinted bubble the default muted mark is too faint to read.
                          className="ms-1 bg-background text-[0.75em] text-foreground ring-1 ring-border"
                        />
                      </span>
                    ))}
                </Bubble>
              ))}
            </ol>
          </ScrollArea>
        </section>
      </div>
    </div>
  );
}

/** The two hosts' colours: green for the first, purple for the second. */
const hostWave = ["chart-3", "chart-5"] as const;
const hostTile = ["bg-chart-3/15 text-chart-3", "bg-chart-5/15 text-chart-5"] as const;
const hostName = ["text-chart-3", "text-chart-5"] as const;
const hostBubble = ["bg-chart-3/10", "bg-chart-5/10"] as const;
const hostRing = ["ring-chart-3/60", "ring-chart-5/60"] as const;
const hostTurn = ["bg-chart-3", "bg-chart-5"] as const;

/**
 * One line of the conversation, on its host's side: the first host on the
 * start side, the second on the end side. Choosing it plays from there.
 */
function Bubble({
  lineRef,
  name,
  timecode,
  speaker,
  first,
  active,
  onSelect,
  children,
}: {
  lineRef?: Ref<HTMLLIElement>;
  name: string;
  timecode: string;
  speaker: 0 | 1;
  first: boolean;
  active: boolean;
  onSelect: () => void;
  children: ReactNode;
}) {
  const end = speaker === 1;
  return (
    <li
      ref={lineRef}
      className={cn(
        "flex flex-col",
        end ? "items-end" : "items-start",
        first ? "mt-4 first:mt-0" : "mt-1",
      )}
    >
      {first ? (
        <p className={cn("mb-1 flex items-baseline gap-2 px-1 text-xs", end && "flex-row-reverse")}>
          <span className={cn("font-medium", hostName[speaker])}>{name}</span>
          <span className="font-mono text-muted-foreground tabular-nums" dir="ltr">
            {timecode}
          </span>
        </p>
      ) : null}
      <div
        role="button"
        tabIndex={0}
        aria-current={active ? "true" : undefined}
        title={timecode}
        onClick={onSelect}
        onKeyDown={(event: KeyboardEvent) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect();
          }
        }}
        className={cn(
          "max-w-[85%] cursor-pointer rounded-2xl px-3.5 py-2 text-sm leading-6 transition-[background-color,color,box-shadow] outline-none focus-visible:ring-2 focus-visible:ring-ring",
          hostBubble[speaker],
          end ? "rounded-se-md" : "rounded-ss-md",
          active
            ? cn("text-foreground ring-1", hostRing[speaker])
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        {children}
      </div>
    </li>
  );
}

/**
 * The recording: its shape, played part in full ink, and under it each turn
 * as a mark in its host's neutral step, the one being spoken in the accent.
 * Pressing or dragging anywhere moves the playhead.
 */
function Timeline({
  data,
  duration,
  current,
  levels,
  progress,
  onSeek,
}: {
  data: AudioOverviewData;
  duration: number;
  current: number;
  levels: number[] | null;
  progress: number;
  onSeek: (seconds: number) => void;
}) {
  const { t } = useTranslation("studio");
  const ref = useRef<HTMLDivElement>(null);
  const at = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    return box ? Math.max(0, Math.min(1, (clientX - box.left) / box.width)) * duration : 0;
  };
  const total = duration || 1;
  return (
    <div
      ref={ref}
      dir="ltr"
      role="slider"
      tabIndex={0}
      aria-label={t("audio-overview.viewer.seek")}
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(progress * duration)}
      aria-valuetext={clock(progress * duration)}
      className="flex cursor-pointer flex-col gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onSeek(at(event.clientX));
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) onSeek(at(event.clientX));
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") onSeek(progress * duration + 5);
        if (event.key === "ArrowLeft") onSeek(progress * duration - 5);
      }}
    >
      <Soundwave
        variant="bars"
        levels={levels ?? Array.from({ length: BARS }, () => 0.12)}
        progress={progress}
        bars={BARS}
        barWidth={2}
        height={44}
        centered
        className="text-foreground"
        label={t("audio-overview.viewer.seek")}
      />
      <div aria-hidden className="flex h-1 gap-px">
        {data.turns.map((turn, index) => (
          <span
            key={index}
            className={cn(
              "h-full rounded-[1px] transition-opacity",
              hostTurn[turn.speaker],
              index === current ? "opacity-100" : "opacity-30",
            )}
            style={{ width: `${((turn.end - turn.start) / total) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** The loudness of the recording in `BARS` slices, 0 to 1, for the timeline. */
async function shapeOf(blob: Blob): Promise<number[] | null> {
  try {
    const decoded = await new OfflineAudioContext(1, 1, 44_100).decodeAudioData(
      await blob.arrayBuffer(),
    );
    const samples = decoded.getChannelData(0);
    const size = Math.floor(samples.length / BARS);
    const rms: number[] = [];
    for (let bar = 0; bar < BARS; bar++) {
      let sum = 0;
      for (let at = bar * size; at < (bar + 1) * size; at += 16) sum += samples[at] * samples[at];
      rms.push(Math.sqrt(sum / Math.max(1, size / 16)));
    }
    const peak = Math.max(...rms, 1e-6);
    return rms.map((value) => Math.max(0.08, value / peak));
  } catch {
    return null;
  }
}

function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}
