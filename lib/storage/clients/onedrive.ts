import { accessToken } from "../auth";
import type { CloudFile } from "../catalog";
import type { StorageClient } from "./types";

/** OneDrive through Microsoft Graph: browse the person's files; write to a "better-vault" folder. */
const graph = "https://graph.microsoft.com/v1.0";
/** Larger files are uploaded in pieces. */
const SIMPLE_UPLOAD = 4 * 1024 * 1024;
const PIECE = 5 * 320 * 1024;

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken("microsoft");
  const response = await fetch(path.startsWith("http") ? path : `${graph}${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `OneDrive answered ${response.status}.`);
  }
  return response;
}

interface Item {
  id: string;
  name: string;
  size?: number;
  lastModifiedDateTime?: string;
  folder?: unknown;
  file?: { mimeType?: string };
}

const toCloud = (item: Item): CloudFile => ({
  id: item.id,
  name: item.name,
  folder: Boolean(item.folder),
  size: item.size,
  modified: item.lastModifiedDateTime ? Date.parse(item.lastModifiedDateTime) : undefined,
  mime: item.file?.mimeType,
});

const path = (name: string) => name.split("/").map(encodeURIComponent).join("/");

export function oneDriveClient(): StorageClient {
  return {
    browse: async (folder) => {
      const where = folder ? `/me/drive/items/${encodeURIComponent(folder)}` : "/me/drive/root";
      const body = (await (await call(`${where}/children?$top=200`)).json()) as { value: Item[] };
      return body.value
        .map(toCloud)
        .sort((a, b) => Number(b.folder) - Number(a.folder) || a.name.localeCompare(b.name));
    },
    listOwn: async (folder) => {
      try {
        const body = (await (
          await call(
            `/me/drive/root:/better-vault/${folder}:/children?$orderby=lastModifiedDateTime desc`,
          )
        ).json()) as { value: Item[] };
        return body.value.filter((item) => !item.folder).map(toCloud);
      } catch {
        // Nothing saved yet: the folder doesn't exist.
        return [];
      }
    },
    download: async (file) => {
      const blob = await (
        await call(`/me/drive/items/${encodeURIComponent(file.id)}/content`)
      ).blob();
      return new File([blob], file.name, { type: file.mime ?? blob.type });
    },
    upload: async (folder, name, blob) => {
      const target = `/me/drive/root:/${path(`better-vault/${folder}/${name}`)}:`;
      if (blob.size <= SIMPLE_UPLOAD) {
        await call(`${target}/content`, { method: "PUT", body: blob });
        return;
      }
      const session = (await (
        await call(`${target}/createUploadSession`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename" } }),
        })
      ).json()) as { uploadUrl: string };
      for (let at = 0; at < blob.size; at += PIECE) {
        const piece = blob.slice(at, Math.min(at + PIECE, blob.size));
        const response = await fetch(session.uploadUrl, {
          method: "PUT",
          headers: { "content-range": `bytes ${at}-${at + piece.size - 1}/${blob.size}` },
          body: piece,
        });
        if (!response.ok) throw new Error(`OneDrive answered ${response.status}.`);
      }
    },
  };
}
