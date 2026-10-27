import fs from "node:fs";
import path from "node:path";
import { site } from "@/lib/site/config";

/*
 * The social card, shared by the site's root image and the per-page /og
 * route so the two can't drift. Social cards are rendered images, not app UI,
 * so their colours are written out here (the dark theme's values).
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;

// The renderer has no network, so the logo is inlined. Drawn on dark surfaces.
const LOGO = `data:image/png;base64,${fs
  .readFileSync(path.join(process.cwd(), "public", "brand", "logo-dark-transparent.png"))
  .toString("base64")}`;

const INK = "#fafafa";
const MUTED = "#a1a1a1";
const LINE = "rgba(250,250,250,0.12)";

export interface OgCardProps {
  eyebrow: string;
  title: string;
  description: string;
  footer: string;
}

export function OgCard({ eyebrow, title, description, footer }: OgCardProps) {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        color: INK,
        fontFamily: "sans-serif",
        backgroundColor: "#0a0a0a",
        backgroundImage: "radial-gradient(900px 500px at 12% -10%, #232323 0%, rgba(35,35,35,0) 60%)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- rendered by next/og, not the browser */}
        <img src={LOGO} width={64} height={64} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <div style={{ display: "flex", fontSize: 36, fontWeight: 600, letterSpacing: -0.5 }}>
            {site.name}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: MUTED }}>{eyebrow}</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        <div style={{ display: "flex", fontSize: 64, fontWeight: 600, lineHeight: 1.08, letterSpacing: -1.5 }}>
          {title}
        </div>
        <div style={{ display: "flex", fontSize: 29, color: MUTED, lineHeight: 1.35 }}>{description}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", height: 1, backgroundColor: LINE, marginBottom: 26 }} />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div
            style={{
              display: "flex",
              fontSize: 25,
              color: INK,
              border: `1px solid ${LINE}`,
              borderRadius: 10,
              padding: "10px 18px",
            }}
          >
            {footer}
          </div>
          <div style={{ display: "flex", fontSize: 25, color: MUTED }}>better-vault.dev</div>
        </div>
      </div>
    </div>
  );
}
