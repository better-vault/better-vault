import { useMemo } from "react";
import { useVaultName } from "@/components/home/vault-name";
import { useNotes } from "@/lib/db/notes";
import { useNotebooks } from "@/lib/db/notebooks";
import { useSourceTitles } from "@/lib/db/sources";
import { useVaults } from "@/lib/db/vaults";
import type { LinkWorld } from "@/lib/notes/resolve";

const fallbackColors = ["chart-2", "chart-3", "chart-5", "chart-4", "destructive", "chart-1"];

/** Everything a note's links can point at, across vaults, loaded once for the notes page. */
export function useNotesWorld(): (LinkWorld & { vaultColors: Record<string, string> }) | undefined {
  const notes = useNotes();
  const notebooks = useNotebooks();
  const sources = useSourceTitles();
  const vaults = useVaults();
  const vaultName = useVaultName();
  return useMemo(() => {
    if (!notes || !notebooks || !sources || !vaults) return undefined;
    const vaultColors = Object.fromEntries(
      vaults.map((vault, at) => [
        vault.id,
        vault.color ?? fallbackColors[at % fallbackColors.length],
      ]),
    );
    return { notes, notebooks, sources, vaults, vaultName, vaultColors };
  }, [notes, notebooks, sources, vaults, vaultName]);
}
