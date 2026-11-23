import { createBot } from "@/lib/db/bots";
import { calendarStore } from "@/lib/db/calendar";
import { createNote, saveNoteBody } from "@/lib/db/notes";
import { createSkill } from "@/lib/db/skills";
import { createFileFromTool } from "@/lib/files/create";
import { store } from "@/lib/db/store";
import type { Note, Source, Vault } from "@/lib/db/types";
import { DEFAULT_VAULT } from "@/lib/db/vaults";
import { selectPassages } from "@/lib/grounding/passages";
import { sameName } from "@/lib/notes/syntax";
import { fetchRemoteSkills } from "@/lib/skills/fetch";
import { skillSlug } from "@/lib/skills/format";
import { calendarEntry, DAY, toTime } from "@/lib/calendar/entries";
import { botToolSchemas, type BotToolInput, type BotToolName } from "./tools";

export { calendarEntry, localInstant } from "@/lib/calendar/entries";

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
  /** The tools this bot may use; any when missing. */
  allowed?: ReadonlySet<BotToolName>;
  /** The one vault this bot may see; every vault when missing. */
  vault?: string;
  /** The bot making the call, recorded on the files it makes. */
  botId?: string;
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
  if (context.allowed && !context.allowed.has(name))
    return {
      error: `This bot isn't allowed to use ${name}. The user can change that in Edit bot.`,
    };
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
  const inScope = (vaultId: string | undefined) =>
    !context.vault || (vaultId ?? DEFAULT_VAULT) === context.vault;
  const vaultNamed = async (wanted: string | undefined) => {
    if (!wanted) return context.vault ?? null;
    const match = (await vaults()).find(
      (vault) => vault.id === wanted || sameName(context.vaultLabel(vault), wanted),
    );
    if (!match) throw new Error(`No vault named "${wanted}".`);
    if (!inScope(match.id)) throw new Error("This bot may only use one vault.");
    return match.id;
  };
  /** Notebooks this bot may see, by id. */
  const visibleNotebooks = async () =>
    new Set(
      (await store().listNotebooks())
        .filter((notebook) => inScope(notebook.vaultId))
        .map((notebook) => notebook.id),
    );
  const visibleSource = async (source: Source | undefined) =>
    source && (await visibleNotebooks()).has(source.notebookId) ? source : undefined;
  const notes = async () => (await store().listNotes()).filter((note) => inScope(note.vaultId));
  const labelOf = async () => {
    const names = new Map((await vaults()).map((vault) => [vault.id, context.vaultLabel(vault)]));
    return (id: string | undefined) => names.get(id ?? DEFAULT_VAULT) ?? "";
  };
  const findNote = async (id?: string, title?: string): Promise<Note> => {
    const note = id
      ? await store().getNote(id)
      : (await notes()).find((each) => title && sameName(each.title, title));
    if (!note || !inScope(note.vaultId)) throw new Error("No such note.");
    return note;
  };

  switch (name) {
    case "list_notebooks": {
      const { vault } = input as BotToolInput<"list_notebooks">;
      const vaultId = await vaultNamed(vault);
      const label = await labelOf();
      const notebooks = (await store().listNotebooks()).filter(
        (each) =>
          inScope(each.vaultId) && (!vaultId || (each.vaultId ?? DEFAULT_VAULT) === vaultId),
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
      const visible = await visibleNotebooks();
      if (notebookId && !visible.has(notebookId)) throw new Error("No notebook with that id.");
      const sources = (
        notebookId ? await store().listSources(notebookId) : await store().listAllSources()
      ).filter((source) => visible.has(source.notebookId));
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
      const source = await visibleSource(await store().getSource(sourceId));
      if (!source) throw new Error("No source with that id.");
      return { id: source.id, title: source.title, text: cut(source.text) };
    }
    case "list_notes": {
      const { vault } = input as BotToolInput<"list_notes">;
      const vaultId = await vaultNamed(vault);
      const label = await labelOf();
      return (await notes())
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
      return (await notes())
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
      return (await store().listSkills())
        .filter((skill) => inScope(skill.vaultId))
        .map((skill) => ({
          name: skill.name,
          description: skill.description,
        }));
    case "read_skill": {
      const { name: wanted } = input as BotToolInput<"read_skill">;
      const skill = (await store().listSkills()).find(
        (each) => inScope(each.vaultId) && sameName(each.name, wanted),
      );
      if (!skill) throw new Error("No skill with that name.");
      return { name: skill.name, description: skill.description, body: cut(skill.body) };
    }
    case "create_file": {
      const vaultId = context.vault ?? context.currentVault;
      return createFileFromTool(input as BotToolInput<"create_file">, {
        vaultId,
        createdBy: context.botId ?? "bot",
      });
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
    case "create_bot": {
      const draft = input as BotToolInput<"create_bot">;
      const bot = await createBot({
        name: draft.name,
        title: draft.title,
        instructions: draft.instructions,
        avatar: {
          color: draft.color ?? "chart-2",
          ...(draft.head && draft.head !== "none" ? { head: draft.head } : {}),
          ...(draft.face && draft.face !== "none" ? { face: draft.face } : {}),
          ...(draft.neck && draft.neck !== "none" ? { neck: draft.neck } : {}),
        },
        access: {
          notebooks: draft.notebooks ?? true,
          notes: draft.notes ?? "read",
          calendar: draft.calendar ?? "read",
          skills: draft.skills ?? "read",
          ...(context.vault ? { vault: context.vault } : {}),
        },
        canDelegate: false,
        canCreateBots: false,
      });
      return { ok: true, id: bot.id, name: bot.name };
    }
    case "find_skills": {
      const { source } = input as BotToolInput<"find_skills">;
      const found = await fetchRemoteSkills(source);
      return {
        repo: found.repo,
        ref: found.ref,
        skills: found.skills.map((skill) => ({
          name: skill.name,
          description: skill.description,
          path: skill.path,
        })),
        ...(found.truncated ? { note: "There are more skills than were listed." } : {}),
      };
    }
    case "add_skills": {
      const { source, names } = input as BotToolInput<"add_skills">;
      const found = await fetchRemoteSkills(source, names);
      const vaultId = context.vault ?? context.currentVault;
      const added: string[] = [];
      for (const skill of found.skills) {
        const made = await createSkill(vaultId, {
          name: skill.name,
          description: skill.description,
          body: skill.body,
        });
        added.push(made.name);
      }
      return { ok: true, added, from: found.repo };
    }
    case "create_skill": {
      const { name: skillName, description, body } = input as BotToolInput<"create_skill">;
      const made = await createSkill(context.vault ?? context.currentVault, {
        name: skillSlug(skillName),
        description: description.trim(),
        body,
      });
      return { ok: true, name: made.name };
    }
    case "ask_bot": {
      const { bot, task } = input as BotToolInput<"ask_bot">;
      return context.askBot(bot, task);
    }
  }
}
