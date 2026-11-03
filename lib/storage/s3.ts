import { AwsClient } from "aws4fetch";
import { isDesktopRuntime } from "@/lib/ai/server-config";
import { assertPublicUrl } from "@/lib/sources/network";
import type { CloudFile } from "./catalog";

/**
 * S3-compatible storage (Amazon S3, Cloudflare R2) for one request, signed
 * with the keys sent in it. Nothing is kept. Runs on the server: buckets
 * don't allow a browser page to call them unless CORS is set up on each one.
 */
export interface S3Credentials {
  service: "s3" | "r2";
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region?: string;
  /** S3-compatible services other than AWS (MinIO, Wasabi, …). */
  endpoint?: string;
  /** R2's Cloudflare account id. */
  accountId?: string;
  /** A folder inside the bucket that better-vault keeps to. */
  prefix?: string;
}

const MAX_KEYS = 1000;

/** The bucket's address, path-style so any bucket name works. */
async function bucketUrl(credentials: S3Credentials): Promise<{ url: string; region: string }> {
  const bucket = encodeURIComponent(credentials.bucket.trim());
  if (credentials.service === "r2") {
    const account = credentials.accountId?.trim() ?? "";
    if (!/^[a-f0-9]{32}$/i.test(account))
      throw new Error("The Cloudflare account id is 32 letters and digits.");
    return { url: `https://${account}.r2.cloudflarestorage.com/${bucket}`, region: "auto" };
  }
  const region = credentials.region?.trim() || "us-east-1";
  if (!/^[a-z0-9-]+$/.test(region))
    throw new Error("That region doesn't look right, e.g. us-east-1.");
  const custom = credentials.endpoint?.trim();
  if (custom) {
    const endpoint = new URL(custom);
    // On a server others can reach, a custom address must be public; the desktop app may use a local one.
    if (!isDesktopRuntime()) await assertPublicUrl(endpoint);
    return { url: `${endpoint.origin}${endpoint.pathname.replace(/\/$/, "")}/${bucket}`, region };
  }
  return { url: `https://s3.${region}.amazonaws.com/${bucket}`, region };
}

function client(credentials: S3Credentials, region: string) {
  return new AwsClient({
    accessKeyId: credentials.accessKeyId.trim(),
    secretAccessKey: credentials.secretAccessKey.trim(),
    service: "s3",
    region,
  });
}

/** The prefix, as "folder/" or "". */
export function cleanPrefix(prefix: string | undefined): string {
  const trimmed = (prefix ?? "").trim().replace(/^\/+/, "");
  return trimmed && !trimmed.endsWith("/") ? `${trimmed}/` : trimmed;
}

/** An S3 error, as a sentence. The keys are never part of it. */
async function failure(response: Response): Promise<Error> {
  const body = await response.text().catch(() => "");
  const code = /<Code>([^<]+)<\/Code>/.exec(body)?.[1];
  const messages: Record<string, string> = {
    InvalidAccessKeyId: "The access key id is not recognised.",
    SignatureDoesNotMatch: "The secret access key doesn't match the access key id.",
    NoSuchBucket: "There is no bucket with that name.",
    AccessDenied: "These keys aren't allowed to use that bucket.",
    PermanentRedirect: "The bucket is in another region.",
    AuthorizationHeaderMalformed: "The bucket is in another region.",
  };
  return new Error(
    messages[code ?? ""] ??
      `The storage service answered ${response.status}${code ? ` (${code})` : ""}.`,
  );
}

const decode = (text: string) =>
  text.replace(
    /&(amp|lt|gt|quot|apos);/g,
    (_, name: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[name] ?? "",
  );

/** The files and folders directly inside `folder` (a key prefix inside the bucket's prefix). */
export async function listObjects(credentials: S3Credentials, folder = ""): Promise<CloudFile[]> {
  const { url, region } = await bucketUrl(credentials);
  const prefix = cleanPrefix(credentials.prefix) + folder;
  const query = new URLSearchParams({
    "list-type": "2",
    delimiter: "/",
    "max-keys": String(MAX_KEYS),
    prefix,
  });
  const response = await client(credentials, region).fetch(`${url}?${query}`);
  if (!response.ok) throw await failure(response);
  const xml = await response.text();
  const folders = [...xml.matchAll(/<CommonPrefixes>\s*<Prefix>([^<]+)<\/Prefix>/g)].map(
    (match) => {
      const key = decode(match[1]);
      return { id: key, name: key.slice(prefix.length).replace(/\/$/, ""), folder: true };
    },
  );
  const files = [...xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)]
    .map((match) => {
      const key = decode(/<Key>([^<]+)<\/Key>/.exec(match[1])?.[1] ?? "");
      return {
        id: key,
        name: key.slice(prefix.length),
        size: Number(/<Size>(\d+)<\/Size>/.exec(match[1])?.[1] ?? 0),
        modified: Date.parse(/<LastModified>([^<]+)<\/LastModified>/.exec(match[1])?.[1] ?? ""),
      };
    })
    .filter((file) => file.name && !file.name.endsWith("/"));
  return [...folders, ...files];
}

/** Checks the keys and the bucket by listing it. */
export async function testBucket(credentials: S3Credentials): Promise<void> {
  await listObjects(credentials);
}

/** Only keys inside the bucket's prefix may be read or written. */
function ownKey(credentials: S3Credentials, key: string): string {
  const prefix = cleanPrefix(credentials.prefix);
  if (!key.startsWith(prefix) || key.includes(".."))
    throw new Error("That file is outside the folder.");
  return key;
}

export async function getObject(credentials: S3Credentials, key: string): Promise<Response> {
  const { url, region } = await bucketUrl(credentials);
  const path = ownKey(credentials, key).split("/").map(encodeURIComponent).join("/");
  const response = await client(credentials, region).fetch(`${url}/${path}`);
  if (!response.ok) throw await failure(response);
  return response;
}

/** Writes `name` into a folder of better-vault's (inside the prefix) and returns its key. */
export async function putObject(
  credentials: S3Credentials,
  folder: string,
  name: string,
  body: Uint8Array,
  contentType: string,
): Promise<string> {
  const { url, region } = await bucketUrl(credentials);
  const safe = name.replace(/[\\/]+/g, "-").slice(0, 200);
  const key = `${cleanPrefix(credentials.prefix)}${folder}/${safe}`;
  const response = await client(credentials, region).fetch(
    `${url}/${key.split("/").map(encodeURIComponent).join("/")}`,
    {
      method: "PUT",
      body: body as Uint8Array<ArrayBuffer>,
      headers: { "content-type": contentType },
    },
  );
  if (!response.ok) throw await failure(response);
  return key;
}
