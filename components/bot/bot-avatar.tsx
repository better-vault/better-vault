import { useEffect, useRef } from "react";
import { mountAvatar, type AvatarOptions, type MountedAvatar } from "open-bot-avatar/dom";
import { botShape } from "@/lib/bot/avatars";
import { botColor } from "@/lib/bot/colors";
import type { BotAvatar as BotLook } from "@/lib/db/types";
import { cn } from "@/lib/utils";

export type BotMood = NonNullable<AvatarOptions["mood"]>;

/**
 * A bot's face, drawn by open-bot-avatar: its shape with inferred volume,
 * blinking and moods. The mood shows what the bot is doing (thinking while it
 * works, happy when it is done), so no spinner is needed.
 */
export function BotAvatar({
  avatar,
  size,
  mood = "idle",
  followPointer = false,
  label = "",
  className,
}: {
  avatar: BotLook;
  size: number;
  mood?: BotMood;
  followPointer?: boolean;
  /** Its accessible name; empty when a name is shown beside it. */
  label?: string;
  className?: string;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mounted = useRef<MountedAvatar | null>(null);
  const color = botColor(avatar.color);
  const options: AvatarOptions = {
    definition: botShape(avatar.shape),
    color: color.body,
    eyeColor: color.eyes,
    mood,
    followPointer,
    label,
  };

  useEffect(() => {
    if (!host.current) return;
    mounted.current = mountAvatar(host.current, options);
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
      className={cn("shrink-0", className)}
      style={{ width: size, height: size }}
    />
  );
}
