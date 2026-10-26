import { providers, type ModelRef, type ProviderCredentials } from "@/lib/ai/catalog";
import { db } from "@/lib/db/database";
import {
  activeModel,
  contextCharsFor,
  credentialsFor,
  getSettings,
  isProviderReady,
} from "@/lib/db/settings";
import { getChunks } from "@/lib/db/sources";
import { selectPassages, type Passage } from "@/lib/grounding/passages";

export interface ModelRequest {
  model: ModelRef;
  credentials: ProviderCredentials;
  passages: Passage[];
}

export class NoModelError extends Error {}
export class NoSourcesError extends Error {}
/** The image model chosen for an output can't be used: its provider was removed or has no key. */
export class NoImageModelError extends Error {}

/** The credentials for an image model, read fresh from settings. */
export async function imageCredentialsFor(ref: ModelRef): Promise<ProviderCredentials> {
  const settings = await getSettings();
  if (
    !isProviderReady(settings, ref.provider) ||
    providers[ref.provider].imageModels.length === 0
  ) {
    throw new NoImageModelError();
  }
  return credentialsFor(settings, ref.provider);
}

/**
 * The model, its credentials and the passages of these sources, read fresh
 * from settings. `budget` caps the text sent below the model's own limit.
 */
export async function modelRequestFor(
  sourceIds: readonly string[],
  query: string,
  budget?: number,
): Promise<ModelRequest> {
  const settings = await getSettings();
  const model = activeModel(settings);
  if (!model) throw new NoModelError();
  const sources = (await db.sources.bulkGet([...sourceIds])).filter(
    (source) => source !== undefined,
  );
  const chunks = await getChunks(sources.map((source) => source.id));
  const limit = contextCharsFor(settings, model.provider);
  const passages = selectPassages({
    sources,
    chunks,
    budget: Math.min(limit, budget ?? limit),
    query,
  });
  if (passages.length === 0) throw new NoSourcesError();
  return { model, credentials: credentialsFor(settings, model.provider), passages };
}
