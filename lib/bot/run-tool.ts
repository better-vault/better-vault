import { generateId } from "ai";
import { calendarStore } from "@/lib/db/calendar";
import { createNote, saveNoteBody } from "@/lib/db/notes";
import { store } from "@/lib/db/store";
import type { CalendarEntry, Note, Vault } from "@/lib/db/types";
import { DEFAULT_VAULT } from "@/lib/db/vaults";
import { selectPassages } from "@/lib/grounding/passages";
import { sameName } from "@/lib/notes/syntax";
import { botToolSchemas, type BotToolInput, type BotToolName } from "./tools";

/** What a tool call needs from the page around it. */
export interface ToolContext {
  /** The vault new notes go to when the bot names none. */
  currentVault: string;
  /** A vault's name as the user sees it ("My vault" for the default one). */
  vaultLabel: (vault: Pick<Vault, "name">) => string;
  /** Hands a task to another bot and waits for its answer (`ask_bot`). */
  askBot: (bot: string, task: string) => Promise<unknown>;
  /** The user's time zone, for calendar entries. */
  timeZone?: string;
}

/** Long texts are cut so one read cannot fill the model's context. */
const READ_LIMIT = 30_000;
const cut = (text: string) =>
  text.length > READ_LIMIT
    ? `${text.slice(0, READ_LIMIT)}\n\n[… cut at ${READ_LIMIT} characters]`
    : text;

/** Runs one tool call on the user's device. Errors come back as `{ error }` for the model to read. */
export async function runBotTool(
  name: BotToolName,
  raw: unknown,
  context: ToolContext,
): Promise<unknown> {
  const parsed = botToolSchemas[name].safeParse(raw);
  if (!parsed.success) return { error: `Invalid input for ${name}: ${parsed.error.message}` };
  try {
    return await run(name, parsed.data as never, context);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function run<Name extends BotToolName>(
  name: Name,
  input: BotToolInput<Name>,
  context: ToolContext,
): Promise<unknown> {
  const vaults = async () => {
    const list = await store().listVaults();
    return list.some((vault) => vault.id === DEFAULT_VAULT)
      ? list
      : [{ id: DEFAULT_VAULT, name: "" } as Vault, ...list];
  };
  const vaultNamed = async (wanted: string | undefined) => {
    if (!wanted) return null;
    const match = (await vaults()).find(
      (vault) => vault.id === wanted || sameName(context.vaultLabel(vault), wanted),
    );
    if (!match) throw new Error(`No vault named "${wanted}".`);
    return match.id;
  };
  const labelOf = async () => {
    const names = new Map((await vaults()).map((vault) => [vault.id, context.vaultLabel(vault)]));
    return (id: string | undefined) => names.get(id ?? DEFAULT_VAULT) ?? "";
  };
  const findNote = async (id?: string, title?: string): Promise<Note> => {
    const note = id
      ? await store().getNote(id)
      : (await store().listNotes()).find((each) => title && sameName(each.title, title));
    if (!note) throw new Error("No such note.");
    return note;
  };

  switch (name) {
    case "list_notebooks": {
      const { vault } = input as BotToolInput<"list_notebooks">;
      const vaultId = await vaultNamed(vault);
      const label = await labelOf();
      const notebooks = (await store().listNotebooks()).filter(
        (each) => !vaultId || (each.vaultId ?? DEFAULT_VAULT) === vaultId,
      );
      return Promise.all(
        notebooks.map(async (notebook) => ({
          id: notebook.id,
          title: notebook.title,
          vault: label(notebook.vaultId),
          sources: (await store().listSources(notebook.id)).map((source) => ({
            id: source.id,
            title: source.title,
            kind: source.kind,
          })),
        })),
      );
    }
    case "search_sources": {
      const { query, notebookId } = input as BotToolInput<"search_sources">;
      const sources = notebookId
        ? await store().listSources(notebookId)
        : await store().listAllSources();
      const chunks = await store().getChunks(sources.map((source) => source.id));
      const notebookOf = new Map(sources.map((source) => [source.id, source.notebookId]));
      return selectPassages({ sources, chunks, budget: 12_000, query })
        .slice(0, 10)
        .map((passage) => ({
          sourceId: passage.sourceId,
          notebookId: notebookOf.get(passage.sourceId),
          title: passage.title,
          text: passage.text,
        }));
    }
    case "read_source": {
      const { sourceId } = input as BotToolInput<"read_source">;
      const source = await store().getSource(sourceId);
      if (!source) throw new Error("No source with that id.");
      return { id: source.id, title: source.title, text: cut(source.text) };
    }
    case "list_notes": {
      const { vault } = input as BotToolInput<"list_notes">;
      const vaultId = await vaultNamed(vault);
      const label = await labelOf();
      return (await store().listNotes())
        .filter((note) => !vaultId || note.vaultId === vaultId)
        .slice(0, 200)
        .map((note) => ({
          id: note.id,
          title: note.title,
          vault: label(note.vaultId),
          folder: note.folder || undefined,
          tags: note.tags.length ? note.tags : undefined,
        }));
    }
    case "search_notes": {
      const { query } = input as BotToolInput<"search_notes">;
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      return (await store().listNotes())
        .filter((note) =>
          words.every((word) =>
            `${note.title}\n${note.body}\n${note.tags.join(" ")}`.toLowerCase().includes(word),
          ),
        )
        .slice(0, 30)
        .map((note) => ({ id: note.id, title: note.title, start: note.body.slice(0, 200) }));
    }
    case "read_note": {
      const { id, title } = input as BotToolInput<"read_note">;
      const note = await findNote(id, title);
      return { id: note.id, title: note.title, body: cut(note.body) };
    }
    case "list_calendar": {
      const { from, to } = input as BotToolInput<"list_calendar">;
      const start = toTime(from);
      const end = toTime(to) + DAY;
      if (Number.isNaN(start) || Number.isNaN(end)) throw new Error("Use days as YYYY-MM-DD.");
      return (await calendarStore.load())
        .filter((entry) => toTime(entry.start) < end && toTime(entry.end) > start)
        .sort((a, b) => toTime(a.start) - toTime(b.start))
        .slice(0, 200)
        .map((entry) => ({
          title: entry.title,
          start: entry.start,
          end: entry.end,
          allDay: entry.allDay || undefined,
          location: entry.location,
          recurring: entry.rrule ? true : undefined,
        }));
    }
    case "list_skills":
      return (await store().listSkills()).map((skill) => ({
        name: skill.name,
        description: skill.description,
      }));
    case "read_skill": {
      const { name: wanted } = input as BotToolInput<"read_skill">;
      const skill = (await store().listSkills()).find((each) => sameName(each.name, wanted));
      if (!skill) throw new Error("No skill with that name.");
      return { name: skill.name, description: skill.description, body: cut(skill.body) };
    }
    case "create_note": {
      const { title, body, vault } = input as BotToolInput<"create_note">;
      const vaultId = (await vaultNamed(vault)) ?? context.currentVault;
      const note = await createNote({ vaultId, title, body });
      return { ok: true, id: note.id, title: note.title };
    }
    case "append_to_note": {
      const { id, title, text } = input as BotToolInput<"append_to_note">;
      const note = await findNote(id, title);
      await saveNoteBody(note.id, `${note.body.replace(/\s+$/, "")}\n\n${text.trim()}\n`);
      return { ok: true, id: note.id, title: note.title };
    }
    case "add_calendar_event": {
      const entry = calendarEntry(
        input as BotToolInput<"add_calendar_event">,
        context.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      );
      await calendarStore.save([...(await calendarStore.load()), entry]);
      return { ok: true, title: entry.title, start: entry.start, end: entry.end };
    }
    case "ask_bot": {
      const { bot, task } = input as BotToolInput<"ask_bot">;
      return context.askBot(bot, task);
    }
  }
}

const DAY = 24 * 60 * 60 * 1000;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;

/** A day (local midnight) or an instant, as milliseconds. */
function toTime(value: string): number {
  const day = DATE.exec(value);
  if (day) return new Date(+day[1], +day[2] - 1, +day[3]).getTime();
  return Date.parse(value);
}

const pad = (n: number) => String(Math.abs(n)).padStart(2, "0");

/** A local date and time as an offset-qualified instant, as the calendar stores them. */
export function localInstant(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00${sign}${pad(Math.trunc(offset / 60))}:${pad(offset % 60)}`;
}

const dateOnly = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** The calendar entry for an `add_calendar_event` call: timed, or all-day with an exclusive end. */
export function calendarEntry(
  input: BotToolInput<"add_calendar_event">,
  timeZone: string,
): CalendarEntry {
  const base = {
    id: generateId(),
    title: input.title.trim(),
    ...(input.description ? { description: input.description } : {}),
    ...(input.location ? { location: input.location } : {}),
  };
  const day = DATE.exec(input.start);
  if (day) {
    const first = new Date(+day[1], +day[2] - 1, +day[3]);
    const lastMatch = input.end ? DATE.exec(input.end) : null;
    const last = lastMatch ? new Date(+lastMatch[1], +lastMatch[2] - 1, +lastMatch[3]) : first;
    const end = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    if (end <= first) throw new Error("The event ends before it starts.");
    return { ...base, allDay: true, start: dateOnly(first), end: dateOnly(end) };
  }
  const start = parseLocal(input.start);
  const end = input.end ? parseLocal(input.end) : new Date(start.getTime() + 60 * 60 * 1000);
  if (end <= start) throw new Error("The event ends before it starts.");
  return { ...base, start: localInstant(start), end: localInstant(end), timeZone };
}

function parseLocal(value: string): Date {
  const match = LOCAL.exec(value);
  if (!match) throw new Error("Use times as YYYY-MM-DDTHH:mm.");
  return new Date(+match[1], +match[2] - 1, +match[3], +match[4], +match[5]);
}
