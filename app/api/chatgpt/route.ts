import { z } from "zod";
import { chatGPTAllowed } from "@/lib/ai/server-config";
import { cancelLogin, loginState, startLogin } from "@/lib/chatgpt/login";
import { currentAccount, signOut } from "@/lib/chatgpt/session";

const bodySchema = z.discriminatedUnion("action", [
  /** The signed-in account, or null. */
  z.object({ action: z.literal("status") }),
  /** Starts a sign-in; answers the page to open. */
  z.object({ action: z.literal("start"), newAccount: z.boolean().optional() }),
  /** How the sign-in with this id is going. */
  z.object({ action: z.literal("poll"), id: z.string().min(1).max(100) }),
  z.object({ action: z.literal("cancel") }),
  z.object({ action: z.literal("signOut") }),
]);

/**
 * Sign in with ChatGPT. The tokens stay with this local server
 * (`lib/chatgpt/store.ts`); the page only learns who is signed in.
 */
export async function POST(request: Request) {
  // A JSON body cannot be sent cross-site without a preflight, which this route never allows.
  if (!request.headers.get("content-type")?.includes("application/json"))
    return Response.json({ error: "Invalid request." }, { status: 415 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;
  if (!chatGPTAllowed()) {
    if (body.action === "status") return Response.json({ account: null, available: false });
    return Response.json(
      { error: "Sign in with ChatGPT is turned off on this server." },
      { status: 403 },
    );
  }
  try {
    switch (body.action) {
      case "status":
        return Response.json({ account: await currentAccount(), available: true });
      case "start":
        return Response.json(await startLogin(body.newAccount ?? false));
      case "poll":
        return Response.json(loginState(body.id));
      case "cancel":
        cancelLogin();
        return Response.json({ ok: true });
      case "signOut":
        return Response.json({ revoked: await signOut() });
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "ChatGPT sign-in failed." },
      { status: 500 },
    );
  }
}
