import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

/** Search for the docs, used by the search dialog. */
export const { GET } = createFromSource(source, { language: "english" });
