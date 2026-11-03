import { isDesktopRuntime } from "@/lib/ai/server-config";
import { findOpenCode } from "@/lib/ai/opencode-local";

/** Whether OpenCode is installed on this computer. Desktop app only: a web server can't see the visitor's computer. */
export async function POST() {
  if (!isDesktopRuntime()) return Response.json({ error: "Desktop app only." }, { status: 404 });
  return Response.json({ install: await findOpenCode() });
}
