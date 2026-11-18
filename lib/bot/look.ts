import type { BotAvatar } from "@/lib/db/types";

/**
 * How a bot looks: one character (components/bot/character) in a colour,
 * with up to one item per slot. Ids are stored on the bot; the drawings live
 * with the character. Kept free of the DOM, so tool schemas can list them.
 */
export const headItems = [
  "none",
  "wizard-hat",
  "top-hat",
  "beanie",
  "beret",
  "crown",
  "chef-hat",
  "graduation-cap",
  "headphones",
  "antenna",
] as const;

export const faceItems = [
  "none",
  "round-glasses",
  "square-glasses",
  "sunglasses",
  "monocle",
  "mustache",
  "blush",
] as const;

export const neckItems = ["none", "bow-tie", "tie", "scarf"] as const;

export type HeadItem = (typeof headItems)[number];
export type FaceItem = (typeof faceItems)[number];
export type NeckItem = (typeof neckItems)[number];

export interface Look {
  color: string;
  head: HeadItem;
  face: FaceItem;
  neck: NeckItem;
}

/** Bots saved before the character had a shape; each shape becomes a look of the same spirit. */
const fromShape: Record<string, Partial<Look>> = {
  raven: { head: "top-hat", face: "monocle" },
  magnifier: { face: "round-glasses" },
  note: { head: "beret" },
  calendar: { head: "headphones" },
  cat: { head: "beanie" },
  owl: { face: "round-glasses", head: "graduation-cap" },
  fox: { face: "sunglasses" },
  bunny: { head: "antenna" },
  robot: { head: "antenna" },
  star: { head: "crown" },
  bulb: { head: "antenna" },
  heart: { face: "blush" },
  mushroom: { head: "chef-hat" },
  bear: { face: "mustache" },
  vault: { neck: "tie" },
  cloud: { head: "wizard-hat" },
  leaf: { neck: "scarf" },
};

const pick = <T extends string>(list: readonly T[], value: unknown, fallback: T): T =>
  list.includes(value as T) ? (value as T) : fallback;

/** A bot's look, with old `shape`-only avatars read as a look and unknown ids left out. */
export function botLook(avatar: Partial<BotAvatar> & { shape?: string }): Look {
  const legacy = avatar.shape ? (fromShape[avatar.shape] ?? {}) : {};
  return {
    color: avatar.color ?? "chart-3",
    head: pick(headItems, avatar.head ?? legacy.head, "none"),
    face: pick(faceItems, avatar.face ?? legacy.face, "none"),
    neck: pick(neckItems, avatar.neck ?? legacy.neck, "none"),
  };
}
