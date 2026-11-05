import { createContext, type Context } from "react";

const key = Symbol.for("better-vault:contexts");
type Registry = Map<string, Context<unknown>>;

/**
 * `createContext`, kept the same across hot reloads in development. When Vite
 * reloads a module that makes a context, a new context would replace the one
 * the mounted provider still holds, and every hook below it would throw
 * "must be used inside its provider" until the page is reloaded.
 */
export function stableContext<T>(name: string, initial: T): Context<T> {
  if (!import.meta.hot) return createContext(initial);
  const holder = globalThis as unknown as Record<symbol, Registry | undefined>;
  const registry = (holder[key] ??= new Map());
  const known = registry.get(name);
  if (known) return known as Context<T>;
  const context = createContext(initial);
  registry.set(name, context as Context<unknown>);
  return context;
}
