// Builds the web app as a standalone server and copies it into desktop/server,
// with the static files `next build` leaves out of it.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const out = fileURLToPath(new URL("../server", import.meta.url));
const standalone = path.join(root, ".next", "standalone");

if (!process.argv.includes("--copy-only")) {
  const build = spawnSync("npm", ["run", "build"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, BETTER_VAULT_STANDALONE: "1" },
  });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

if (!existsSync(path.join(standalone, "server.js"))) {
  console.error("No standalone build in .next/standalone.");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
cpSync(standalone, out, { recursive: true, dereference: true });
cpSync(path.join(root, ".next", "static"), path.join(out, ".next", "static"), { recursive: true });
cpSync(path.join(root, "public"), path.join(out, "public"), { recursive: true });
console.log(`Server copied to ${path.relative(root, out)}`);
