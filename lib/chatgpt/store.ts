import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * The ChatGPT sign-in, kept by the local server in two files of its own,
 * never in the browser: OpenAI asks apps to keep these tokens out of browser
 * storage, and one owner makes refreshing a rotating token safe.
 *
 * The folder is `BETTER_VAULT_DATA_DIR` (the desktop app sets it to its data
 * folder) or `~/.better-vault`. Files are written atomically, readable by the
 * owner only.
 */
export function dataDir(): string {
  return process.env.BETTER_VAULT_DATA_DIR || path.join(os.homedir(), ".better-vault");
}

const hostFile = () => path.join(dataDir(), "chatgpt-host.json");
const authFile = () => path.join(dataDir(), "chatgpt-auth.json");

/** What OpenAI issued for one ChatGPT account on this computer. */
export interface ChatGPTRegistration {
  /** The validated ID-token subject. */
  sub: string;
  email: string;
  name: string;
  /** Issued by OpenAI at the first sign-in (`oaiapp_…`), reused afterwards. */
  clientId: string;
}

export interface ChatGPTTokens {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  /** Milliseconds since the epoch. */
  expiresAt: number;
  scopes: string[];
}

export interface ChatGPTAuth {
  /** The account last signed in. Kept after signing out, for the next sign-in. */
  registration: ChatGPTRegistration | null;
  /** Present while signed in. */
  tokens: ChatGPTTokens | null;
}

async function readJson<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return null;
  }
}

async function writeJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  await rename(temporary, file);
}

/**
 * This computer's opaque host id (`ext_agent_host_id`), made once and kept,
 * as OpenAI asks. It is an identifier, not a secret.
 */
export async function hostId(): Promise<string> {
  const saved = await readJson<{ hostId?: string }>(hostFile());
  if (saved?.hostId) return saved.hostId;
  const id = `urn:uuid:${randomUUID()}`;
  await writeJson(hostFile(), { hostId: id });
  return id;
}

export async function readAuth(): Promise<ChatGPTAuth> {
  const saved = await readJson<Partial<ChatGPTAuth>>(authFile());
  return { registration: saved?.registration ?? null, tokens: saved?.tokens ?? null };
}

export async function writeAuth(auth: ChatGPTAuth) {
  await writeJson(authFile(), auth);
}

/** Forgets everything, the registration included. */
export async function removeAuth() {
  await rm(authFile(), { force: true });
}
