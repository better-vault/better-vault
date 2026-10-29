// `npm run desktop:dev`: starts the app's dev server, waits for it, then opens
// the desktop app on it, with hot reload. Stopping one stops the other.
import { spawn, spawnSync } from "node:child_process";

const url = "http://localhost:3000";
const windows = process.platform === "win32";
const npm = windows ? "npm.cmd" : "npm";
const children = [];

function run(args, options = {}) {
  const child = spawn(npm, args, {
    stdio: "inherit",
    shell: windows,
    // Its own process group, so stopping it also stops the server or app it starts.
    detached: !windows,
    ...options,
  });
  children.push(child);
  child.on("exit", (code) => stop(code ?? 0));
  return child;
}

/** Stops a child with everything it started. */
function kill(child) {
  if (child.exitCode !== null) return;
  try {
    if (windows) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    // Already gone.
  }
}

function stop(code) {
  for (const child of children) kill(child);
  process.exit(code);
}

process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));

run(["run", "dev"]);

const deadline = Date.now() + 120_000;
while (true) {
  try {
    if ((await fetch(url, { method: "HEAD" })).status < 500) break;
  } catch {
    // Not listening yet.
  }
  if (Date.now() > deadline) {
    console.error(`The dev server did not answer at ${url}.`);
    stop(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

run(["run", "dev", "--prefix", "desktop"]);
