import { MockImageModelV4, MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import {
  buildImagePrompt,
  generateInfographic,
  imageCallSettings,
  imageDimensions,
  normalizeBrief,
} from "./server";

const raw = {
  title: "Five risk domains [2]",
  subtitle: "Where trust breaks",
  sections: [
    {
      heading: "IoT",
      points: [
        { text: "Weak endpoints spread risk at scale [1].", short: "Weak endpoints at scale" },
      ],
      visual: "a sensor",
    },
    {
      heading: "Cloud",
      points: [{ text: "Most incidents start with identity [3].", short: "" }],
      visual: "",
    },
    { heading: "", points: [], visual: "" },
  ],
  numbers: [{ value: "40%", label: "of incidents involve identity [3]" }],
  takeaway: "Identity is the new perimeter [1]",
  layout: "columns",
};

const bytes = (base64: string) => Uint8Array.from(Buffer.from(base64, "base64"));
// A 1×1 PNG, a 1×1 JPEG and a 1×1 lossless WebP.
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==";
const JPEG =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const WEBP = "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==";

describe("normalizeBrief", () => {
  it("keeps citations in the full text only, and drops empty sections", () => {
    const brief = normalizeBrief(raw, "standard");
    expect(brief.title).toBe("Five risk domains");
    expect(brief.sections).toHaveLength(2);
    expect(brief.sections[0].points[0]).toEqual({
      text: "Weak endpoints spread risk at scale [1].",
      short: "Weak endpoints at scale",
    });
    expect(brief.sections[1].points[0].short).toBe("Most incidents start with identity.");
    expect(brief.takeaway).toBe("Identity is the new perimeter");
  });
});

describe("buildImagePrompt", () => {
  it("quotes only the short texts, with the orientation and style, and no citation numbers", () => {
    const prompt = buildImagePrompt(normalizeBrief(raw, "standard"), {
      orientation: "portrait",
      style: "sketch-note",
    });
    expect(prompt).toContain('"Five risk domains"');
    expect(prompt).toContain('"Weak endpoints at scale"');
    expect(prompt).toContain("portrait");
    expect(prompt).toContain("sketch-note");
    expect(prompt).not.toMatch(/\[\d+\]/);
  });
});

describe("imageCallSettings", () => {
  it("gives OpenAI a size and Google an aspect ratio", () => {
    const openai = imageCallSettings({ provider: "openai", modelId: "gpt-image-2" }, "landscape");
    expect(openai.size).toBe("1536x1024");
    expect(openai.aspectRatio).toBeUndefined();
    const google = imageCallSettings(
      { provider: "google", modelId: "gemini-3-pro-image-preview" },
      "portrait",
    );
    expect(google.aspectRatio).toBe("2:3");
    expect(google.size).toBeUndefined();
    expect(JSON.stringify(google.providerOptions)).toContain("image/jpeg");
  });
});

describe("imageDimensions", () => {
  it("reads PNG, JPEG and WebP headers", () => {
    expect(imageDimensions(bytes(PNG))).toEqual({ width: 1, height: 1 });
    expect(imageDimensions(bytes(JPEG))).toEqual({ width: 1, height: 1 });
    expect(imageDimensions(bytes(WEBP))).toEqual({ width: 1, height: 1 });
    expect(imageDimensions(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("generateInfographic", () => {
  const language = new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(raw) }],
      finishReason: { unified: "stop", raw: undefined },
      usage: {
        inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
        outputTokens: { total: 1, text: 1, reasoning: undefined },
      },
      warnings: [],
    }),
  });
  const args = {
    model: language,
    options: {
      orientation: "landscape" as const,
      style: "auto" as const,
      detail: "standard" as const,
      imageModel: { provider: "openai" as const, modelId: "gpt-image-2" },
    },
    language: "auto",
    focus: "",
    passages: [
      {
        n: 1,
        chunkId: "s:0",
        sourceId: "s",
        title: "Notes",
        kind: "text" as const,
        text: "Weak endpoints.",
      },
    ],
  };

  it("plans a brief, then draws it with the image model", async () => {
    const calls: unknown[] = [];
    const image = new MockImageModelV4({
      doGenerate: async (options) => {
        calls.push(options);
        return {
          images: [PNG],
          warnings: [],
          response: { timestamp: new Date(), modelId: "gpt-image-2", headers: {} },
        };
      },
    });
    const result = await generateInfographic({
      ...args,
      image: { model: image, ref: args.options.imageModel },
    });
    expect(result.title).toBe("Five risk domains");
    expect(result.data.image.dataUrl.startsWith("data:image/png;base64,")).toBe(true);
    expect(result.data.image).toMatchObject({ width: 1, height: 1 });
    expect(calls[0]).toMatchObject({ size: "1536x1024" });
  });

  it("refuses pictures too large to send back", async () => {
    const big = "A".repeat(4_000_000);
    const image = new MockImageModelV4({
      doGenerate: async () => ({
        images: [big],
        warnings: [],
        response: { timestamp: new Date(), modelId: "m", headers: {} },
      }),
    });
    await expect(
      generateInfographic({ ...args, image: { model: image, ref: args.options.imageModel } }),
    ).rejects.toThrow(/too large/);
  });

  it("needs an image model", async () => {
    await expect(generateInfographic(args)).rejects.toThrow(/image model/);
  });
});
