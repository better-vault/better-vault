import { studioToolIds } from "../../../studio/tools";
import { mcpAreas, text, type McpArea, type ToolContext } from "./context";

/**
 * What an agent can do here, by area: the tools that read and the ones that
 * change things, the shape of what they return, and whether changes are
 * allowed right now. Agents call `describe_app` first, the way DeepSeek
 * Harness's Creator Mode inspects the running app before it builds, instead
 * of guessing at the API.
 */
export const areaGuide: Record<
  McpArea | "activity",
  { about: string; reads: string[]; writes: string[]; record: string }
> = {
  notebooks: {
    about:
      "Notebooks, kept in vaults and folders. Each has its own sources, chats and Studio outputs.",
    reads: ["list_vaults", "list_folders", "list_notebooks"],
    writes: ["create_notebook", "rename_notebook"],
    record: "{ id, title, vault, folderId, pinned, updatedAt, sources[] }",
  },
  sources: {
    about:
      "A notebook's documents as plain text, split into passages. Only selected sources are used by its chat and Studio. YouTube sources are transcripts with [mm:ss] marks.",
    reads: ["search_sources", "read_source"],
    writes: ["add_source", "set_source_selected", "delete_source"],
    record:
      "{ id, title, format (pdf, web, youtube, csv, docx, xlsx, pptx, epub, markdown, text, …), url?, fileName?, selected, characters }",
  },
  notes: {
    about: "Obsidian-style Markdown notes with [[links]], #tags and backlinks, in vaults.",
    reads: ["list_notes", "search_notes", "read_note", "list_backlinks"],
    writes: ["write_note", "delete_note"],
    record: "{ id, title, vault, folder?, tags[], updatedAt }",
  },
  skills: {
    about:
      "SKILL.md instructions shared between the user, the app's chats and agents. Also served as prompts and skill:// resources.",
    reads: ["list_skills", "read_skill"],
    writes: ["write_skill", "delete_skill"],
    record: "{ id, name, description, vault, updatedBy }",
  },
  calendar: {
    about: "The user's calendar. Timed events use local times; all-day events use days.",
    reads: ["list_events"],
    writes: ["create_event", "update_event", "delete_event"],
    record: "{ id, title, start, end, allDay?, description?, location?, recurring? }",
  },
  plugins: {
    about:
      "Plugins: panels and themes that run sandboxed inside the app. describe_app's `plugins` section has the manifest, bridge methods, slots and theme tokens.",
    reads: ["list_plugins", "read_plugin"],
    writes: ["install_plugin", "update_plugin", "remove_plugin"],
    record: "{ id, name, version, enabled, permissions[], panels[], theme? }",
  },
  activity: {
    about: `What the user made: chats, Studio outputs (${studioToolIds.join(", ")}) and bots' threads. Read only.`,
    reads: [
      "list_chats",
      "read_chat",
      "list_outputs",
      "read_output",
      "list_bots",
      "read_bot_thread",
    ],
    writes: [],
    record:
      "chat { id, title, messages[] }, output { id, tool, title, status, data }, bot { id, name, title, instructions }",
  },
};

export function registerDescribeTool(
  ctx: ToolContext,
  extra: () => Record<string, unknown> = () => ({}),
) {
  ctx.mcp.registerTool(
    "describe_app",
    {
      description:
        "Start here: what better-vault holds, every tool by area, the shape of what they return, and which areas you may change right now.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      ctx.log("describe_app");
      return text({
        app: "better-vault",
        version: ctx.version,
        about:
          "A local-first, bring-your-own-model research notebook (like NotebookLM) with Obsidian-style notes, skills, a calendar, bots and plugins. Everything stays on the user's device.",
        areas: Object.fromEntries(
          Object.entries(areaGuide).map(([area, guide]) => [
            area,
            {
              ...guide,
              mayChange:
                area === "activity" ? false : ctx.canWrite(area as (typeof mcpAreas)[number]),
            },
          ]),
        ),
        conventions: {
          vaults: "Tools that take `vault` accept its name or id; the default vault when left out.",
          permissions:
            "When a change is turned off, the tool says so. Ask the user to allow it in Settings → MCP; don't work around it.",
          citations: "Chat answers cite sources as [n], numbered per answer.",
        },
        ...extra(),
      });
    },
  );
}
