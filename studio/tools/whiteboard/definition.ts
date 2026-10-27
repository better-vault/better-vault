import { z } from "zod";
import { defineTool, textBlob } from "@/studio/types";
import { boardData, emptyBoard, type BoardData } from "./schema";

async function svgFile(data: BoardData) {
  const [{ boardSvg }, { exportFonts, resolveBoardPalette }] = await Promise.all([
    import("./export"),
    import("./export-browser"),
  ]);
  const palette = resolveBoardPalette();
  return { ...boardSvg(data, palette, await exportFonts(data)), background: palette.background };
}

/** The whiteboard: drawn by hand in the browser, with no model and no sources. */
export const whiteboardTool = defineTool({
  id: "whiteboard",
  options: z.object({}),
  defaults: {},
  data: boardData,
  local: { blank: emptyBoard },
  exports: [
    {
      format: "png",
      build: async (_title, data) => {
        const [{ svg, width, height, background }, { svgToPng }] = await Promise.all([
          svgFile(data),
          import("@/studio/exports/image"),
        ]);
        return svgToPng(svg, width, height, 2, background);
      },
    },
    {
      format: "svg",
      build: async (_title, data) => textBlob((await svgFile(data)).svg, "image/svg+xml"),
    },
    {
      format: "json",
      // Palette names, not colours: a board file keeps following the theme.
      build: async (_title, data) =>
        textBlob(JSON.stringify({ ...data, saveId: "" }, null, 2), "application/json"),
    },
  ],
});
