import { MockLanguageModelV4, MockSpeechModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { audioOverviewData } from "./definition";
import { batchTurns, fillSpans, generateAudioOverview, scriptTask } from "./server";

const script = {
  title: "Cells, briefly",
  turns: [
    { speaker: "A", text: "Today we look at how cells divide [1].", cites: [1] },
    { speaker: "B", text: "Mitosis has four phases.", cites: [1, 9] },
    { speaker: "A", text: "And meiosis halves the chromosomes.", cites: [] },
  ],
};

const language = new MockLanguageModelV4({
  doGenerate: async () => ({
    content: [{ type: "text", text: JSON.stringify(script) }],
    finishReason: { unified: "stop", raw: undefined },
    usage: {
      inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
      outputTokens: { total: 1, text: 1, reasoning: undefined },
    },
    warnings: [],
  }),
});

const args = (modelId: string, speech: MockSpeechModelV4) => ({
  model: language,
  options: {
    length: "short" as const,
    format: "deep-dive" as const,
    hosts: [
      { voiceId: "v-a", name: "Ada" },
      { voiceId: "v-b", name: "Ben" },
    ] as [{ voiceId: string; name: string }, { voiceId: string; name: string }],
    speechModel: { provider: "elevenlabs" as const, modelId },
  },
  language: "auto",
  focus: "",
  passages: [
    {
      n: 1,
      chunkId: "s:0",
      sourceId: "s",
      title: "Biology",
      kind: "text" as const,
      text: "Cells divide.",
    },
    {
      n: 2,
      chunkId: "s:1",
      sourceId: "s",
      title: "Biology",
      kind: "text" as const,
      text: "Unused.",
    },
  ],
  speech: { model: speech, ref: { provider: "elevenlabs" as const, modelId } },
});

const response = (modelId: string) => ({ timestamp: new Date(0), modelId, headers: {} });

describe("audio overview", () => {
  it("asks for about 150 words a minute, with both hosts' names", () => {
    const task = scriptTask(
      { length: "medium", format: "debate", hosts: null, speechModel: null },
      ["Ada", "Ben"],
    );
    expect(task).toContain("About 1050 words");
    expect(task).toContain("Ada (A) and Ben (B)");
  });

  it("splits long conversations into batches below the limit", () => {
    const turns = Array.from({ length: 5 }, () => ({ text: "x".repeat(1000) }));
    expect(batchTurns(turns, 2400).map((batch) => batch.length)).toEqual([2, 2, 1]);
  });

  it("shares the time of turns without timings by their length", () => {
    expect(fillSpans([null, null], [1, 3], 8)).toEqual([
      { start: 0, end: 2 },
      { start: 2, end: 8 },
    ]);
  });

  it("speaks the script as one dialogue and times each turn", async () => {
    const calls: unknown[] = [];
    const speech = new MockSpeechModelV4({
      modelId: "eleven_v3",
      doGenerate: async (options) => {
        calls.push(options.providerOptions?.elevenlabs);
        return {
          // 16 000 bytes at 128 kbps: one second.
          audio: new Uint8Array(16_000),
          warnings: [],
          response: response("eleven_v3"),
          providerMetadata: {
            elevenlabs: {
              outputFormat: "mp3_44100_128",
              voiceSegments: [
                {
                  voiceId: "v-a",
                  startTimeSeconds: 0,
                  endTimeSeconds: 0.3,
                  characterStartIndex: 0,
                  characterEndIndex: 1,
                  dialogueInputIndex: 0,
                },
                {
                  voiceId: "v-b",
                  startTimeSeconds: 0.3,
                  endTimeSeconds: 0.6,
                  characterStartIndex: 0,
                  characterEndIndex: 1,
                  dialogueInputIndex: 1,
                },
                {
                  voiceId: "v-a",
                  startTimeSeconds: 0.6,
                  endTimeSeconds: 0.9,
                  characterStartIndex: 0,
                  characterEndIndex: 1,
                  dialogueInputIndex: 2,
                },
              ],
            },
          },
        };
      },
    });
    const result = await generateAudioOverview(args("eleven_v3", speech));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      inputs: [
        { text: "Today we look at how cells divide.", voiceId: "v-a" },
        { text: "Mitosis has four phases.", voiceId: "v-b" },
        { text: "And meiosis halves the chromosomes.", voiceId: "v-a" },
      ],
      withTimestamps: true,
    });
    const data = audioOverviewData.parse(result.data);
    expect(data.turns.map((turn) => [turn.speaker, turn.start, turn.end])).toEqual([
      [0, 0, 0.3],
      [1, 0.3, 0.6],
      [0, 0.6, 0.9],
    ]);
    // Citations to passages that weren't sent are dropped; only cited passages are kept.
    expect(data.turns[1].cites).toEqual([1]);
    expect(data.passages.map((passage) => passage.n)).toEqual([1]);
    expect(data.audio.duration).toBe(1);
    expect(result.files?.[0]).toMatchObject({ id: data.audio.fileId, mime: "audio/mpeg" });
    expect(result.files?.[0].bytes.length).toBe(16_000);
  });

  it("speaks one turn at a time with models that have no dialogue", async () => {
    const voices: (string | undefined)[] = [];
    const speech = new MockSpeechModelV4({
      modelId: "eleven_multilingual_v2",
      doGenerate: async (options) => {
        voices.push(options.voice);
        return {
          audio: new Uint8Array(8_000),
          warnings: [],
          response: response("eleven_multilingual_v2"),
          providerMetadata: { elevenlabs: { outputFormat: "mp3_44100_128" } },
        };
      },
    });
    const result = await generateAudioOverview(args("eleven_multilingual_v2", speech));
    expect(voices).toEqual(["v-a", "v-b", "v-a"]);
    expect(result.data.turns.map((turn) => turn.start)).toEqual([0, 0.5, 1]);
    expect(result.data.audio.duration).toBe(1.5);
  });
});
