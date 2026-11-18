import { afterEach, describe, expect, it, vi } from "vitest";
import { isDiscoverable, POST } from "./skills-fetch";

const skill = (name: string, description = `About ${name}`) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n# ${name}\n\nDo the thing.\n`;

/** A fake GitHub: one repository with skills in the places the skills CLI looks, and some it doesn't. */
function fakeGithub(files: Record<string, string>, { limited = false } = {}) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    if (limited)
      return new Response("{}", { status: 403, headers: { "x-ratelimit-remaining": "0" } });
    if (url === "https://api.github.com/repos/acme/skills")
      return Response.json({ default_branch: "main" });
    if (url === "https://api.github.com/repos/acme/skills/git/trees/main?recursive=1")
      return Response.json({
        tree: Object.keys(files).map((path) => ({ path, type: "blob" })),
      });
    const raw = "https://raw.githubusercontent.com/acme/skills/main/";
    if (url.startsWith(raw)) {
      const path = decodeURIComponent(url.slice(raw.length));
      if (path in files) return new Response(files[path]);
    }
    return new Response("not found", { status: 404 });
  });
  return calls;
}

const ask = (source: string, names?: string[]) =>
  POST(
    new Request("http://local/api/skills/fetch", {
      method: "POST",
      body: JSON.stringify({ source, names }),
    }),
  );

afterEach(() => vi.unstubAllGlobals());

describe("skills fetch", () => {
  const files = {
    "skills/design/SKILL.md": skill("design"),
    "skills/writing/tone/SKILL.md": skill("tone"),
    ".claude/skills/review/SKILL.md": skill("review"),
    "docs/examples/SKILL.md": skill("not-a-skill"),
    "README.md": "# Skills",
  };

  it("finds the skills where the skills CLI looks", async () => {
    fakeGithub(files);
    const response = await ask("npx skills add acme/skills");
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.repo).toBe("acme/skills");
    expect(result.ref).toBe("main");
    expect(result.skills.map((each: { name: string }) => each.name).sort()).toEqual([
      "design",
      "review",
      "tone",
    ]);
    expect(result.skills[0].body).toContain("Do the thing.");
  });

  it("keeps to the skills and folder asked for", async () => {
    const calls = fakeGithub(files);
    const one = await (await ask("npx skills add acme/skills --skill tone")).json();
    expect(one.skills.map((each: { name: string }) => each.name)).toEqual(["tone"]);
    expect(calls.filter((url) => url.includes("raw.githubusercontent"))).toHaveLength(1);
    const folder = await (await ask("https://github.com/acme/skills/tree/main/docs")).json();
    expect(folder.skills.map((each: { name: string }) => each.name)).toEqual(["not-a-skill"]);
  });

  it("says what went wrong", async () => {
    fakeGithub(files);
    expect((await ask("https://gitlab.com/a/b")).status).toBe(400);
    expect((await ask("acme/missing")).status).toBe(404);
    fakeGithub({ "README.md": "x" });
    expect(await (await ask("acme/skills")).json()).toEqual({
      error: expect.stringContaining("No skills"),
    });
    fakeGithub(files, { limited: true });
    expect(await (await ask("acme/skills")).json()).toEqual({
      error: expect.stringContaining("limit"),
    });
  });

  it("knows the discovery places", () => {
    expect(isDiscoverable("SKILL.md")).toBe(true);
    expect(isDiscoverable("skills/x/SKILL.md")).toBe(true);
    expect(isDiscoverable(".agents/skills/x/SKILL.md")).toBe(true);
    expect(isDiscoverable("skills/SKILL.md")).toBe(false);
    expect(isDiscoverable("src/x/SKILL.md")).toBe(false);
  });
});
