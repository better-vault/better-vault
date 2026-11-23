import { experimental_runCodeMode as runCodeMode } from "@ai-sdk/code-mode";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { failure, text } from "./context";

/**
 * Vault script (beta): instead of calling tools one by one, an agent writes
 * one short JavaScript program that calls them as `tools.name(input)` and
 * returns just what it needs. Each tool call no longer costs a round trip
 * and its full result in the agent's context, so far fewer tokens are spent.
 *
 * The program runs in a fresh QuickJS sandbox (@ai-sdk/code-mode): no
 * `process`, no `require`, no files, no network. It reaches the vault only
 * through the same tool handlers agents use directly, so Read only and each
 * area's switch still apply to every change it makes.
 */

type Handler = (args: Record<string, unknown>, extra: unknown) => unknown;
export interface CapturedTool {
  description: string;
  shape: z.ZodRawShape;
  handler: Handler;
}

/**
 * Wraps the MCP server so every tool a group registers is also recorded for
 * scripts. With `exposeAll` off, only `keep` reach agents directly; the rest
 * are reachable from scripts alone.
 */
export function captureTools(
  mcp: McpServer,
  captured: Map<string, CapturedTool>,
  { exposeAll, keep }: { exposeAll: boolean; keep: ReadonlySet<string> },
): McpServer {
  return new Proxy(mcp, {
    get(target, property, receiver) {
      if (property === "registerTool") {
        return (
          name: string,
          config: { description?: string; inputSchema?: z.ZodRawShape },
          handler: Handler,
        ) => {
          captured.set(name, {
            description: config.description ?? "",
            shape: config.inputSchema ?? {},
            handler,
          });
          if (exposeAll || keep.has(name))
            return (target.registerTool as (...args: unknown[]) => unknown)(name, config, handler);
          return undefined;
        };
      }
      const value = Reflect.get(target, property, receiver) as unknown;
      return typeof value === "function"
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
}

/** A tool's input as a TypeScript-like type, from its schema. */
function signature(shape: z.ZodRawShape): string {
  const schema = z.toJSONSchema(z.object(shape), { io: "input", unrepresentable: "any" }) as {
    properties?: Record<
      string,
      { type?: string | string[]; enum?: unknown[]; items?: { type?: string } }
    >;
    required?: string[];
  };
  const required = new Set(schema.required ?? []);
  const fields = Object.entries(schema.properties ?? {}).map(([key, value]) => {
    const type = value.enum
      ? value.enum.map((each) => JSON.stringify(each)).join(" | ")
      : value.type === "array"
        ? `${value.items?.type ?? "unknown"}[]`
        : Array.isArray(value.type)
          ? value.type.join(" | ")
          : (value.type ?? "unknown");
    return `${key}${required.has(key) ? "" : "?"}: ${type}`;
  });
  return `{ ${fields.join("; ")} }`;
}

/** What a tool handler returned, as the value a script sees. */
function unwrap(result: unknown): unknown {
  const body = result as
    { content?: { type: string; text?: string }[]; isError?: boolean } | undefined;
  const first = body?.content?.find((part) => part.type === "text")?.text ?? "";
  if (body?.isError) throw new Error(first || "The tool failed.");
  try {
    return JSON.parse(first);
  } catch {
    return first;
  }
}

export const SCRIPT_TOOLS = ["vault_api", "run_vault_script"] as const;

export function registerScriptTools(
  mcp: McpServer,
  captured: Map<string, CapturedTool>,
  log: (tool: string) => void,
) {
  const callable = () =>
    [...captured.entries()].filter(([name]) => !(SCRIPT_TOOLS as readonly string[]).includes(name));

  mcp.registerTool(
    "vault_api",
    {
      description:
        "Vault script (beta): the tools a script can call, as TypeScript signatures. Read this once, then use run_vault_script to do several steps in one call.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      log("vault_api");
      const lines = callable().map(
        ([name, tool]) =>
          `/** ${tool.description.replace(/\s+/g, " ").slice(0, 240)} */\ntools.${name}(input: ${signature(tool.shape)}): Promise<any>`,
      );
      return text(
        [
          "// Call tools as `await tools.name(input)`. Results are the tools' JSON.",
          "// Use Promise.all for independent calls, filter in code, and `return` only what you need.",
          "// A tool that fails or is not allowed returns { error } instead of its result.",
          ...lines,
        ].join("\n\n"),
      );
    },
  );

  mcp.registerTool(
    "run_vault_script",
    {
      description:
        "Vault script (beta): run a short JavaScript program against the vault in a sandbox. Call tools as `await tools.name(input)` (see vault_api), combine and filter their results in code, and `return` a small JSON value. Saves tokens over many separate tool calls. No network, files or Node APIs; changes obey the same permissions as the tools.",
      inputSchema: {
        code: z
          .string()
          .min(1)
          .max(100_000)
          .describe("JavaScript with top-level await and a final `return`"),
      },
    },
    async ({ code }) => {
      log("run_vault_script");
      const tools = Object.fromEntries(
        callable().map(([name, tool]) => [
          name,
          {
            description: tool.description,
            inputSchema: z.object(tool.shape),
            // A thrown error (a bad input, say) reaches the script as { error } too.
            execute: async (input: Record<string, unknown>) => {
              try {
                return unwrap(await tool.handler(input, {}));
              } catch (error) {
                return { error: error instanceof Error ? error.message : String(error) };
              }
            },
          },
        ]),
      );
      try {
        const result = await runCodeMode({
          js: code,
          tools,
          options: {
            executionPolicy: { timeoutMs: 30_000, cpuTimeoutMs: 10_000, maxBridgeRequests: 200 },
          },
        });
        return text(result === undefined ? "(the script returned nothing)" : result);
      } catch (error) {
        return failure(
          `The script failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    },
  );
}
