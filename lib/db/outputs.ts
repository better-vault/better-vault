import { generateId } from "ai";
import type { ModelRef } from "@/lib/ai/catalog";
import { useStoreQuery } from "./live";
import { store } from "./store";
import type { StudioOutput } from "./types";

export interface NewOutput {
  notebookId: string;
  toolId: string;
  title: string;
  options: unknown;
  sourceIds: string[];
  model: ModelRef;
}

/** Records a Studio output that is being generated. */
export async function createOutput(input: NewOutput): Promise<string> {
  const now = Date.now();
  const id = generateId();
  await store().addOutput({ id, ...input, status: "generating", createdAt: now, updatedAt: now });
  return id;
}

/** Records an output made in the browser, ready at once: a whiteboard, say. */
export async function createReadyOutput(
  input: Omit<NewOutput, "model"> & { data: unknown; model?: ModelRef },
): Promise<string> {
  const now = Date.now();
  const id = generateId();
  await store().addOutput({ id, ...input, status: "ready", createdAt: now, updatedAt: now });
  return id;
}

/** Saves edits made in a viewer. False when the output is gone or not ready. */
export async function updateOutputData(id: string, data: unknown): Promise<boolean> {
  return store().patchReadyOutput(id, { data, updatedAt: Date.now() });
}

export async function finishOutput(id: string, result: { title: string; data: unknown }) {
  await store().patchOutput(id, {
    status: "ready",
    title: result.title,
    data: result.data,
    error: undefined,
    updatedAt: Date.now(),
  });
}

export async function failOutput(id: string, error: string) {
  await store().patchOutput(id, { status: "error", error, updatedAt: Date.now() });
}

export async function renameOutput(id: string, title: string) {
  await store().patchOutput(id, { title, updatedAt: Date.now() });
}

export async function deleteOutput(id: string) {
  await store().deleteOutput(id);
}

/**
 * Outputs left "generating" by a page that was closed or reloaded can never
 * finish; marks them as interrupted. `running` holds the ones still in flight.
 */
export async function markInterruptedOutputs(running: ReadonlySet<string>, reason: string) {
  await store().interruptOutputs([...running], reason);
}

/** A notebook's outputs, newest first. `undefined` while loading. */
export function useOutputs(notebookId: string): StudioOutput[] | undefined {
  return useStoreQuery(() => store().listOutputs(notebookId), [notebookId], ["outputs"]);
}

/** One output; `null` when it does not exist, `undefined` while loading. */
export function useOutput(id: string | null): StudioOutput | null | undefined {
  return useStoreQuery(
    async () => (id ? ((await store().getOutput(id)) ?? null) : null),
    [id],
    ["outputs"],
  );
}

/** Starts a failed or interrupted output again. */
export async function restartOutput(id: string) {
  await store().patchOutput(id, { status: "generating", error: undefined, updatedAt: Date.now() });
}
