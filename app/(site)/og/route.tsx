import { createHash } from "node:crypto";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { OG_SIZE, OgCard } from "@/lib/site/og-card";
import { site } from "@/lib/site/config";

/*
 * Social cards for docs pages, from query parameters. A route handler, since
 * an opengraph-image file can't sit under the docs' optional catch-all. The
 * image is a pure function of its URL, so it is cached for a year.
 */
const CACHE = "public, max-age=31536000, s-maxage=31536000, immutable";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get("title")?.slice(0, 90) ?? site.name;
  const description = searchParams.get("description")?.slice(0, 160) ?? site.tagline;
  const eyebrow = searchParams.get("eyebrow")?.slice(0, 40) ?? `${site.name} docs`;

  const image = new ImageResponse(
    <OgCard eyebrow={eyebrow} title={title} description={description} footer="Open source · MIT" />,
    OG_SIZE,
  );
  // Buffered so the response has a length and an ETag, which link crawlers like.
  const body = await image.arrayBuffer();
  return new Response(body, {
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(body.byteLength),
      "Cache-Control": CACHE,
      ETag: `"${createHash("sha1").update(Buffer.from(body)).digest("hex")}"`,
    },
  });
}
