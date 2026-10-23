import { z } from "zod";
import { providerIds } from "./catalog";

/** The model and credentials every AI request carries. */
export const modelRefSchema = z.object({
  provider: z.enum(providerIds),
  modelId: z.string().min(1).max(200),
});

export const credentialsSchema = z.object({
  apiKey: z.string().max(500).optional(),
  baseURL: z.string().max(500).optional(),
});
