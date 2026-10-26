import { generateText, Output } from "ai";
import { z } from "zod";
import { clean, studioSystem, type Generator } from "@/studio/server/shared";
import type { DataTableData, DataTableOptions } from "./definition";

const schema = z.object({
  title: z.string().describe("A short title for the table"),
  columns: z.array(z.string()).describe("The column headings"),
  rows: z
    .array(z.array(z.string()))
    .describe("One array per row, with one cell per column, in column order"),
});

export const generateDataTable: Generator<DataTableOptions, DataTableData> = async ({
  model,
  abortSignal,
  ...args
}) => {
  const { output } = await generateText({
    model,
    output: Output.object({ schema }),
    system: studioSystem(
      `Build a data table from the sources: choose useful columns and fill one row per item (concept, person, event, figure, …). Keep cells short. Leave a cell empty when the sources do not say.${args.focus.trim() ? " Follow the user's description of the table." : ""}`,
      args,
    ),
    prompt: "Build the table now.",
    abortSignal,
  });
  const columns = output.columns.map(clean).filter(Boolean);
  if (columns.length === 0) throw new Error("The model returned a table without columns.");
  const rows = output.rows
    .map((row) => columns.map((_, at) => clean(row[at] ?? "")))
    .filter((row) => row.some(Boolean));
  return { title: clean(output.title) || "Data table", data: { columns, rows } };
};
