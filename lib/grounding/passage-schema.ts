import { z } from "zod";

/** A passage an output may cite as [n], saved with the output. */
export const passageRefSchema = z.object({
  n: z.number(),
  chunkId: z.string(),
  sourceId: z.string(),
  title: z.string(),
  kind: z.enum(["text", "markdown", "pdf", "url"]),
  snippet: z.string(),
});
