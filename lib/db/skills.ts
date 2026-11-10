import { generateId } from "ai";
import { skillSlug, type SkillFile } from "@/lib/skills/format";
import { useStoreQuery } from "./live";
import { store } from "./store";
import type { Skill } from "./types";

/** Every skill of every vault, by name. */
export async function listSkills(): Promise<Skill[]> {
  return (await store().listSkills()).sort((a, b) => a.name.localeCompare(b.name));
}

export function useSkills(): Skill[] | undefined {
  return useStoreQuery(listSkills, [], ["skills"]);
}

/** A name no other skill in the vault has: `name`, then `name-2`, … */
export function freeSkillName(wanted: string, vaultId: string, skills: Skill[], except?: string) {
  const base = skillSlug(wanted);
  const taken = (name: string) =>
    skills.some((skill) => skill.id !== except && skill.vaultId === vaultId && skill.name === name);
  if (!taken(base)) return base;
  for (let n = 2; ; n++) if (!taken(`${base}-${n}`)) return `${base}-${n}`;
}

export async function createSkill(
  vaultId: string,
  file: SkillFile,
  updatedBy = "you",
): Promise<Skill> {
  const skills = await store().listSkills();
  const now = Date.now();
  const skill: Skill = {
    id: generateId(),
    vaultId,
    name: freeSkillName(file.name, vaultId, skills),
    description: file.description,
    body: file.body,
    updatedBy,
    createdAt: now,
    updatedAt: now,
  };
  await store().putSkill(skill);
  return skill;
}

/** Saves a skill's name, description and instructions. Returns the name it got. */
export async function saveSkill(
  id: string,
  file: Partial<SkillFile>,
  updatedBy = "you",
): Promise<string | null> {
  const skill = await store().getSkill(id);
  if (!skill) return null;
  const name =
    file.name !== undefined
      ? freeSkillName(file.name, skill.vaultId, await store().listSkills(), id)
      : skill.name;
  await store().putSkill({
    ...skill,
    ...file,
    name,
    updatedBy,
    updatedAt: Date.now(),
  });
  return name;
}

export async function deleteSkill(id: string): Promise<void> {
  await store().deleteSkill(id);
}
