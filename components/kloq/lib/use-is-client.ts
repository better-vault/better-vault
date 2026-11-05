"use client";

import { useSyncExternalStore } from "react";

// `false` during SSR and the first client render, `true` after. Today-dependent layout must not hydrate.

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function useIsClient(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
