import type { Effort, ModelRef, ProviderCredentials } from "@/lib/ai/catalog";
import {
  activeModel,
  availableModels,
  contextCharsFor,
  credentialsFor,
  effortFor,
  getSettings,
  imageCredentialsFrom,
  speechCredentialsFrom,
} from "@/lib/db/settings";
import { getChunks, getSources } from "@/lib/db/sources";
import { selectPassages, type Passage } from "@/lib/grounding/passages";

export interface ModelRequest {
  model: ModelRef;
  credentials: ProviderCredentials;
  effort: Effort;
  passages: Passage[];
}

export class NoModelError extends Error {}
export class NoSourcesError extends Error {}
/** The image model chosen for an output can't be used: its provider was removed or has no key. */
export class NoImageModelError extends Error {}

/** The credentials for an image model, read fresh from settings. */
export async function imageCredentialsFor(ref: ModelRef): Promise<ProviderCredentials> {
  const credentials = imageCredentialsFrom(await getSettings(), ref.provider);
  if (!credentials) throw new NoImageModelError();
  return credentials;
}

/** The speech model chosen for an output can't be used: its provider has no key. */
export class NoSpeechModelError extends Error {}

/** The credentials for a speech model, read fresh from settings. */
export async function speechCredentialsFor(ref: ModelRef): Promise<ProviderCredentials> {
  const credentials = speechCredentialsFrom(await getSettings(), ref.provider);
  if (!credentials) throw new NoSpeechModelError();
  return credentials;
}

/**
 * The model, its credentials and the passages of these sources, read fresh
 * from settings. `budget` caps the text sent below the model's own limit.
 */
export async function modelRequestFor(
  sourceIds: readonly string[],
  query: string,
  budget?: number,
  /** A model chosen for this output; the prompt bar's when it is gone or not given. */
  preferred?: ModelRef | null,
): Promise<ModelRequest> {
  const settings = await getSettings();
  const usable = preferred
    ? availableModels(settings).find(
        (model) => model.provider === preferred.provider && model.modelId === preferred.modelId,
      )
    : undefined;
  const model = usable ?? activeModel(settings);
  if (!model) throw new NoModelError();
  const sources = await getSources(sourceIds);
  const chunks = await getChunks(sources.map((source) => source.id));
  const limit = contextCharsFor(settings, model.provider);
  const passages = selectPassages({
    sources,
    chunks,
    budget: Math.min(limit, budget ?? limit),
    query,
  });
  if (passages.length === 0) throw new NoSourcesError();
  return {
    model,
    credentials: credentialsFor(settings, model.provider),
    effort: effortFor(settings, model.provider),
    passages,
  };
}
