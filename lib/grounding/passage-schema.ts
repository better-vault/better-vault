import { z } from "zod";
import { sourceFormats, sourceKinds } from "@/lib/sources/formats";

/** A passage an output may cite as [n], saved with the output. */
export const passageRefSchema = z.object({
  n: z.number(),
  chunkId: z.string(),
  sourceId: z.string(),
  title: z.string(),
  kind: z.enum(sourceKinds),
  format: z.enum(sourceFormats).optional(),
  snippet: z.string(),
});
