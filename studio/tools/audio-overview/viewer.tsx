import {
  GoBackward15SecIcon,
  GoForward15SecIcon,
  PauseIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Citation } from "@/components/chat/citation";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import { Soundwave } from "@/components/panelui/soundwave";
import { loadBlob } from "@/lib/db/blobs";
import { initials } from "@/lib/db/profile";
import { cn } from "@/lib/utils";
import type { ToolViewerProps } from "@/studio/shared/form";
import type { AudioOverviewData } from "./definition";

const speeds = [1, 1.25, 1.5, 2] as const;
/** How many bars the recording's shape is drawn with. */
const BARS = 96;

/** The two hosts' colours, from the theme. */
const hostTint = ["bg-chart-2/15 text-chart-2", "bg-chart-5/15 text-chart-5"] as const;
const hostText = ["text-chart-2", "text-chart-5"] as const;

/**
 * An Audio Overview: the two hosts' conversation, played with a wave that
 * moves with their voices, a seekable shape of the recording, and the
 * transcript, which follows along and jumps to any line.
 */
export function AudioOverviewViewer({ data, onOpenPassage }: ToolViewerProps<AudioOverviewData>) {
  const { t } = useTranslation("studio");
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [missing, setMissing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(data.audio.duration);
  const [speed, setSpeed] = useState<(typeof speeds)[number]>(1);
  const [levels, setLevels] = useState<number[] | null>(null);
  const activeRef = useRef<HTMLLIElement | null>(null);
  // The same element as `audio`, for changing playback; state is only read.
  const player = useRef<HTMLAudioElement | null>(null);

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
    const index = data.turns.findIndex((turn) => time >= turn.start && time < turn.end);
    if (index >= 0) return index;
    // Between two turns: the one that just ended.
    let last = -1;
    data.turns.forEach((turn, at) => {
      if (turn.end <= time) last = at;
    });
    return last;
  }, [data.turns, time]);
  const speaker = current >= 0 ? data.turns[current].speaker : null;

  // The transcript keeps the line being spoken in view.
  useEffect(() => {
    if (playing) activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
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

  if (missing)
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        {t("audio-overview.viewer.missing")}
      </p>
    );

  const host = speaker === null ? null : data.hosts[speaker];
  const progress = duration > 0 ? time / duration : 0;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col items-center gap-6 rounded-3xl bg-card px-4 pt-8 pb-6 ring-1 ring-border">
        <Soundwave
          variant="radial"
          source={audio}
          state={playing ? "speaking" : "idle"}
          paused={!playing}
          height={220}
          color={speaker === 1 ? "chart-5" : "chart-2"}
          label={
            host
              ? t("audio-overview.viewer.speaking", { name: host.name })
              : t("audio-overview.viewer.idle")
          }
        >
          <Soundwave.Center>
            <span
              className={cn(
                "flex size-20 items-center justify-center rounded-full text-2xl font-semibold transition-colors",
                speaker === null ? "bg-muted text-muted-foreground" : hostTint[speaker],
              )}
            >
              {host ? initials(host.name) : <Icon icon={PlayIcon} size={26} />}
            </span>
          </Soundwave.Center>
        </Soundwave>

        <p className="h-5 text-sm text-muted-foreground" aria-live="polite">
          {host ? (
            <span className={cn("font-medium", hostText[speaker!])}>{host.name}</span>
          ) : (
            t("audio-overview.viewer.hosts", { a: data.hosts[0].name, b: data.hosts[1].name })
          )}
        </p>

        <div className="flex w-full max-w-2xl flex-col gap-2">
          <Seekbar
            levels={levels}
            progress={progress}
            onSeek={(ratio) => seek(ratio * duration)}
            label={t("audio-overview.viewer.seek")}
          />
          <div
            className="flex justify-between font-mono text-xs text-muted-foreground tabular-nums"
            dir="ltr"
          >
            <span>{clock(time)}</span>
            <span>{clock(duration)}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            shape="pill"
            aria-label={t("audio-overview.viewer.back15")}
            title={t("audio-overview.viewer.back15")}
            onClick={() => seek(time - 15)}
            disabled={!audio}
          >
            <Icon icon={GoBackward15SecIcon} size={20} />
          </Button>
          <Button
            size="icon-lg"
            shape="pill"
            aria-label={
              playing ? t("audio-overview.viewer.pause") : t("audio-overview.viewer.play")
            }
            onClick={toggle}
            disabled={!audio}
            className="size-14"
          >
            <Icon icon={playing ? PauseIcon : PlayIcon} size={24} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            shape="pill"
            aria-label={t("audio-overview.viewer.forward15")}
            title={t("audio-overview.viewer.forward15")}
            onClick={() => seek(time + 15)}
            disabled={!audio}
          >
            <Icon icon={GoForward15SecIcon} size={20} />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            shape="pill"
            className="ms-2 w-14 font-mono tabular-nums"
            aria-label={t("audio-overview.viewer.speed", { speed })}
            onClick={() => setSpeed(speeds[(speeds.indexOf(speed) + 1) % speeds.length])}
          >
            {speed}×
          </Button>
        </div>
      </section>

      <section aria-label={t("audio-overview.viewer.transcript")} className="flex flex-col gap-2">
        <h3 className="px-1 text-sm font-semibold">{t("audio-overview.viewer.transcript")}</h3>
        <ol className="flex flex-col gap-1">
          {data.turns.map((turn, index) => {
            const active = index === current;
            const cited = turn.cites
              .map((n) => data.passages.find((passage) => passage.n === n))
              .filter((passage) => passage !== undefined);
            return (
              <li key={index} ref={active ? activeRef : undefined}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => seek(turn.start)}
                  onKeyDown={(event: KeyboardEvent) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      seek(turn.start);
                    }
                  }}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-2xl px-3 py-2.5 text-start transition-colors outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring",
                    active && "bg-muted",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold",
                      hostTint[turn.speaker],
                    )}
                  >
                    {initials(data.hosts[turn.speaker].name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-xs font-medium", hostText[turn.speaker])}>
                      {data.hosts[turn.speaker].name}
                      <span className="ms-2 font-mono text-muted-foreground tabular-nums" dir="ltr">
                        {clock(turn.start)}
                      </span>
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-sm leading-6",
                        active ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {turn.text}
                      {cited.map((passage) => (
                        <span key={passage.n} onClick={(event) => event.stopPropagation()}>
                          <Citation
                            passage={passage}
                            numbers={[passage.n]}
                            onOpen={onOpenPassage}
                          />
                        </span>
                      ))}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/** The recording's shape as bars; pressing or dragging along it moves the playhead. */
function Seekbar({
  levels,
  progress,
  onSeek,
  label,
}: {
  levels: number[] | null;
  progress: number;
  onSeek: (ratio: number) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const ratioAt = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    return box ? Math.max(0, Math.min(1, (clientX - box.left) / box.width)) : 0;
  };
  return (
    <div
      ref={ref}
      dir="ltr"
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      className="cursor-pointer rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onSeek(ratioAt(event.clientX));
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) onSeek(ratioAt(event.clientX));
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") onSeek(Math.min(1, progress + 0.02));
        if (event.key === "ArrowLeft") onSeek(Math.max(0, progress - 0.02));
      }}
    >
      <Soundwave
        variant="bars"
        levels={levels ?? Array.from({ length: BARS }, () => 0.15)}
        progress={progress}
        bars={BARS}
        height={48}
        centered
        label={label}
      />
    </div>
  );
}

/** The loudness of the recording in `BARS` slices, 0 to 1, for the seek bar. */
async function shapeOf(blob: Blob): Promise<number[] | null> {
  try {
    const Context = window.OfflineAudioContext;
    const decoded = await new Context(1, 1, 44_100).decodeAudioData(await blob.arrayBuffer());
    const samples = decoded.getChannelData(0);
    const size = Math.floor(samples.length / BARS);
    const rms: number[] = [];
    for (let bar = 0; bar < BARS; bar++) {
      let sum = 0;
      for (let at = bar * size; at < (bar + 1) * size; at += 16) sum += samples[at] * samples[at];
      rms.push(Math.sqrt(sum / Math.max(1, size / 16)));
    }
    const peak = Math.max(...rms, 1e-6);
    return rms.map((value) => Math.max(0.06, value / peak));
  } catch {
    return null;
  }
}

function clock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
