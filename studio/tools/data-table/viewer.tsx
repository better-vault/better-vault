"use client";

import { Copy01Icon } from "@hugeicons/core-free-icons";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Icon } from "@/components/icon";
import { Button } from "@/components/panelui/button";
import type { ToolViewerProps } from "@/studio/shared/form";
import type { DataTableData } from "./definition";

const cell = (text: string) => text.replace(/\|/g, "\\|").replace(/\n/g, " ");

function toMarkdown(data: DataTableData): string {
  return [
    `| ${data.columns.map(cell).join(" | ")} |`,
    `| ${data.columns.map(() => "---").join(" | ")} |`,
    ...data.rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
  ].join("\n");
}

export function DataTableViewer({ data }: ToolViewerProps<DataTableData>) {
  const { t } = useTranslation("studio");
  return (
    <div className="flex flex-col gap-3 pb-10">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("data-table.viewer.rows", { count: data.rows.length })}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            void navigator.clipboard?.writeText(toMarkdown(data));
            toast.success(t("viewer.copied"));
          }}
        >
          <Icon icon={Copy01Icon} size={16} />
          {t("data-table.viewer.copyMarkdown")}
        </Button>
      </div>
      <div className="overflow-auto rounded-2xl border">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {data.columns.map((column, at) => (
                <th key={at} scope="col" className="border-b px-4 py-2.5 text-start font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, at) => (
              <tr key={at} className="even:bg-muted/30">
                {row.map((value, column) => (
                  <td key={column} className="max-w-80 border-b px-4 py-2.5 align-top leading-6">
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
