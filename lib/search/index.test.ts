import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteAllData } from "@/lib/db/backup";
import { createDexieBackend } from "@/lib/db/dexie-backend";
import { createNotebook } from "@/lib/db/notebooks";
import { addSource, deleteSource } from "@/lib/db/sources";
import { setStoreForTests } from "@/lib/db/store";
import { readCatalogue, searchIndex } from "./index";

describe("search index", () => {
  beforeEach(async () => {
    setStoreForTests(createDexieBackend());
    await deleteAllData();
  });

  it("finds words inside sources, by prefix, and forgets deleted sources", async () => {
    const notebookId = await createNotebook("Biology");
    const source = await addSource({
      notebookId,
      title: "Plants",
      kind: "pdf",
      text: "Chlorophyll absorbs light. Photosynthesis converts light into chemical energy.",
    });
    await searchIndex.sync(await readCatalogue());

    const hits = searchIndex.search("photosynth");
    const passage = hits.find((hit) => hit.kind === "passage");
    expect(passage?.sourceId).toBe(source.id);
    expect(passage?.chunkId).toBe(`${source.id}:0`);
    expect(passage?.snippet).toContain("Photosynthesis");
    expect(searchIndex.search("biology").some((hit) => hit.kind === "notebook")).toBe(true);

    await deleteSource(source.id);
    await searchIndex.sync(await readCatalogue());
    expect(searchIndex.search("photosynth").some((hit) => hit.kind === "passage")).toBe(false);
  });
});
