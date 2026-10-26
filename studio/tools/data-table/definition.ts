import { z } from "zod";
import { csvRow } from "@/studio/csv";
import { defineTool, textBlob } from "@/studio/types";

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
  exports: [
    {
      format: "xlsx",
      build: async (_title, data) => {
        const { default: writeExcelFile } = await import("write-excel-file/browser");
        const longest = (column: number) =>
          Math.max(
            data.columns[column].length,
            ...data.rows.map((row) => row[column]?.length ?? 0),
          );
        const sheet = [
          data.columns.map((value) => ({
            value,
            fontWeight: "bold" as const,
            backgroundColor: "#EFEFEF",
          })),
          ...data.rows.map((row) => row.map((value) => ({ value, wrap: true }))),
        ];
        return writeExcelFile(sheet, {
          columns: data.columns.map((_, at) => ({
            width: Math.min(60, Math.max(12, longest(at) + 2)),
          })),
          stickyRowsCount: 1,
        }).toBlob();
      },
    },
    {
      format: "csv",
      build: async (_title, data) =>
        textBlob([csvRow(data.columns), ...data.rows.map(csvRow)].join("\n"), "text/csv"),
    },
  ],
});
