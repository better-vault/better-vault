import type { CloudFile, StorageFolder } from "../catalog";
import type { StorageSettings } from "../settings";
import type { StorageClient } from "./types";

/** Amazon S3 and Cloudflare R2, through this app's API with the saved keys. */
export function s3Client(service: "s3" | "r2", settings: StorageSettings): StorageClient {
  const credentials = { service, ...settings.fields };

  async function call(body: object): Promise<Response> {
    const response = await fetch("/api/storage/s3", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ credentials, ...body }),
    });
    if (!response.ok) {
      const answer = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(answer.error ?? response.statusText);
    }
    return response;
  }

  const list = async (folder?: string) =>
    ((await (await call({ action: "list", folder })).json()) as { files: CloudFile[] }).files;

  return {
    browse: (folder) => list(folder),
    listOwn: async (folder: StorageFolder) =>
      (await list(`${folder}/`))
        .filter((file) => !file.folder)
        .sort((a, b) => (b.modified ?? 0) - (a.modified ?? 0)),
    download: async (file) => {
      const response = await call({ action: "get", key: file.id });
      const blob = await response.blob();
      return new File([blob], file.name.split("/").pop() || file.name, { type: blob.type });
    },
    upload: async (folder, name, blob) => {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let text = "";
      for (let at = 0; at < bytes.length; at += 0x8000)
        text += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
      await call({
        action: "put",
        folder,
        name,
        contentType: blob.type || "application/octet-stream",
        data: btoa(text),
      });
    },
  };
}

/** Checks the keys by listing the bucket. */
export async function testS3(service: "s3" | "r2", settings: StorageSettings): Promise<void> {
  const response = await fetch("/api/storage/s3", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "test", credentials: { service, ...settings.fields } }),
  });
  if (!response.ok) {
    const answer = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(answer.error ?? response.statusText);
  }
}
