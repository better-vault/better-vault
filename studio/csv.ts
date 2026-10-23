/** One CSV line, quoting cells that need it. */
export function csvRow(cells: readonly string[]): string {
  return cells
    .map((cell) => (/[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell))
    .join(",");
}
