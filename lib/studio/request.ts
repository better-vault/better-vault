import type { ModelRef, ProviderCredentials } from "@/lib/ai/catalog";
import { db } from "@/lib/db/database";
import { activeModel, contextCharsFor, credentialsFor, getSettings } from "@/lib/db/settings";
import { getChunks } from "@/lib/db/sources";
import { selectPassages, type Passage } from "@/lib/grounding/passages";

export interface ModelRequest {
  model: ModelRef;
  credentials: ProviderCredentials;
  passages: Passage[];
}

export class NoModelError extends Error {}
export class NoSourcesError extends Error {}

/**
 * The model, its credentials and the passages of these sources, read fresh
 * from settings. `budget` caps the text sent below the model's own limit.
 */
export async function modelRequestFor(sourceIds: readonly string[], query: string, budget?: number): Promise<ModelRequest> {
  const settings = await getSettings();
  const model = activeModel(settings);
  if (!model) throw new NoModelError();
  const sources = (await db.sources.bulkGet([...sourceIds])).filter((source) => source !== undefined);
  const chunks = await getChunks(sources.map((source) => source.id));
  const limit = contextCharsFor(settings, model.provider);
  const passages = selectPassages({ sources, chunks, budget: Math.min(limit, budget ?? limit), query });
  if (passages.length === 0) throw new NoSourcesError();
  return { model, credentials: credentialsFor(settings, model.provider), passages };
}
