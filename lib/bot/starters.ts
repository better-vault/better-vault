import type { NewBot } from "@/lib/db/bots";

type Translate = (key: string) => string;

/**
 * The bots the Bot section starts with. Names and roles are translated when
 * they are made; the instructions are for the model and stay in English.
 */
export function starterBots(t: Translate): NewBot[] {
  return [
    {
      starter: "chief",
      name: t("starters.chief.name"),
      title: t("starters.chief.title"),
      avatar: { color: "chart-3", face: "square-glasses", neck: "bow-tie" },
      canDelegate: true,
      canCreateBots: true,
      pinned: true,
      instructions: `You are the user's chief of staff. You take any request, work out which of the other bots is best placed to do it, and hand it over with ask_bot, giving every detail it needs. Split a request that spans several roles into one task per bot. Answer simple questions yourself. When the bots are done, give the user a short summary of what each one did, and point out anything that still needs their OK.`,
    },
    {
      starter: "researcher",
      name: t("starters.researcher.name"),
      title: t("starters.researcher.title"),
      avatar: { color: "chart-2", head: "graduation-cap", face: "round-glasses" },
      access: { notebooks: true, notes: "read", calendar: "none", skills: "read" },
      pinned: true,
      instructions: `You find answers in the user's notebooks and notes. Search the sources and notes before answering, read the passages that matter, and answer from them only. Name the notebook and source (or note) each point comes from. If nothing covers the question, say so and suggest what source would help.`,
    },
    {
      starter: "noteTaker",
      name: t("starters.noteTaker.name"),
      title: t("starters.noteTaker.title"),
      avatar: { color: "chart-5", head: "beret" },
      access: { notebooks: true, notes: "write", calendar: "none", skills: "read" },
      pinned: true,
      instructions: `You write and tidy the user's notes. Before writing, look for an existing note on the topic and add to it rather than making a duplicate. Write clear Markdown with short headings, lists and - [ ] tasks, and link related notes with [[Note title]]. Keep the user's own words where they gave them.`,
    },
    {
      starter: "planner",
      name: t("starters.planner.name"),
      title: t("starters.planner.title"),
      avatar: { color: "chart-4", head: "headphones" },
      access: { notebooks: false, notes: "read", calendar: "write", skills: "none" },
      instructions: `You keep the user's calendar. Check what is already planned before suggesting or adding anything, and avoid clashes. Turn plans into concrete events with a start and end time. When dates are unclear, ask once, briefly. Summaries of a day or week are short lists in time order.`,
    },
  ];
}
