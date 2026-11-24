/// <reference lib="webworker" />
import {
  env,
  pipeline,
  type AutomaticSpeechRecognitionPipeline,
  type ProgressInfo,
} from "@huggingface/transformers";
// The ONNX runtime's WebAssembly and its loader, served by the app itself rather
// than a CDN (the same pair Transformers.js would take from jsDelivr).
import mjs from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs?url";
import wasm from "../../node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm?url";
import { WHISPER_MODEL, type WhisperIn, type WhisperOut } from "./whisper-protocol";

/**
 * Speech to text on the device: OpenAI's open Whisper model, run with
 * Transformers.js in this worker so the page stays responsive. The model is
 * downloaded once from Hugging Face and kept in the browser's cache; the
 * audio never leaves the device.
 */
env.allowLocalModels = false;
env.useBrowserCache = true;
// Load the loader from its own address, not a blob: URL, which the CSP doesn't allow.
env.useWasmCache = false;
if (env.backends.onnx.wasm) env.backends.onnx.wasm.wasmPaths = { mjs, wasm };

const post = (message: WhisperOut) => self.postMessage(message);

let loading: Promise<AutomaticSpeechRecognitionPipeline> | null = null;
function load() {
  loading ??= (async () => {
    const progress = (info: ProgressInfo) => {
      if (info.status === "progress_total")
        post({ type: "progress", loaded: info.loaded, total: info.total });
    };
    // WebAssembly with 8-bit weights: about 80 MB once, and it runs on every device.
    const options = { device: "wasm", dtype: "q8", progress_callback: progress } as const;
    const asr = (await pipeline(
      "automatic-speech-recognition",
      WHISPER_MODEL,
      options,
    )) as AutomaticSpeechRecognitionPipeline;
    post({ type: "ready" });
    return asr;
  })().catch((error) => {
    loading = null;
    throw error;
  });
  return loading;
}

self.addEventListener("message", async (event: MessageEvent<WhisperIn>) => {
  const message = event.data;
  try {
    if (message.type === "load") {
      await load();
      return;
    }
    const asr = await load();
    const output = await asr(message.audio, { chunk_length_s: 30, stride_length_s: 5 });
    const text = (Array.isArray(output) ? output.map((part) => part.text).join(" ") : output.text)
      .replace(/\s+/g, " ")
      .trim();
    post({ type: "text", id: message.id, text });
  } catch (error) {
    post({
      type: "error",
      id: message.type === "transcribe" ? message.id : undefined,
      message: error instanceof Error ? error.message : String(error),
    });
  }
});
