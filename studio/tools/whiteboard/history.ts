/**
 * Undo and redo, as snapshots. A gesture records the state from before it
 * once, when it ends; changes with the same key within a second (typing, a
 * slider, nudging with the arrow keys) are merged into one step.
 */
export interface History<T> {
  record: (before: T, key?: string, now?: number) => void;
  undo: (current: T) => T | null;
  redo: (current: T) => T | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

export function createHistory<T>(limit = 100): History<T> {
  let past: T[] = [];
  let future: T[] = [];
  let last: { key: string; time: number } | null = null;
  return {
    record(before, key, now = Date.now()) {
      future = [];
      if (key && last && last.key === key && now - last.time < 1000) {
        last.time = now;
        return;
      }
      last = key ? { key, time: now } : null;
      past.push(before);
      if (past.length > limit) past = past.slice(past.length - limit);
    },
    undo(current) {
      const previous = past.pop();
      if (previous === undefined) return null;
      future.push(current);
      last = null;
      return previous;
    },
    redo(current) {
      const next = future.pop();
      if (next === undefined) return null;
      past.push(current);
      last = null;
      return next;
    },
    canUndo: () => past.length > 0,
    canRedo: () => future.length > 0,
    clear() {
      past = [];
      future = [];
      last = null;
    },
  };
}
