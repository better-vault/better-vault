import { describe, expect, it } from "vitest";
import {
  parseCaptions,
  pickTrack,
  secondsOf,
  timestamp,
  transcriptText,
  youTubeId,
} from "./youtube";

describe("youTubeId", () => {
  it.each([
    ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtube.com/watch?v=dQw4w9WgXcQ&t=42s", "dQw4w9WgXcQ"],
    ["https://m.youtube.com/watch?v=dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://youtu.be/dQw4w9WgXcQ?si=abc", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/shorts/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube.com/live/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
    ["https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ", "dQw4w9WgXcQ"],
  ])("reads %s", (url, id) => expect(youTubeId(url)).toBe(id));

  it.each([
    "https://example.com/watch?v=dQw4w9WgXcQ",
    "https://www.youtube.com/channel/UC123",
    "https://www.youtube.com/watch?v=short",
    "not a url",
  ])("refuses %s", (url) => expect(youTubeId(url)).toBeNull());
});

describe("timestamps", () => {
  it("writes and reads times", () => {
    expect(timestamp(5)).toBe("0:05");
    expect(timestamp(125)).toBe("2:05");
    expect(timestamp(3725)).toBe("1:02:05");
    expect(secondsOf("[2:05]")).toBe(125);
    expect(secondsOf("1:02:05")).toBe(3725);
    expect(secondsOf("soon")).toBeNull();
  });
});

describe("pickTrack", () => {
  const track = (languageCode: string, kind?: string) => ({
    baseUrl: languageCode,
    languageCode,
    kind,
  });
  it("prefers the uploader's captions in the spoken language", () => {
    expect(pickTrack([track("de"), track("en", "asr"), track("en")])?.languageCode).toBe("en");
    expect(pickTrack([track("en", "asr"), track("de")])?.kind).toBeUndefined();
    expect(pickTrack([track("en", "asr")])?.kind).toBe("asr");
    expect(pickTrack([])).toBeUndefined();
  });
});

describe("captions", () => {
  it("reads timed text and joins it into timed paragraphs", () => {
    const xml = `<?xml version="1.0" encoding="utf-8" ?><timedtext format="3"><body>
<p t="1200" d="2000">All right, so here we are,</p>
<p t="3500" d="2000"><s>in front of the</s><s> elephants.</s></p>
<p t="50000" d="2000">They have &#39;really&#39; long trunks.</p>
</body></timedtext>`;
    const cues = parseCaptions(xml);
    expect(cues).toEqual([
      { start: 1.2, text: "All right, so here we are," },
      { start: 3.5, text: "in front of the elephants." },
      { start: 50, text: "They have 'really' long trunks." },
    ]);
    expect(transcriptText(cues)).toBe(
      "[0:01] All right, so here we are, in front of the elephants.\n\n[0:50] They have 'really' long trunks.",
    );
  });

  it("reads the older format", () => {
    expect(
      parseCaptions(
        `<transcript><text start="2.5" dur="1">Tom &amp;amp; Jerry</text></transcript>`,
      ),
    ).toEqual([{ start: 2.5, text: "Tom & Jerry" }]);
  });
});
