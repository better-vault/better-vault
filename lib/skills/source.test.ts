import { describe, expect, it } from "vitest";
import { parseSkillSource, SkillSourceError } from "./source";

describe("parseSkillSource", () => {
  it.each([
    ["npx skills add vercel-labs/agent-skills", { owner: "vercel-labs", repo: "agent-skills" }],
    [
      "npx skills add vercel-labs/agent-skills --skill web-design-guidelines -a claude-code -g",
      { owner: "vercel-labs", repo: "agent-skills", skills: ["web-design-guidelines"] },
    ],
    [
      "$ npx -y skills@latest add owner/repo@v1.2.3 -s one two",
      { owner: "owner", repo: "repo", ref: "v1.2.3", skills: ["one", "two"] },
    ],
    ["skills add owner/repo --skill '*'", { owner: "owner", repo: "repo" }],
    [
      "npx skills use vercel-labs/agent-skills@web-design-guidelines --agent claude-code",
      { owner: "vercel-labs", repo: "agent-skills", skills: ["web-design-guidelines"] },
    ],
    ["owner/repo", { owner: "owner", repo: "repo" }],
    ["https://github.com/vercel-labs/agent-skills", { owner: "vercel-labs", repo: "agent-skills" }],
    [
      "https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines",
      {
        owner: "vercel-labs",
        repo: "agent-skills",
        ref: "main",
        path: "skills/web-design-guidelines",
      },
    ],
    [
      "github.com/o/r/blob/dev/skills/x/SKILL.md",
      { owner: "o", repo: "r", ref: "dev", path: "skills/x/SKILL.md" },
    ],
    ["git@github.com:o/r.git", { owner: "o", repo: "r" }],
    [
      "https://skills.sh/vercel-labs/skills/find-skills",
      { owner: "vercel-labs", repo: "skills", skills: ["find-skills"] },
    ],
    ["https://www.skills.sh/vercel-labs/skills", { owner: "vercel-labs", repo: "skills" }],
  ])("reads %s", (input, expected) => {
    expect(parseSkillSource(input)).toEqual(expected);
  });

  it("explains what it can't read", () => {
    expect(() => parseSkillSource("  ")).toThrow(SkillSourceError);
    expect(() => parseSkillSource("npx skills add https://gitlab.com/org/repo")).toThrow(
      /Only skills on GitHub/,
    );
    expect(() => parseSkillSource("npx skills add")).toThrow(/which repository/);
    expect(() => parseSkillSource("https://github.com/only-owner")).toThrow(SkillSourceError);
  });
});
