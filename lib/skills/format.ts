import { stringify } from "yaml";
import { readFrontmatter } from "@/lib/notes/syntax";

/**
 * Skills are SKILL.md files: YAML frontmatter with `name` and
 * `description`, then the instructions. Claude Code, the Agent SDK and other
 * agents read the same format, so a skill moves between them unchanged.
 */
export interface SkillFile {
  name: string;
  description: string;
  body: string;
}

/** A skill's name as agents expect it: lowercase words joined by hyphens. */
export function skillSlug(name: string): string {
  return (
    name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "skill"
  );
}

export function parseSkillFile(text: string, fallbackName = "skill"): SkillFile {
  const { data, content } = readFrontmatter(text);
  const name = typeof data.name === "string" && data.name.trim() ? data.name.trim() : fallbackName;
  const description = typeof data.description === "string" ? data.description.trim() : "";
  return { name: skillSlug(name), description, body: content.replace(/^\s*\n/, "") };
}

export function toSkillFile(skill: SkillFile): string {
  const front = stringify({ name: skill.name, description: skill.description }).trimEnd();
  return `---\n${front}\n---\n\n${skill.body.trimStart()}`;
}
