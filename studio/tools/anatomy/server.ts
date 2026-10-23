import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { toPassageRefs } from "@/lib/grounding/passages";
import { clean, studioSystem, type Generator } from "@/studio/server/shared";
import type { AnatomyData, AnatomyOptions } from "./definition";
import { springScale } from "./example";
import { geometry, partRoles, type Scene } from "./scene";
import { sceneProblems, tidyScene } from "./validate";

const PARTS: Record<AnatomyOptions["detail"], string> = {
  simple: "20 to 35",
  standard: "35 to 60",
  detailed: "60 to 90",
};

const REPAIRS = 2;

// The model-facing schemas have no length limits: strict structured outputs reject some of them.
const xyz = z.object({ x: z.number(), y: z.number(), z: z.number() });

const planSchema = z.object({
  title: z.string().describe("The object's name, short"),
  object: z
    .string()
    .describe(
      "One or two sentences: what the object is, what moves, and what that motion means for the idea",
    ),
  caption: z
    .string()
    .describe(
      "Two or three sentences shown under the figure that tie the object to the idea, citing passages like [2]",
    ),
  assemblies: z
    .array(z.object({ id: z.string().describe("Short kebab-case id"), name: z.string() }))
    .describe("3 to 7 groups of parts that come apart together"),
  parts: z.array(
    z.object({
      id: z.string().describe("Short kebab-case id, unique"),
      name: z.string().describe("The part's name, as a technician would say it"),
      role: z.enum(partRoles),
      assembly: z.string().describe("The id of the part's assembly"),
      explanation: z
        .string()
        .describe(
          "What the part is and does in the object, and what it stands for in the sources' idea; one or two sentences citing passages like [2]",
        ),
    }),
  ),
  steps: z.array(
    z.object({
      title: z.string(),
      explanation: z
        .string()
        .describe("What happens in this step and why, citing passages like [2]"),
      readout: z
        .string()
        .describe("A short live reading, as an instrument on the object would show it"),
      focus: z.array(z.string()).describe("Ids of the parts to watch in this step"),
      motion: z
        .string()
        .describe("What moves in this step and how far, in words; empty when nothing moves"),
    }),
  ),
});

const buildSchema = z.object({
  camera: z.object({
    azimuth: z.number().describe("Degrees, 35 to 55; 45 shows both sides equally"),
    elevation: z
      .number()
      .describe("Degrees above the floor, 25 to 40; higher looks into open things"),
  }),
  assemblies: z.array(z.object({ id: z.string(), explode: xyz })),
  parts: z.array(z.object({ id: z.string(), geometry })),
  steps: z.array(
    z.object({
      moves: z.array(
        z.object({ target: z.string(), offset: xyz, turn: z.number(), stretch: z.number() }),
      ),
    }),
  ),
});

type Plan = z.infer<typeof planSchema>;
type Build = z.infer<typeof buildSchema>;

function designTask(parts: string) {
  return `Explain the most important idea in the sources as an Anatomy figure: an interactive isometric drawing of a real, well-made physical object whose working IS the idea. The reader understands the idea because they recognise the machine.

- If the sources are about a physical thing or mechanism (an engine, a lock, a heart, a cell, a printer), draw that thing itself, built the way it really is.
- If the idea is abstract (a process, an algorithm, a system, a theory, a business idea), invent a machine, instrument or piece of furniture whose mechanism maps one-to-one onto it. For example:
  - a cache that skips work when nothing changed → a pin-tumbler lock: when every pin matches, the plug turns;
  - seven buffers of different sizes → a chest of seven drawers, each as deep as its size;
  - testing ideas against three criteria → a sorting machine with three sieves of finer and finer mesh;
  - a budget split between needs → a balance with weights on calibrated arms.
- Not boxes, arrows and labels, and not one big slab: a recognisable object built from many small, precise, purposeful parts, the way the real thing is built: base plate, feet, frame, rails, posts, carriage, bushings, springs, knobs, screws, dials, label plates, and the parts that hold the parts.
- About ${parts} parts, grouped into 3 to 7 assemblies. Give one to three parts the role "subject": the parts the reader should watch. Use "base" for what everything stands on, "structure" for frames and housings, "mechanism" for what moves, "control" for knobs, handles and switches.
- Each part's explanation says what the part is and does, and what it stands for in the sources' idea, in one or two sentences with citations. Small hardware such as screws and feet can have one short sentence without citations.
- 3 to 6 steps walk through how the object works, the first one at rest. Each step has a title, an explanation with citations, a short readout like an instrument would show (for example "block 2 · reads 14.0" or "pins aligned · 5 of 5"), the ids of the parts to watch, and the motion in words: which parts move, which way and how far, which turn and by how many degrees, which stretch.
- No audio, video or text inside the object apart from what the readout shows.`;
}

const BUILD_SYSTEM = `You build the geometry of an Anatomy figure: an isometric drawing of a real, well-made object, from the list of its parts. Answer only with the geometry.

World: x and y lie on the floor and z points up; the floor is z = 0. One unit is about one pixel of the object at figure size, and the whole object should span about 150 to 400 units. The camera looks from the +x, +y side and from above: parts with larger x and y are nearer the viewer.

Shapes ("geometry.kind"):
- box: a block with rounded corners. x, y = the corner of its plan with the smallest x and y; z = its bottom; w along x, d along y, h up; corner = radius of the plan's corners (0 sharp, 1 to 3 for machined parts).
- cylinder: an upright round part (post, knob, dial, foot, bushing, wheel lying flat). x, y = centre; z = bottom; radius; h = height.
- rod: a round bar lying along x or y (axle, shaft, roller, pipe). x, y, z = the centre of the end with the smaller x or y; length; radius.
- spring: a coil along x, y or z. x, y, z = the centre of its start end (its bottom when along z); length; radius; turns (3 to 12).
- ball: a sphere. x, y, z = centre; radius.
- needle: a pointer lying on a face (gauge needle, clock hand, indicator). x, y = its pivot; z = the height of the face; length; angle in degrees: 0 points to -y, 90 to +x, clockwise seen from above.
- cable: a wire, cord or hose through 2 to 6 points; both ends on parts.

"details" are small features the renderer draws on a box, cylinder or rod; pick the ones the real part has, often none:
- groove: an inset line around a box's top, or a ring on a cylinder's top.
- screws: screws in the corners of a box's top, or a bolt circle on a cylinder's top.
- ruler: ticks along the front edge of a box's top, or a dial scale around a cylinder's top.
- knurl: grip lines around a cylinder's side (knobs, thumb screws), or rings along a rod.
- label: a small label plate with rule lines on a box's top.
- vents: a row of slots in a box's top.
- seam: a seam around the sides.
- grid: a grid of dots on a box's top (holes, keys, lights).

Rules:
1. Build it the way the real object is built. Every part sits on, hangs from or is fixed to another part, and faces meet exactly: a part on top of another has its z equal to the other's z + h. Nothing floats, and nothing passes through anything, except a slender rod, post or spring through a bushing, sleeve or hole made for it. Build hollow things (cases, cabinets, frames) from panels, so what is inside them stays visible.
2. Proportions are true to the real object. Small parts are small: screws and pins 1 to 3, knobs 4 to 8, posts 2 to 5 in radius.
3. Lay it out so the mechanism and the subject face the viewer (larger x and y) and tall parts stand at the back.
4. Explode: give each assembly an offset that lifts or slides it clear of its neighbours when the figure is taken apart, usually up along z by 15 to 60, or out sideways. The base assembly stays at 0, 0, 0.
5. Steps: give each step, in order, the "moves" its motion describes, as offsets from where the parts are drawn (not from the previous step): "target" is a part id or an assembly id; "offset" in units; "turn" in degrees around the part's own vertical axis (needles turn around their pivot); "stretch" makes a spring or rod longer (or shorter, below 0) along its axis, and a box or cylinder taller. A step at rest has no moves. A spring whose bottom end moves down by 8 gets offset z -8 and stretch 8, so its top stays put.
6. Use exactly the part and assembly ids you are given, and give every part its geometry.

An example of the format (a small spring scale):
${JSON.stringify(exampleBuild(springScale))}`;

/** A scene in the build step's format. */
function exampleBuild(scene: Scene): Build {
  return {
    camera: scene.camera,
    assemblies: scene.assemblies.map(({ id, explode }) => ({ id, explode })),
    parts: scene.parts.map(({ id, geometry }) => ({ id, geometry })),
    steps: scene.steps.map(({ moves }) => ({ moves })),
  };
}

/** The design and the geometry, as one scene. Parts without geometry are left out. */
export function mergeScene(plan: Plan, build: Build): Scene {
  const shapes = new Map(build.parts.map((part) => [part.id, part.geometry]));
  const explode = new Map(build.assemblies.map((assembly) => [assembly.id, assembly.explode]));
  return {
    title: clean(plan.title) || "Anatomy",
    object: clean(plan.object),
    caption: clean(plan.caption),
    camera: build.camera,
    assemblies: plan.assemblies.map((assembly) => ({
      id: assembly.id,
      name: clean(assembly.name),
      explode: explode.get(assembly.id) ?? { x: 0, y: 0, z: 0 },
    })),
    parts: plan.parts.flatMap((part) => {
      const shape = shapes.get(part.id);
      return shape
        ? [
            {
              id: part.id,
              name: clean(part.name),
              role: part.role,
              assembly: part.assembly,
              explanation: part.explanation.trim(),
              geometry: shape,
            },
          ]
        : [];
    }),
    steps: plan.steps.map((step, index) => ({
      title: clean(step.title),
      explanation: step.explanation.trim(),
      readout: clean(step.readout),
      focus: step.focus,
      moves: build.steps[index]?.moves ?? [],
    })),
  };
}

function missingParts(plan: Plan, build: Build): string[] {
  const built = new Set(build.parts.map((part) => part.id));
  const missing = plan.parts.filter((part) => !built.has(part.id)).map((part) => part.id);
  return missing.length
    ? [
        `These parts have no geometry: ${missing.slice(0, 20).join(", ")}${missing.length > 20 ? ", …" : ""}.`,
      ]
    : [];
}

/** What the build step gets: the design without the sources. */
function designFor(plan: Plan): string {
  return JSON.stringify({
    object: plan.object,
    assemblies: plan.assemblies,
    parts: plan.parts.map(({ id, name, role, assembly, explanation }) => ({
      id,
      name,
      role,
      assembly,
      explanation,
    })),
    steps: plan.steps.map(({ title, motion, focus }) => ({ title, motion, focus })),
  });
}

async function build(
  model: LanguageModel,
  prompt: string,
  abortSignal?: AbortSignal,
): Promise<Build> {
  const { output } = await generateText({
    model,
    output: Output.object({ schema: buildSchema }),
    system: BUILD_SYSTEM,
    prompt,
    abortSignal,
  });
  return output;
}

export const generateAnatomy: Generator<AnatomyOptions, AnatomyData> = async ({
  model,
  options,
  abortSignal,
  ...args
}) => {
  const { output: plan } = await generateText({
    model,
    output: Output.object({ schema: planSchema }),
    system: studioSystem(designTask(PARTS[options.detail]), args),
    prompt: "Design the figure now.",
    abortSignal,
  });
  if (plan.parts.length === 0) throw new Error("The model designed no parts.");

  const design = designFor(plan);
  let geometry = await build(
    model,
    `The figure to build:\n${design}\n\nBuild its geometry now.`,
    abortSignal,
  );
  let scene = tidyScene(mergeScene(plan, geometry));
  let problems = [...missingParts(plan, geometry), ...sceneProblems(scene)];
  let best = { scene, problems };

  for (let attempt = 0; attempt < REPAIRS && problems.length > 0; attempt++) {
    geometry = await build(
      model,
      `The figure to build:\n${design}\n\nYour geometry so far:\n${JSON.stringify(geometry)}\n\nFix these problems and return the whole corrected geometry:\n- ${problems.join("\n- ")}`,
      abortSignal,
    );
    scene = tidyScene(mergeScene(plan, geometry));
    problems = [...missingParts(plan, geometry), ...sceneProblems(scene)];
    if (
      problems.length <= best.problems.length &&
      scene.parts.length >= best.scene.parts.length * 0.8
    )
      best = { scene, problems };
  }

  if (best.scene.parts.length === 0)
    throw new Error("The model's figure had no parts that could be drawn.");
  return {
    title: best.scene.title,
    data: { scene: best.scene, passages: toPassageRefs(args.passages) },
  };
};
