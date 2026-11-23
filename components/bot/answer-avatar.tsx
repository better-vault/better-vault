import { useEffect, useState } from "react";
import type { BotAvatar as BotLook } from "@/lib/db/types";
import { BotAvatar } from "./bot-avatar";

/**
 * The character beside a finished answer. A fresh answer greets you with a
 * happy face for a moment, then settles; older answers just sit at rest.
 */
export function AnswerAvatar({ avatar, fresh = false }: { avatar: BotLook; fresh?: boolean }) {
  const [happy, setHappy] = useState(fresh);
  useEffect(() => {
    if (!fresh) return;
    const timer = window.setTimeout(() => setHappy(false), 2400);
    return () => window.clearTimeout(timer);
  }, [fresh]);

  return (
    <BotAvatar
      avatar={avatar}
      size={30}
      mood={happy ? "happy" : "idle"}
      followPointer={fresh}
      className="animate-in duration-500 zoom-in-75 fade-in motion-reduce:animate-none"
    />
  );
}
