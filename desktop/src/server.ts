import { app, utilityProcess, type UtilityProcess } from "electron";
import { createServer } from "node:net";
import path from "node:path";

/**
 * The app's pages and API routes come from the same Next.js server as the
 * web app: its standalone build, copied into `server/` by `build:server`. It
 * runs in a utility process with Electron's own Node, on a free local port.
 */
export interface LocalServer {
  port: number;
  stop(): void;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

async function waitUntilUp(port: number, child: UtilityProcess, timeoutMs = 60_000) {
  let exited = false;
  child.once("exit", () => {
    exited = true;
  });
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (exited) throw new Error("The local server stopped while starting.");
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`, { method: "HEAD" });
      if (response.status < 500) return;
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("The local server did not start in time.");
}

export async function startServer(): Promise<LocalServer> {
  const root = app.isPackaged ? process.resourcesPath : path.join(__dirname, "..");
  const dir = path.join(root, "server");
  const port = await freePort();
  const child = utilityProcess.fork(path.join(dir, "server.js"), [], {
    cwd: dir,
    serviceName: "better-vault server",
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_ENV: "production",
      PORT: String(port),
      HOSTNAME: "127.0.0.1",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  await waitUntilUp(port, child);
  return { port, stop: () => child.kill() };
}
