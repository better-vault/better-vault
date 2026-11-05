"use client";

import { createContext, useContext } from "react";
import type { KloqStore } from "../lib/calendar-store";

const StoreContext = createContext<KloqStore | null>(null);

export const StoreProvider = StoreContext.Provider;

/** The store when rendered inside <Kloq>, else null. */
export function useOptionalKloqStore(): KloqStore | null {
  return useContext(StoreContext);
}

/** The active event store — slot components mutate through this. */
export function useKloqStore(): KloqStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useKloqStore must be used inside <Kloq>");
  return store;
}
