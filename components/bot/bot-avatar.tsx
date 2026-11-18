import { useEffect, useRef } from "react";
import { botColor } from "@/lib/bot/colors";
import { botLook } from "@/lib/bot/look";
import type { BotAvatar as BotLook } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { mountCharacter, type CharacterOptions, type MountedCharacter } from "./character/mount";
import type { Mood } from "./character/pose";

export type BotMood = Mood;

/**
 * A bot's face: better-vault's character (./character), a soft rounded head
 * that turns in 3D, in the bot's colour and wearing its items. Its mood shows
 * what the bot is doing (thinking while it works, happy when it is done), so
 * no spinner is needed.
 */
export function BotAvatar({
  avatar,
  size,
  mood = "idle",
  followPointer = false,
  still = false,
  fit = "figure",
  label = "",
  className,
}: {
  avatar: BotLook;
  size: number;
  mood?: BotMood;
  followPointer?: boolean;
  /** One drawing at rest, never animated: for rows of small previews. */
  still?: boolean;
  /** "head" fills the box with the head and crops a hat's top: for small spots like list rows. */
  fit?: "figure" | "head";
  /** Its accessible name; empty when a name is shown beside it. */
  label?: string;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mounted = useRef<MountedCharacter | null>(null);
  const look = botLook(avatar);
  const color = botColor(look.color);
  const options: CharacterOptions = {
    look,
    body: color.body,
    eyes: color.eyes,
    mood,
    followPointer,
    still,
    fit,
    label,
  };

  useEffect(() => {
    if (!host.current) return;
    mounted.current = mountCharacter(host.current, options);
    return () => {
      mounted.current?.destroy();
      mounted.current = null;
    };
    // Mounted once; later changes go through `update` below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mounted.current?.update(options);
  });

  return (
    <div
      ref={host}
      aria-hidden={label ? undefined : true}
      className={cn("shrink-0", fit === "head" && "overflow-hidden", className)}
      style={{ width: size, height: size }}
    />
  );
}
