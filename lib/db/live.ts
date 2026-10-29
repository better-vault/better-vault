import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useState, type DependencyList } from "react";
import { desktopBridge } from "@/lib/desktop/bridge";
import type { TableName } from "./backend";

/**
 * Runs a store query and runs it again when the data changes. `undefined`
 * while loading. `tables` names what the query reads.
 *
 * In a browser this is Dexie's `useLiveQuery`. In the desktop app the main
 * process reports the tables each write changed, and the query runs again
 * when one of `tables` is among them.
 */
export const useStoreQuery: <T>(
  query: () => Promise<T>,
  deps: DependencyList,
  tables: readonly TableName[],
) => T | undefined =
  typeof window !== "undefined" && window.betterVault ? useDesktopQuery : useBrowserQuery;

function useBrowserQuery<T>(query: () => Promise<T>, deps: DependencyList): T | undefined {
  return useLiveQuery(query, [...deps]);
}

function useDesktopQuery<T>(
  query: () => Promise<T>,
  deps: DependencyList,
  tables: readonly TableName[],
): T | undefined {
  const [result, setResult] = useState<{ value: T } | undefined>(undefined);
  const [version, setVersion] = useState(0);
  const watched = tables.join(",");

  useEffect(() => {
    const bridge = desktopBridge();
    if (!bridge) return;
    const names = new Set(watched.split(","));
    return bridge.db.onChange((changed) => {
      if (changed.some((table) => names.has(table))) setVersion((n) => n + 1);
    });
  }, [watched]);

  useEffect(() => {
    let live = true;
    query().then(
      (value) => {
        if (live) setResult({ value });
      },
      (error: unknown) => {
        console.error(error);
      },
    );
    return () => {
      live = false;
    };
    // The query is rebuilt on every render; its inputs are `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  return result?.value;
}
