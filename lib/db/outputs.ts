import { generateId } from "ai";
import { useLiveQuery } from "dexie-react-hooks";
import type { ModelRef } from "@/lib/ai/catalog";
import { db, type StudioOutput } from "./database";

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
  await db.outputs.add({ id, ...input, status: "generating", createdAt: now, updatedAt: now });
  await db.notebooks.update(input.notebookId, { updatedAt: now });
  return id;
}

/** Records an output made in the browser, ready at once: a whiteboard, say. */
export async function createReadyOutput(
  input: Omit<NewOutput, "model"> & { data: unknown; model?: ModelRef },
): Promise<string> {
  const now = Date.now();
  const id = generateId();
  await db.outputs.add({ id, ...input, status: "ready", createdAt: now, updatedAt: now });
  await db.notebooks.update(input.notebookId, { updatedAt: now });
  return id;
}

/** Saves edits made in a viewer. False when the output is gone or not ready. */
export async function updateOutputData(id: string, data: unknown): Promise<boolean> {
  const changed = await db.outputs
    .where("id")
    .equals(id)
    .and((output) => output.status === "ready")
    .modify({ data, updatedAt: Date.now() });
  return changed > 0;
}

export async function finishOutput(id: string, result: { title: string; data: unknown }) {
  await db.outputs.update(id, {
    status: "ready",
    title: result.title,
    data: result.data,
    error: undefined,
    updatedAt: Date.now(),
  });
}

export async function failOutput(id: string, error: string) {
  await db.outputs.update(id, { status: "error", error, updatedAt: Date.now() });
}

export async function renameOutput(id: string, title: string) {
  await db.outputs.update(id, { title, updatedAt: Date.now() });
}

export async function deleteOutput(id: string) {
  await db.outputs.delete(id);
}

/**
 * Outputs left "generating" by a page that was closed or reloaded can never
 * finish; marks them as interrupted. `running` holds the ones still in flight.
 */
export async function markInterruptedOutputs(running: ReadonlySet<string>, reason: string) {
  await db.outputs
    .where("status")
    .equals("generating")
    .filter((output) => !running.has(output.id))
    .modify({ status: "error", error: reason });
}

/** A notebook's outputs, newest first. `undefined` while loading. */
export function useOutputs(notebookId: string): StudioOutput[] | undefined {
  return useLiveQuery(
    async () =>
      (await db.outputs.where("notebookId").equals(notebookId).sortBy("createdAt")).reverse(),
    [notebookId],
  );
}

/** One output; `null` when it does not exist, `undefined` while loading. */
export function useOutput(id: string | null): StudioOutput | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.outputs.get(id)) ?? null) : null), [id]);
}
