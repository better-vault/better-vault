import { z } from "zod";
import { describeError } from "@/lib/ai/errors";
import { isDesktopRuntime } from "@/lib/ai/server-config";
import {
  accessToken,
  accounts,
  cancelSignIn,
  signInState,
  signOut,
  startSignIn,
} from "@/lib/storage/desktop-oauth";

const service = z.enum(["google", "microsoft"]);
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accounts") }),
  z.object({ action: z.literal("start"), service }),
  z.object({ action: z.literal("poll"), id: z.string().min(1).max(64) }),
  z.object({ action: z.literal("cancel"), id: z.string().min(1).max(64) }),
  z.object({ action: z.literal("token"), service }),
  z.object({ action: z.literal("signOut"), service }),
]);

/**
 * Google Drive and OneDrive sign-ins, in the desktop app only: the web app
 * signs in in the browser instead (lib/storage/web-oauth.ts), so a web
 * server never holds anyone's tokens.
 */
export async function POST(request: Request) {
  if (!isDesktopRuntime()) return Response.json({ error: "Desktop app only." }, { status: 404 });
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json({ error: "Invalid request." }, { status: 415 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;
  try {
    switch (body.action) {
      case "accounts":
        return Response.json({ accounts: await accounts() });
      case "start":
        return Response.json(await startSignIn(body.service));
      case "poll":
        return Response.json(signInState(body.id));
      case "cancel":
        cancelSignIn(body.id);
        return Response.json({ ok: true });
      case "token":
        return Response.json(await accessToken(body.service));
      case "signOut":
        await signOut(body.service);
        return Response.json({ ok: true });
    }
  } catch (error) {
    const message = describeError(error);
    return Response.json({ error: message }, { status: message === "not-signed-in" ? 401 : 502 });
  }
}
