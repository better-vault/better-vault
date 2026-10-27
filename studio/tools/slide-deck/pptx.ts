import type PptxGenJS from "pptxgenjs";
import { citedNumbers, stripCitations } from "@/lib/grounding/passages";
import { isRightToLeft } from "@/lib/text/direction";
import type { ExportText } from "@/studio/types";
import type { Slide, SlideDeckData } from "./definition";

/** The deck's colours as hex without "#", resolved from the light theme. */
export interface DeckPalette {
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  primary: string;
  primaryForeground: string;
  border: string;
  info: string;
  accents: string[];
}

const W = 13.333;
const H = 7.5;
const X = 0.85;
const INNER = W - 2 * X;
const FONT = "Calibri";
const MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

const plain = (text: string) => stripCitations(text).replace(/\s+/g, " ").trim();

/**
 * The deck as a PowerPoint file: native, editable slides that follow the same
 * layouts, speaker notes, and a closing list of the sources cited.
 * Citations are left out of the slides; the Sources slide lists them.
 */
export async function buildPptx(
  title: string,
  deck: SlideDeckData,
  palette: DeckPalette,
  text: ExportText,
): Promise<Blob> {
  const { default: Pptx } = await import("pptxgenjs");
  const pptx = new Pptx();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = title;
  const everything = deck.slides
    .flatMap((slide) => [slide.title, ...slide.bullets, slide.notes])
    .join(" ");
  pptx.rtlMode = isRightToLeft(everything);
  const body = deck.format === "detailed" ? 16 : 22;

  deck.slides.forEach((slide, index) => {
    const inverted = slide.layout === "title" || slide.layout === "closing";
    const s = pptx.addSlide();
    s.background = {
      color: inverted
        ? palette.primary
        : slide.layout === "section"
          ? palette.muted
          : palette.background,
    };
    const ink = inverted ? palette.primaryForeground : palette.foreground;
    const quiet = inverted ? palette.primaryForeground : palette.mutedForeground;

    footer(s, title, index, deck.slides.length, quiet);
    if (slide.notes.trim()) s.addNotes(plain(slide.notes));

    switch (slide.layout) {
      case "title":
        s.addShape("rect", {
          x: X,
          y: 4.05,
          w: 1.1,
          h: 0.07,
          fill: { color: palette.info },
          line: { color: palette.info },
        });
        s.addText(slide.title, {
          x: X,
          y: 4.25,
          w: INNER,
          h: 1.5,
          fontFace: FONT,
          fontSize: 40,
          bold: true,
          color: ink,
          valign: "top",
          fit: "shrink",
        });
        if (slide.subtitle)
          s.addText(slide.subtitle, {
            x: X,
            y: 5.8,
            w: INNER * 0.75,
            h: 0.7,
            fontFace: FONT,
            fontSize: 18,
            color: quiet,
            valign: "top",
          });
        return;
      case "section":
        s.addText(String(index + 1).padStart(2, "0"), {
          x: X,
          y: 2.6,
          w: 2,
          h: 0.4,
          fontFace: "Consolas",
          fontSize: 14,
          color: palette.mutedForeground,
        });
        s.addText(slide.title, {
          x: X,
          y: 3.0,
          w: INNER,
          h: 1.3,
          fontFace: FONT,
          fontSize: 34,
          bold: true,
          color: palette.foreground,
          valign: "top",
          fit: "shrink",
        });
        if (slide.subtitle)
          s.addText(slide.subtitle, {
            x: X,
            y: 4.35,
            w: INNER,
            h: 0.6,
            fontFace: FONT,
            fontSize: 16,
            color: palette.mutedForeground,
          });
        return;
    }

    if (slide.layout !== "quote") {
      s.addText(slide.title, {
        x: X,
        y: 0.55,
        w: INNER,
        h: 0.9,
        fontFace: FONT,
        fontSize: 28,
        bold: true,
        color: ink,
        valign: "top",
        fit: "shrink",
      });
    }
    const top = 1.65;
    const height = H - top - 1.0;

    switch (slide.layout) {
      case "bullets":
      case "closing":
        bullets(s, slide.bullets, { x: X, y: top, w: INNER, h: height }, body, ink);
        return;
      case "two-column":
      case "comparison": {
        const gap = 0.45;
        const w = (INNER - gap) / 2;
        slide.columns.forEach((column, at) => {
          const x = X + at * (w + gap);
          if (slide.layout === "comparison") {
            s.addShape("roundRect", {
              x,
              y: top,
              w,
              h: height,
              rectRadius: 0.12,
              fill: { color: palette.muted },
              line: { color: palette.muted },
            });
          }
          const pad = slide.layout === "comparison" ? 0.3 : 0;
          s.addText(column.heading, {
            x: x + pad,
            y: top + pad,
            w: w - 2 * pad,
            h: 0.55,
            fontFace: FONT,
            fontSize: 20,
            bold: true,
            color:
              slide.layout === "comparison" ? palette.accents[at % palette.accents.length] : ink,
          });
          bullets(
            s,
            column.bullets,
            { x: x + pad, y: top + pad + 0.65, w: w - 2 * pad, h: height - 2 * pad - 0.65 },
            body - 2,
            ink,
          );
        });
        return;
      }
      case "stats": {
        const gap = 0.35;
        const w = (INNER - gap * (slide.stats.length - 1)) / slide.stats.length;
        slide.stats.forEach((stat, at) => {
          const x = X + at * (w + gap);
          const y = top + 0.4;
          s.addShape("roundRect", {
            x,
            y,
            w,
            h: 3.3,
            rectRadius: 0.12,
            fill: { color: palette.muted },
            line: { color: palette.muted },
          });
          s.addText(stat.value, {
            x: x + 0.3,
            y: y + 0.35,
            w: w - 0.6,
            h: 1.1,
            fontFace: FONT,
            fontSize: 40,
            bold: true,
            color: palette.accents[at % palette.accents.length],
            fit: "shrink",
          });
          s.addText(plain(stat.label), {
            x: x + 0.3,
            y: y + 1.55,
            w: w - 0.6,
            h: 0.8,
            fontFace: FONT,
            fontSize: 15,
            bold: true,
            color: palette.foreground,
            valign: "top",
          });
          if (stat.detail)
            s.addText(plain(stat.detail), {
              x: x + 0.3,
              y: y + 2.35,
              w: w - 0.6,
              h: 0.8,
              fontFace: FONT,
              fontSize: 11,
              color: palette.mutedForeground,
              valign: "top",
            });
        });
        return;
      }
      case "quote":
        if (!slide.quote) return;
        s.addText("“", {
          x: X,
          y: 1.0,
          w: 1.2,
          h: 1.2,
          fontFace: "Georgia",
          fontSize: 96,
          color: palette.info,
        });
        s.addText(plain(slide.quote.text), {
          x: X,
          y: 2.1,
          w: INNER * 0.85,
          h: 2.8,
          fontFace: FONT,
          fontSize: 28,
          bold: true,
          color: palette.foreground,
          valign: "top",
          fit: "shrink",
        });
        if (slide.quote.attribution)
          s.addText(`— ${slide.quote.attribution}`, {
            x: X,
            y: 5.1,
            w: INNER,
            h: 0.5,
            fontFace: FONT,
            fontSize: 16,
            color: palette.mutedForeground,
          });
        return;
      case "timeline": {
        const count = slide.timeline.length;
        const w = INNER / count;
        const line = top + 1.1;
        s.addShape("line", {
          x: X,
          y: line,
          w: INNER,
          h: 0,
          line: { color: palette.border, width: 1.5 },
        });
        slide.timeline.forEach((event, at) => {
          const x = X + at * w;
          const accent = palette.accents[at % palette.accents.length];
          s.addShape("ellipse", {
            x,
            y: line - 0.11,
            w: 0.22,
            h: 0.22,
            fill: { color: accent },
            line: { color: palette.background, width: 2 },
          });
          s.addText(event.when, {
            x,
            y: line + 0.3,
            w: w - 0.2,
            h: 0.4,
            fontFace: "Consolas",
            fontSize: 11,
            color: palette.mutedForeground,
          });
          s.addText(event.title, {
            x,
            y: line + 0.7,
            w: w - 0.2,
            h: 0.7,
            fontFace: FONT,
            fontSize: 15,
            bold: true,
            color: palette.foreground,
            valign: "top",
          });
          if (event.detail)
            s.addText(plain(event.detail), {
              x,
              y: line + 1.45,
              w: w - 0.2,
              h: 1.6,
              fontFace: FONT,
              fontSize: 11,
              color: palette.mutedForeground,
              valign: "top",
            });
        });
        return;
      }
    }
  });

  // The sources cited anywhere in the deck.
  const cited = new Set(citedNumbers(deck.slides.map(allText).join(" ")));
  const titles = [
    ...new Set(
      deck.passages.filter((passage) => cited.has(passage.n)).map((passage) => passage.title),
    ),
  ];
  if (titles.length > 0) {
    const s = pptx.addSlide();
    s.background = { color: palette.background };
    s.addText(text.sources, {
      x: X,
      y: 0.55,
      w: INNER,
      h: 0.9,
      fontFace: FONT,
      fontSize: 28,
      bold: true,
      color: palette.foreground,
    });
    bullets(s, titles, { x: X, y: 1.65, w: INNER, h: H - 2.65 }, 16, palette.foreground);
  }

  const buffer = (await pptx.write({ outputType: "arraybuffer" })) as ArrayBuffer;
  return new Blob([buffer], { type: MIME });
}

function allText(slide: Slide): string {
  return [
    slide.title,
    ...slide.bullets,
    ...slide.columns.flatMap((column) => column.bullets),
    ...slide.stats.flatMap((stat) => [stat.label, stat.detail]),
    slide.quote?.text ?? "",
    ...slide.timeline.map((event) => event.detail),
    slide.notes,
  ].join(" ");
}

function bullets(
  s: PptxGenJS.Slide,
  items: readonly string[],
  box: { x: number; y: number; w: number; h: number },
  fontSize: number,
  color: string,
) {
  if (items.length === 0) return;
  s.addText(
    items.map((item) => ({
      text: plain(item),
      options: { bullet: { indent: 18 }, paraSpaceAfter: 10, breakLine: true },
    })),
    { ...box, fontFace: FONT, fontSize, color, valign: "top", fit: "shrink" },
  );
}

function footer(s: PptxGenJS.Slide, title: string, index: number, total: number, color: string) {
  s.addText(title, {
    x: X,
    y: H - 0.6,
    w: INNER - 1.2,
    h: 0.3,
    fontFace: FONT,
    fontSize: 9,
    color,
  });
  s.addText(`${index + 1} / ${total}`, {
    x: W - X - 1.2,
    y: H - 0.6,
    w: 1.2,
    h: 0.3,
    fontFace: "Consolas",
    fontSize: 9,
    color,
    align: "right",
  });
}
