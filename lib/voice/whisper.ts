import { useSyncExternalStore } from "react";
import type { WhisperIn, WhisperOut } from "./whisper-protocol";

/**
 * The page's side of on-device speech to text (whisper.worker.ts): one
 * worker for the app, started on first use. `whisperState` says whether the
 * model is downloading (with how much), ready, or not loaded yet.
 */
export type WhisperState =
  | { phase: "idle" }
  | { phase: "loading"; progress: number }
  | { phase: "ready" }
  | { phase: "error"; message: string };

let worker: Worker | null = null;
let state: WhisperState = { phase: "idle" };
let next = 0;
const waiting = new Map<number, { resolve: (text: string) => void; reject: (e: Error) => void }>();
const listeners = new Set<() => void>();

const set = (value: WhisperState) => {
  state = value;
  for (const listener of listeners) listener();
};

function start(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL("./whisper.worker.ts", import.meta.url), { type: "module" });
  set({ phase: "loading", progress: 0 });
  worker.addEventListener("message", (event: MessageEvent<WhisperOut>) => {
    const message = event.data;
    if (message.type === "progress")
      set({ phase: "loading", progress: message.total ? message.loaded / message.total : 0 });
    else if (message.type === "ready") set({ phase: "ready" });
    else if (message.type === "text") {
      waiting.get(message.id)?.resolve(message.text);
      waiting.delete(message.id);
    } else {
      if (message.id !== undefined) {
        waiting.get(message.id)?.reject(new Error(message.message));
        waiting.delete(message.id);
      } else set({ phase: "error", message: message.message });
    }
  });
  worker.postMessage({ type: "load" } satisfies WhisperIn);
  return worker;
}

/** Starts downloading the model ahead of time (when the microphone is first shown). */
export function warmWhisper() {
  start();
}

export function useWhisperState(): WhisperState {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
    () => state,
  );
}

/** Turns a recording into mono 16 kHz samples, the form Whisper takes. */
export async function decodeForWhisper(blob: Blob): Promise<Float32Array> {
  const context = new AudioContext({ sampleRate: 16_000 });
  try {
    const audio = await context.decodeAudioData(await blob.arrayBuffer());
    if (audio.numberOfChannels === 1) return new Float32Array(audio.getChannelData(0));
    const left = audio.getChannelData(0);
    const right = audio.getChannelData(1);
    return left.map((value, at) => (value + right[at]) / 2);
  } finally {
    void context.close();
  }
}

/** The words in a recording, worked out on this device. */
export async function transcribe(blob: Blob): Promise<string> {
  const audio = await decodeForWhisper(blob);
  const id = ++next;
  const running = start();
  return new Promise((resolve, reject) => {
    waiting.set(id, { resolve, reject });
    running.postMessage({ type: "transcribe", id, audio } satisfies WhisperIn, [audio.buffer]);
  });
}
