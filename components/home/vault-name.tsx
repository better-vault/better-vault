import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Vault } from "@/lib/db/database";

/** A vault's name to show: the default vault is "My vault" until it is renamed. */
export function useVaultName() {
  const { t } = useTranslation("home");
  return useCallback((vault: Pick<Vault, "name">) => vault.name || t("vaults.default"), [t]);
}
