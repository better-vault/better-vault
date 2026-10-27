import { ImageResponse } from "next/og";
import { OG_SIZE, OgCard } from "@/lib/site/og-card";
import { site } from "@/lib/site/config";

export const alt = `${site.name}: ${site.tagline}`;
export const size = OG_SIZE;
export const contentType = "image/png";

/** The social card for the landing page. Docs pages use /og. */
export default function Image() {
  return new ImageResponse(
    <OgCard
      eyebrow="Open-source NotebookLM alternative"
      title="Chat with your sources. Turn them into study material."
      description="Cited answers, reports, flashcards, quizzes, mind maps and slides, with your own AI model."
      footer="Open source · MIT"
    />,
    size,
  );
}
