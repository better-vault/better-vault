import { boundsOf, isLine, isSlender, type Bounds } from "./geometry";
import type { Geometry, Part, Scene } from "./scene";

/** How close two parts must be to count as touching, in world units. */
const TOUCH = 0.75;
/** Gaps this small are closed without asking the model. */
const SNAP = 2.5;

const MIN_SIZE = 0.4;

function touching(a: Bounds, b: Bounds, tolerance = TOUCH): boolean {
  for (let axis = 0; axis < 3; axis++) {
    if (a.min[axis] > b.max[axis] + tolerance || b.min[axis] > a.max[axis] + tolerance)
      return false;
  }
  return true;
}

function footprintsMeet(a: Bounds, b: Bounds): boolean {
  for (let axis = 0; axis < 2; axis++) {
    if (a.min[axis] >= b.max[axis] - 0.05 || b.min[axis] >= a.max[axis] - 0.05) return false;
  }
  return true;
}

const sizeOf = ({ min, max }: Bounds) => [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
const volumeOf = (bounds: Bounds) =>
  sizeOf(bounds).reduce((product, side) => product * Math.max(side, 0), 1);

function sharedVolume(a: Bounds, b: Bounds): number {
  let volume = 1;
  for (let axis = 0; axis < 3; axis++) {
    volume *= Math.max(0, Math.min(a.max[axis], b.max[axis]) - Math.max(a.min[axis], b.min[axis]));
  }
  return volume;
}

const round = (value: number) => Math.round(value * 10) / 10;

function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "part"
  );
}

function sized(g: Geometry): Geometry {
  const positive = (value: number) =>
    Number.isFinite(value) ? Math.max(MIN_SIZE, Math.abs(value)) : 1;
  switch (g.kind) {
    case "box":
      return {
        ...g,
        w: positive(g.w),
        d: positive(g.d),
        h: positive(g.h),
        corner: Math.max(0, g.corner || 0),
      };
    case "cylinder":
      return { ...g, radius: positive(g.radius), h: positive(g.h) };
    case "rod":
      return { ...g, radius: positive(g.radius), length: positive(g.length) };
    case "spring":
      return {
        ...g,
        radius: positive(g.radius),
        length: positive(g.length),
        turns: Math.min(30, Math.max(1, g.turns || 6)),
      };
    case "ball":
      return { ...g, radius: positive(g.radius) };
    case "needle":
      return { ...g, length: positive(g.length), angle: Number.isFinite(g.angle) ? g.angle : 0 };
    case "cable":
      return { ...g, points: g.points.slice(0, 8) };
  }
}

/** Moves a part up or down by `dz`. */
function lift(g: Geometry, dz: number): Geometry {
  if (g.kind === "cable")
    return { ...g, points: g.points.map((point) => ({ ...point, z: point.z + dz })) };
  return { ...g, z: g.z + dz };
}

/**
 * Fixes what can be fixed without the model: unique ids, known references,
 * positive sizes, a step to show, and small gaps under parts.
 */
export function tidyScene(input: Scene): Scene {
  const scene: Scene = structuredClone(input);
  scene.parts = scene.parts.filter(
    (part) => part.geometry.kind !== "cable" || part.geometry.points.length >= 2,
  );

  // Ids become short slugs; steps follow the renamed parts.
  const seen = new Set<string>();
  const renamed = new Map<string, string>();
  for (const part of scene.parts) {
    const base = slug(part.id || part.name);
    let id = base;
    for (let n = 2; seen.has(id); n++) id = `${base}-${n}`;
    seen.add(id);
    if (!renamed.has(part.id)) renamed.set(part.id, id);
    part.id = id;
    part.geometry = sized(part.geometry);
  }
  for (const step of scene.steps) {
    step.focus = step.focus.map((id) => renamed.get(id) ?? id);
    step.moves = step.moves.map((move) => ({
      ...move,
      target: renamed.get(move.target) ?? move.target,
    }));
  }

  const assemblies = new Set(scene.assemblies.map((assembly) => assembly.id));
  for (const part of scene.parts) {
    if (assemblies.has(part.assembly)) continue;
    if (!assemblies.has("main")) {
      scene.assemblies.push({ id: "main", name: scene.title, explode: { x: 0, y: 0, z: 0 } });
      assemblies.add("main");
    }
    part.assembly = "main";
  }

  const parts = new Set(scene.parts.map((part) => part.id));
  for (const step of scene.steps) {
    step.focus = step.focus.filter((id) => parts.has(id));
    step.moves = step.moves.filter((move) => parts.has(move.target) || assemblies.has(move.target));
  }
  if (scene.steps.length === 0) {
    scene.steps.push({
      title: scene.title,
      explanation: scene.object,
      readout: "",
      focus: scene.parts.filter((part) => part.role === "subject").map((part) => part.id),
      moves: [],
    });
  }

  // Close small gaps: a part a hair above the part under it comes down onto it.
  const ground = Math.min(...scene.parts.map((part) => boundsOf(part.geometry).min[2]));
  const order = scene.parts
    .map((part, index) => ({ part, index }))
    .filter(({ part }) => part.geometry.kind !== "cable")
    .sort((a, b) => boundsOf(a.part.geometry).min[2] - boundsOf(b.part.geometry).min[2]);
  for (const { part } of order) {
    const bounds = boundsOf(part.geometry);
    const bottom = bounds.min[2];
    if (bottom <= ground + 0.01) continue;
    const others = scene.parts
      .filter((other) => other !== part)
      .map((other) => boundsOf(other.geometry));
    if (others.some((other) => touching(bounds, other, 0.05))) continue;
    let support = -Infinity;
    for (const other of others) {
      if (!footprintsMeet(bounds, other)) continue;
      const top = other.max[2];
      if (top <= bottom + 0.01 && bottom - top <= SNAP) support = Math.max(support, top);
    }
    if (support > -Infinity) part.geometry = lift(part.geometry, support - bottom);
  }

  return scene;
}

const nameOf = (part: Part) => `"${part.name || part.id}" (${part.id})`;

/**
 * What the model should fix in the geometry: groups of parts that touch
 * nothing on the ground, solids inside each other, and a wrong overall size.
 * Short sentences, written to be sent back to the model.
 */
export function sceneProblems(scene: Scene, limit = 10): string[] {
  const problems: string[] = [];
  const parts = scene.parts;
  const bounds = parts.map((part) => boundsOf(part.geometry));
  const ground = Math.min(...bounds.map((box) => box.min[2]));

  // Groups of touching parts; every group must reach the ground.
  const parent = parts.map((_, index) => index);
  const find = (index: number): number =>
    parent[index] === index ? index : (parent[index] = find(parent[index]));
  for (let a = 0; a < parts.length; a++) {
    for (let b = a + 1; b < parts.length; b++) {
      const tolerance =
        parts[a].geometry.kind === "cable" || parts[b].geometry.kind === "cable" ? 1.5 : TOUCH;
      if (touching(bounds[a], bounds[b], tolerance)) parent[find(a)] = find(b);
    }
  }
  const groups = new Map<number, number[]>();
  parts.forEach((_, index) => groups.set(find(index), [...(groups.get(find(index)) ?? []), index]));
  for (const members of groups.values()) {
    if (members.some((index) => bounds[index].min[2] <= ground + TOUCH)) continue;
    const lowest = Math.min(...members.map((index) => bounds[index].min[2]));
    if (members.length === 1) {
      problems.push(
        `${nameOf(parts[members[0]])} touches no other part: it floats with its bottom at z ${round(lowest)}. Rest it on, hang it from or fix it to the part that holds it, face to face.`,
      );
    } else {
      const names = members.slice(0, 6).map((index) => nameOf(parts[index]));
      problems.push(
        `These parts touch each other but nothing that reaches the ground, so they float (lowest bottom at z ${round(lowest)}): ${names.join(", ")}${members.length > 6 ? ", …" : ""}. Connect them to the part that holds them.`,
      );
    }
  }

  // Solids inside each other.
  for (let a = 0; a < parts.length; a++) {
    if (isSlender(parts[a].geometry) || isLine(parts[a].geometry)) continue;
    for (let b = a + 1; b < parts.length; b++) {
      if (isSlender(parts[b].geometry) || isLine(parts[b].geometry)) continue;
      const shared = sharedVolume(bounds[a], bounds[b]);
      const smaller = Math.min(volumeOf(bounds[a]), volumeOf(bounds[b]));
      if (smaller < 8 || shared <= smaller * 0.35) continue;
      problems.push(
        `${nameOf(parts[a])} and ${nameOf(parts[b])} fill the same space. Move one so they meet face to face, or build the outer one from panels around the inner one.`,
      );
    }
  }

  const all = {
    min: [0, 1, 2].map((axis) => Math.min(...bounds.map((box) => box.min[axis]))),
    max: [0, 1, 2].map((axis) => Math.max(...bounds.map((box) => box.max[axis]))),
  };
  const span = Math.max(all.max[0] - all.min[0], all.max[1] - all.min[1], all.max[2] - all.min[2]);
  if (span > 900 || span < 40) {
    problems.push(
      `The object spans ${round(span)} units; scale every part so it spans about 150 to 400.`,
    );
  }

  return problems.slice(0, limit);
}
