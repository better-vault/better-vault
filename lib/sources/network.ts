import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Addresses on the machine or its private network, which a public fetch must not reach. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
      (a === 169 && b === 254) || // link-local, cloud metadata
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast and reserved
    );
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(lower);
  }
  return true;
}

/** Private addresses are refused unless the person hosting allows them. */
function privateAllowed(): boolean {
  return process.env.BETTER_VAULT_ALLOW_PRIVATE_URLS === "true";
}

/** Throws unless the URL is http(s) and every address its host resolves to is public. */
export async function assertPublicUrl(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https addresses can be added.");
  }
  if (url.username || url.password) throw new Error("Addresses with a user name or password are not allowed.");
  if (privateAllowed()) return;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((entry) => entry.address);
  if (addresses.length === 0 || addresses.some(isPrivateAddress)) {
    throw new Error("That address points to a private network and can't be added.");
  }
}

const MAX_REDIRECTS = 5;

/** Fetches a public URL, checking every redirect, with a time and size limit. */
export async function fetchPublic(
  input: string,
  { timeout = 15_000, maxBytes = 10 * 1024 * 1024 } = {},
): Promise<{ url: URL; contentType: string; body: Uint8Array }> {
  let url = new URL(input);
  const signal = AbortSignal.timeout(timeout);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal,
      headers: { "user-agent": "better-vault (+https://github.com/better-vault/better-vault)" },
    });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      url = new URL(response.headers.get("location")!, url);
      continue;
    }
    if (!response.ok) throw new Error(`The page answered ${response.status} ${response.statusText}.`);
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > maxBytes) throw new Error("The page is too large.");
    const body = new Uint8Array(await response.arrayBuffer());
    if (body.byteLength > maxBytes) throw new Error("The page is too large.");
    return { url, contentType: response.headers.get("content-type") ?? "", body };
  }
  throw new Error("Too many redirects.");
}
