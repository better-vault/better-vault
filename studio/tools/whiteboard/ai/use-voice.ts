import { useCallback, useEffect, useRef, useState } from "react";
import { transcribe, warmWhisper } from "@/lib/voice/whisper";

/**
 * Records the microphone for voice input and turns it into text on this
 * device with Whisper (lib/voice/whisper.ts): no key, and the audio never
 * leaves the device. `level` follows the loudness, for the wave; `seconds`
 * counts the recording.
 */
export function useVoice(onText: (text: string) => void, onError: (message: string) => void) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [level, setLevel] = useState(0);
  /** The last moments' loudness, oldest first, for the wave. */
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: 28 }, () => 0));
  const [seconds, setSeconds] = useState(0);
  const available =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia);
  const session = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    context: AudioContext;
    frame: number;
    timer: number;
    chunks: Blob[];
    keep: boolean;
  } | null>(null);

  const release = useCallback(() => {
    const current = session.current;
    if (!current) return;
    cancelAnimationFrame(current.frame);
    clearInterval(current.timer);
    current.stream.getTracks().forEach((track) => track.stop());
    void current.context.close();
    session.current = null;
    setRecording(false);
    setLevel(0);
  }, []);

  useEffect(() => release, [release]);

  const start = useCallback(async () => {
    if (!available || session.current) return;
    // The model downloads (once) while the user speaks.
    warmWhisper();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      onError(error instanceof Error ? error.message : String(error));
      return;
    }
    const recorder = new MediaRecorder(stream);
    const context = new AudioContext();
    const analyser = context.createAnalyser();
    analyser.fftSize = 256;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.frequencyBinCount);
    const began = Date.now();
    const current = {
      recorder,
      stream,
      context,
      frame: 0,
      timer: window.setInterval(() => setSeconds(Math.floor((Date.now() - began) / 1000)), 250),
      chunks: [] as Blob[],
      keep: false,
    };
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let peak = 0;
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128) / 128);
      const now = Math.min(1, peak * 2.2);
      setLevel(now);
      setLevels((before) => [...before.slice(1), now]);
      current.frame = requestAnimationFrame(tick);
    };
    recorder.ondataavailable = (event) => current.chunks.push(event.data);
    recorder.onstop = async () => {
      const keep = current.keep;
      const blob = new Blob(current.chunks, { type: recorder.mimeType || "audio/webm" });
      release();
      if (!keep || blob.size === 0) return;
      setTranscribing(true);
      try {
        onText(await transcribe(blob));
      } catch (error) {
        onError(error instanceof Error ? error.message : String(error));
      } finally {
        setTranscribing(false);
      }
    };
    session.current = current;
    setSeconds(0);
    recorder.start();
    tick();
    setRecording(true);
  }, [available, onError, onText, release]);

  const finish = useCallback((keep: boolean) => {
    const current = session.current;
    if (!current) return;
    current.keep = keep;
    current.recorder.stop();
  }, []);

  return {
    available,
    recording,
    transcribing,
    level,
    levels,
    seconds,
    start,
    done: () => finish(true),
    cancel: () => finish(false),
  };
}
