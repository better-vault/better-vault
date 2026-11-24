/** Whisper's multilingual base model, converted for Transformers.js. */
export const WHISPER_MODEL = "onnx-community/whisper-base";

export type WhisperIn =
  | { type: "load" }
  /** Mono audio at 16 kHz. */
  | { type: "transcribe"; id: number; audio: Float32Array };

export type WhisperOut =
  | { type: "progress"; loaded: number; total: number }
  | { type: "ready" }
  | { type: "text"; id: number; text: string }
  | { type: "error"; id?: number; message: string };
