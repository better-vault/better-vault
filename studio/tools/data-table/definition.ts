import { z } from "zod";
import { csvRow } from "@/studio/csv";
import { defineTool } from "@/studio/types";

export const dataTableOptions = z.object({});

export const dataTableData = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

export type DataTableOptions = z.infer<typeof dataTableOptions>;
export type DataTableData = z.infer<typeof dataTableData>;

export const dataTableTool = defineTool({
  id: "data-table",
  options: dataTableOptions,
  defaults: {} satisfies DataTableOptions,
  data: dataTableData,
  download: (_title, data) => ({
    content: [csvRow(data.columns), ...data.rows.map(csvRow)].join("\n"),
    extension: "csv",
    type: "text/csv",
  }),
});
