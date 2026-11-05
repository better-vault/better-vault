"use client";

/** Command registration — a module-level registry hosts push ⌘K actions into. */

export interface KloqCommand {
  /** stable identity — re-registering the same id replaces it in place */
  id: string;
  label: string;
  /** extra words to match on that aren't in the label */
  keywords?: string;
  /** cosmetic shortcut hint, e.g. "⌘K" */
  hint?: string;
  /** group heading; unknown groups render after the built-in ones */
  group?: string;
  /** sort key within a group; lower first, default 0 */
  order?: number;
  /** when present the row renders a check; the label should still describe the action */
  checked?: boolean;
  disabled?: boolean;
  run: () => void;
}

const registry = new Map<string, KloqCommand>();
const listeners = new Set<() => void>();

const emit = () => {
  for (const l of listeners) l();
};

/** Register commands; returns an unregister function covering exactly what this call added. */
export function registerCommands(...commands: KloqCommand[]): () => void {
  for (const c of commands) registry.set(c.id, c);
  emit();
  return () => {
    let changed = false;
    for (const c of commands) changed = registry.delete(c.id) || changed;
    if (changed) emit();
  };
}

export function getCommands(): KloqCommand[] {
  return [...registry.values()];
}

export function subscribeCommands(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test/teardown helper — drops every registration. */
export function clearCommands(): void {
  if (registry.size === 0) return;
  registry.clear();
  emit();
}
