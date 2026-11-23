import { createHash } from "node:crypto";
import { z } from "zod";
import { REGISTRY_RAW, REGISTRY_URL, registrySchema, type Registry } from "@/lib/plugins/registry";

/**
 * The plugin directory, read from GitHub by the app's own API (so the page
 * needs no new host in its Content-Security-Policy). The list is kept for
 * ten minutes; a bundle is fetched when it is installed and checked against
 * the SHA-256 the directory lists.
 */
let cached: { at: number; registry: Registry } | null = null;
const TTL = 10 * 60 * 1000;

async function registry(fresh = false): Promise<Registry> {
  if (!fresh && cached && Date.now() - cached.at < TTL) return cached.registry;
  const response = await fetch(REGISTRY_URL, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`The plugin directory answered ${response.status}.`);
  const parsed = registrySchema.safeParse(await response.json());
  if (!parsed.success) throw new Error("The plugin directory could not be read.");
  cached = { at: Date.now(), registry: parsed.data };
  return parsed.data;
}

export async function GET(request: Request) {
  try {
    const fresh = new URL(request.url).searchParams.has("fresh");
    return Response.json(await registry(fresh));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}

const bundleBody = z.object({ id: z.string().max(64) });

/** One plugin's bundle, only from the directory, only when its SHA-256 matches. */
export async function POST(request: Request) {
  const parsed = bundleBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  try {
    const entry = (await registry()).plugins.find((each) => each.id === parsed.data.id);
    if (!entry) return Response.json({ error: "No plugin with that id." }, { status: 404 });
    const response = await fetch(`${REGISTRY_RAW}${entry.bundle}`);
    if (!response.ok) throw new Error(`The plugin could not be downloaded (${response.status}).`);
    const text = await response.text();
    const hash = createHash("sha256").update(text).digest("hex");
    if (hash !== entry.sha256)
      return Response.json(
        { error: "The download doesn't match the directory, so it was not installed." },
        { status: 409 },
      );
    return Response.json({ bundle: JSON.parse(text) as unknown });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
