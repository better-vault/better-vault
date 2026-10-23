import { z } from "zod";
import { passageRefSchema } from "@/lib/grounding/passage-schema";
import { defineTool, textBlob } from "@/studio/types";
import { scene } from "./scene";

export const anatomyDetails = ["simple", "standard", "detailed"] as const;

export const anatomyOptions = z.object({
  detail: z.enum(anatomyDetails),
});

export const anatomyData = z.object({
  scene,
  /** The passages the explanations may cite as [n]. */
  passages: z.array(passageRefSchema),
});

export type AnatomyOptions = z.infer<typeof anatomyOptions>;
export type AnatomyData = z.infer<typeof anatomyData>;

export const anatomyTool = defineTool({
  id: "anatomy",
  options: anatomyOptions,
  defaults: { detail: "standard" } satisfies AnatomyOptions,
  data: anatomyData,
  exports: [
    {
      format: "png",
      build: async (_title, data) => {
        const [{ figureSvg }, { svgToPng }] = await Promise.all([
          import("./geometry"),
          import("@/studio/exports/image"),
        ]);
        const figure = figureSvg(data.scene);
        return svgToPng(figure.svg, figure.width, figure.height, 3);
      },
    },
    {
      format: "svg",
      build: async (_title, data) => {
        const { figureSvg } = await import("./geometry");
        return textBlob(figureSvg(data.scene).svg, "image/svg+xml");
      },
    },
  ],
});
