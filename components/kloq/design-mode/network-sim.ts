"use client";

/** Network-sim registration: an app registers a handle and the inspector grows a "Network" section. */

export interface NetworkSimHandle {
  /** absent means always on */
  getEnabled?(): boolean;
  setEnabled?(on: boolean): void;
  /** round-trip latency in ms */
  getLatency(): number;
  setLatency(ms: number): void;
  /** failure probability 0..1 */
  getFailureRate(): number;
  setFailureRate(rate: number): void;
  /** requests currently in flight */
  getInFlight(): number;
  /** outcome of the most recent settled request */
  getLastResult(): "ok" | "fail" | null;
  subscribe(listener: () => void): () => void;
}

let current: NetworkSimHandle | null = null;
const registryListeners = new Set<() => void>();

export function registerNetworkSim(handle: NetworkSimHandle | null): void {
  current = handle;
  for (const l of registryListeners) l();
}

export function getNetworkSim(): NetworkSimHandle | null {
  return current;
}

/** Fires on register/unregister, not on stat changes. */
export function subscribeNetworkSim(listener: () => void): () => void {
  registryListeners.add(listener);
  return () => registryListeners.delete(listener);
}
