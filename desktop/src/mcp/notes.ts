import { randomBytes } from "node:crypto";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Note, Skill } from "../../../lib/db/types";
import { analyse, sameName } from "../../../lib/notes/syntax";
import { skillSlug } from "../../../lib/skills/format";
import {
  cut,
  failure,
  findVault,
  guarded,
  text,
  turnedOff,
  vaultName,
  type ToolContext,
} from "./context";

const newId = () => randomBytes(12).toString("base64url");

/** Notes (Obsidian-style Markdown) and skills (SKILL.md). */
export function registerNoteTools(ctx: ToolContext) {
  const { mcp, store, log, changed, canWrite, client } = ctx;

  const noteOut = (note: Note) => ({
    id: note.id,
    title: note.title,
    vault: vaultName(store, note.vaultId),
    folder: note.folder || undefined,
    tags: note.tags,
    updatedAt: new Date(note.updatedAt).toISOString(),
  });

  const findNote = (id?: string, title?: string, vault?: string): Note | undefined => {
    if (id) return store.getNote(id);
    const vaultId = vault ? findVault(store, vault) : null;
    return store
      .listNotes()
      .find(
        (each) => title && sameName(each.title, title) && (!vaultId || each.vaultId === vaultId),
      );
  };

  mcp.registerTool(
    "list_notes",
    {
      description:
        "List notes (Markdown, Obsidian-style with [[links]] and #tags). Optionally one vault's.",
      inputSchema: { vault: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ vault }) =>
      guarded(() => {
        log("list_notes");
        const vaultId = vault ? findVault(store, vault) : null;
        return text(
          store
            .listNotes()
            .filter((note) => !vaultId || note.vaultId === vaultId)
            .map(noteOut),
        );
      }),
  );

  mcp.registerTool(
    "search_notes",
    {
      description: "Find notes whose title, text or tags contain every word of the query.",
      inputSchema: { query: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    async ({ query }) => {
      log("search_notes");
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      const found = store
        .listNotes()
        .filter((note) =>
          words.every((word) =>
            `${note.title}\n${note.body}\n${note.tags.join(" ")}`.toLowerCase().includes(word),
          ),
        );
      return text(found.slice(0, 30).map(noteOut));
    },
  );

  mcp.registerTool(
    "read_note",
    {
      description: "Read a note by id, or by title (in a vault).",
      inputSchema: {
        id: z.string().optional(),
        title: z.string().optional(),
        vault: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id, title, vault }) =>
      guarded(() => {
        log("read_note");
        const note = findNote(id, title, vault);
        return note ? text(`# ${note.title}\n\n${cut(note.body)}`) : failure("No such note.");
      }),
  );

  mcp.registerTool(
    "list_backlinks",
    {
      description: "List the notes that link to a note with [[its title]] or one of its aliases.",
      inputSchema: {
        id: z.string().optional(),
        title: z.string().optional(),
        vault: z.string().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ id, title, vault }) =>
      guarded(() => {
        log("list_backlinks");
        const note = findNote(id, title, vault);
        if (!note) return failure("No such note.");
        const names = [note.title, ...note.aliases];
        const linking = store
          .listNotes()
          .filter(
            (other) =>
              other.id !== note.id &&
              other.links.some(
                (link) =>
                  link.kind === "note" &&
                  names.some((name) => sameName(link.target.split("/").pop() ?? "", name)),
              ),
          );
        return text(linking.map(noteOut));
      }),
  );

  mcp.registerTool(
    "write_note",
    {
      description:
        "Create a note, or replace the text of the note with that title in the vault. Use Obsidian Markdown: [[Note]] links, #tags, - [ ] tasks.",
      inputSchema: {
        title: z.string().min(1).max(200),
        body: z.string().max(200_000),
        vault: z.string().optional(),
        folder: z.string().optional(),
      },
    },
    async ({ title, body, vault, folder }) =>
      guarded(() => {
        if (!canWrite("notes")) return turnedOff("notes");
        log("write_note");
        const vaultId = findVault(store, vault);
        const now = Date.now();
        const existing = store
          .listNotes()
          .find((note) => note.vaultId === vaultId && sameName(note.title, title));
        const note: Note = existing
          ? {
              ...existing,
              body,
              ...analyse(body),
              folder: folder ?? existing.folder,
              updatedAt: now,
            }
          : {
              id: newId(),
              vaultId,
              title: title.replace(/[[\]|#^\\/:]/g, " ").trim(),
              body,
              folder: folder ?? "",
              notebookId: null,
              ...analyse(body),
              createdAt: now,
              updatedAt: now,
            };
        store.putNote(note);
        changed(["notes"]);
        return text({ saved: noteOut(note), created: !existing });
      }),
  );

  mcp.registerTool(
    "delete_note",
    {
      description: "Delete a note by id, or by title (in a vault).",
      inputSchema: {
        id: z.string().optional(),
        title: z.string().optional(),
        vault: z.string().optional(),
      },
      annotations: { destructiveHint: true },
    },
    async ({ id, title, vault }) =>
      guarded(() => {
        if (!canWrite("notes")) return turnedOff("notes");
        log("delete_note");
        const note = findNote(id, title, vault);
        if (!note) return failure("No such note.");
        store.deleteNote(note.id);
        changed(["notes"]);
        return text({ deleted: note.title });
      }),
  );

  mcp.registerResource(
    "note",
    new ResourceTemplate("note://{vault}/{title}", {
      list: async () => ({
        resources: store.listNotes().map((note) => ({
          uri: `note://${encodeURIComponent(vaultName(store, note.vaultId))}/${encodeURIComponent(note.title)}`,
          name: note.title,
          mimeType: "text/markdown",
        })),
      }),
    }),
    { description: "A note's Markdown", mimeType: "text/markdown" },
    async (uri, { vault, title }) => {
      const note = findNote(
        undefined,
        decodeURIComponent(String(title)),
        decodeURIComponent(String(vault)),
      );
      if (!note) throw new Error("No such note.");
      return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: note.body }] };
    },
  );

  // Skills.

  const skillOut = (skill: Skill) => ({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    vault: vaultName(store, skill.vaultId),
    updatedBy: skill.updatedBy,
  });
  const skillMarkdown = (skill: Skill) =>
    `---\nname: ${skill.name}\ndescription: ${skill.description}\n---\n\n${skill.body}`;
  const findSkill = (name: string, vault?: string) => {
    const vaultId = vault ? findVault(store, vault) : null;
    return store
      .listSkills()
      .find((each) => each.name === skillSlug(name) && (!vaultId || each.vaultId === vaultId));
  };

  mcp.registerTool(
    "list_skills",
    {
      description:
        "List the skills (SKILL.md instructions) shared through better-vault. Optionally one vault's.",
      inputSchema: { vault: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ vault }) =>
      guarded(() => {
        log("list_skills");
        const vaultId = vault ? findVault(store, vault) : null;
        return text(
          store
            .listSkills()
            .filter((skill) => !vaultId || skill.vaultId === vaultId)
            .map(skillOut),
        );
      }),
  );

  mcp.registerTool(
    "read_skill",
    {
      description: "Read a skill's instructions by name (and vault).",
      inputSchema: { name: z.string(), vault: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ name, vault }) =>
      guarded(() => {
        log("read_skill");
        const skill = findSkill(name, vault);
        return skill ? text(skillMarkdown(skill)) : failure("No such skill.");
      }),
  );

  mcp.registerTool(
    "write_skill",
    {
      description:
        "Create a skill, or update the skill with that name in the vault. Other agents and the user share it.",
      inputSchema: {
        name: z.string().min(1).max(64),
        description: z.string().max(1000),
        body: z.string().max(100_000),
        vault: z.string().optional(),
      },
    },
    async ({ name, description, body, vault }) =>
      guarded(() => {
        if (!canWrite("skills")) return turnedOff("skills");
        log("write_skill");
        const vaultId = findVault(store, vault);
        const slug = skillSlug(name);
        const now = Date.now();
        const existing = store
          .listSkills()
          .find((skill) => skill.vaultId === vaultId && skill.name === slug);
        const skill: Skill = existing
          ? { ...existing, description, body, updatedBy: client, updatedAt: now }
          : {
              id: newId(),
              vaultId,
              name: slug,
              description,
              body,
              updatedBy: client,
              createdAt: now,
              updatedAt: now,
            };
        store.putSkill(skill);
        changed(["skills"]);
        return text({ saved: skillOut(skill), created: !existing });
      }),
  );

  mcp.registerTool(
    "delete_skill",
    {
      description: "Delete a skill by name (and vault).",
      inputSchema: { name: z.string(), vault: z.string().optional() },
      annotations: { destructiveHint: true },
    },
    async ({ name, vault }) =>
      guarded(() => {
        if (!canWrite("skills")) return turnedOff("skills");
        log("delete_skill");
        const skill = findSkill(name, vault ?? "default");
        if (!skill) return failure("No such skill.");
        store.deleteSkill(skill.id);
        changed(["skills"]);
        return text({ deleted: skill.name });
      }),
  );

  // Skills as resources (skill://vault/name) and as prompts an agent can run.
  mcp.registerResource(
    "skill",
    new ResourceTemplate("skill://{vault}/{name}", {
      list: async () => ({
        resources: store.listSkills().map((skill) => ({
          uri: `skill://${encodeURIComponent(vaultName(store, skill.vaultId))}/${skill.name}`,
          name: skill.name,
          description: skill.description,
          mimeType: "text/markdown",
        })),
      }),
    }),
    { description: "A skill's SKILL.md", mimeType: "text/markdown" },
    async (uri, { vault, name }) => {
      const skill = findSkill(String(name), decodeURIComponent(String(vault)));
      if (!skill) throw new Error("No such skill.");
      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: skillMarkdown(skill) }],
      };
    },
  );
  const seen = new Set<string>();
  for (const skill of store.listSkills()) {
    if (seen.has(skill.name)) continue;
    seen.add(skill.name);
    mcp.registerPrompt(
      skill.name,
      { description: skill.description || `The ${skill.name} skill` },
      async () => ({ messages: [{ role: "user", content: { type: "text", text: skill.body } }] }),
    );
  }
}
