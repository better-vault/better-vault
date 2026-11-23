import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Records the microphone for voice input and turns it into text through the
 * app's /api/transcribe, with the user's OpenAI or ElevenLabs key. `level`
 * follows the loudness, for the recorder's wave.
 */
export function useVoice(
  credentials: { provider: "openai" | "elevenlabs"; apiKey: string } | null,
  onText: (text: string) => void,
  onError: (message: string) => void,
) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [level, setLevel] = useState(0);
  const session = useRef<{
    recorder: MediaRecorder;
    stream: MediaStream;
    context: AudioContext;
    frame: number;
    chunks: Blob[];
    keep: boolean;
  } | null>(null);

  const release = useCallback(() => {
    const current = session.current;
    if (!current) return;
    cancelAnimationFrame(current.frame);
    current.stream.getTracks().forEach((track) => track.stop());
    void current.context.close();
    session.current = null;
    setRecording(false);
    setLevel(0);
  }, []);

  useEffect(() => release, [release]);

  const start = useCallback(async () => {
    if (!credentials || session.current) return;
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
    const current = { recorder, stream, context, frame: 0, chunks: [] as Blob[], keep: false };
    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let peak = 0;
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128) / 128);
      setLevel(Math.min(1, peak * 2.2));
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
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        for (let at = 0; at < bytes.length; at += 0x8000)
          binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
        const response = await fetch("/api/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...credentials, audio: btoa(binary) }),
        });
        const body = (await response.json()) as { text?: string; error?: string };
        if (!response.ok || !body.text) throw new Error(body.error ?? response.statusText);
        onText(body.text.trim());
      } catch (error) {
        onError(error instanceof Error ? error.message : String(error));
      } finally {
        setTranscribing(false);
      }
    };
    session.current = current;
    recorder.start();
    tick();
    setRecording(true);
  }, [credentials, onError, onText, release]);

  const finish = useCallback((keep: boolean) => {
    const current = session.current;
    if (!current) return;
    current.keep = keep;
    current.recorder.stop();
  }, []);

  return {
    available: credentials !== null,
    recording,
    transcribing,
    level,
    start,
    done: () => finish(true),
    cancel: () => finish(false),
  };
}
