import { z } from "zod";
import { providerIds } from "@/lib/ai/catalog";
import { describeError } from "@/lib/ai/errors";
import { listModels } from "@/lib/ai/list-models";
import { credentialsSchema } from "@/lib/ai/request";

const bodySchema = z.object({
  provider: z.enum(providerIds),
  credentials: credentialsSchema,
});

/** Lists a provider's models with the user's own key. Nothing is stored. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  try {
    const models = await listModels(parsed.data.provider, parsed.data.credentials);
    return Response.json({ models });
  } catch (error) {
    return Response.json({ error: describeError(error) }, { status: 502 });
  }
}
