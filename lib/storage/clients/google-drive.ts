import { desktopBridge } from "@/lib/desktop/bridge";
import { oauthApps } from "../apps";
import { accessToken } from "../auth";
import type { CloudFile, StorageFolder } from "../catalog";
import type { StorageClient } from "./types";

/**
 * Google Drive with the `drive.file` scope: better-vault sees only the files
 * the person picks in Google's Picker and the ones it makes itself (its
 * "better-vault" folder of backups and exports).
 */
const api = "https://www.googleapis.com/drive/v3";
const FOLDER = "application/vnd.google-apps.folder";

/** Google's own documents are exported to a file better-vault can read. */
const exports: Record<string, { mime: string; extension: string }> = {
  "application/vnd.google-apps.document": { mime: "text/plain", extension: "txt" },
  "application/vnd.google-apps.presentation": { mime: "text/plain", extension: "txt" },
  "application/vnd.google-apps.spreadsheet": { mime: "text/csv", extension: "csv" },
};

async function drive(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await accessToken("google");
  const response = await fetch(path.startsWith("http") ? path : `${api}${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `Google Drive answered ${response.status}.`);
  }
  return response;
}

const quote = (text: string) => `'${text.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;

/** better-vault's folder (and a subfolder), made the first time. */
async function folderId(name: string, parent?: string): Promise<string> {
  const query = [`name = ${quote(name)}`, `mimeType = '${FOLDER}'`, "trashed = false"];
  if (parent) query.push(`${quote(parent)} in parents`);
  const found = (await (
    await drive(`/files?q=${encodeURIComponent(query.join(" and "))}&fields=files(id)&pageSize=1`)
  ).json()) as { files: { id: string }[] };
  if (found.files[0]) return found.files[0].id;
  const made = (await (
    await drive("/files?fields=id", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER, parents: parent ? [parent] : undefined }),
    })
  ).json()) as { id: string };
  return made.id;
}

const ownFolder = async (folder: StorageFolder) => folderId(folder, await folderId("better-vault"));

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
}

const toCloud = (file: DriveFile): CloudFile => ({
  id: file.id,
  name: file.name,
  mime: file.mimeType,
  size: file.size ? Number(file.size) : undefined,
  modified: file.modifiedTime ? Date.parse(file.modifiedTime) : undefined,
});

/* The Picker: Google's own file chooser, in the page. */
interface PickerDoc {
  id: string;
  name: string;
  mimeType: string;
}
interface PickerApi {
  PickerBuilder: new () => PickerBuilder;
  DocsView: new () => {
    setIncludeFolders(on: boolean): unknown;
    setSelectFolderEnabled(on: boolean): unknown;
  };
  Feature: { MULTISELECT_ENABLED: string };
  Action: { PICKED: string; CANCEL: string };
}
interface PickerBuilder {
  addView(view: unknown): PickerBuilder;
  enableFeature(feature: string): PickerBuilder;
  setOAuthToken(token: string): PickerBuilder;
  setDeveloperKey(key: string): PickerBuilder;
  setAppId(id: string): PickerBuilder;
  setOrigin(origin: string): PickerBuilder;
  setCallback(callback: (data: { action: string; docs?: PickerDoc[] }) => void): PickerBuilder;
  build(): { setVisible(on: boolean): void };
}

async function loadPicker(): Promise<PickerApi> {
  if (!document.querySelector('script[src="https://apis.google.com/js/api.js"]')) {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://apis.google.com/js/api.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Could not load the Google Picker."));
      document.head.appendChild(script);
    });
  }
  await new Promise<void>((resolve) => window.gapi!.load("picker", resolve));
  return (window.google as unknown as { picker: PickerApi }).picker;
}

export function googleDriveClient(): StorageClient {
  return {
    // The Picker needs an address registered with Google, which the desktop app's page doesn't have.
    pick: desktopBridge()
      ? undefined
      : async () => {
          const token = await accessToken("google");
          const picker = await loadPicker();
          return new Promise<CloudFile[]>((resolve) => {
            const view = new picker.DocsView();
            view.setIncludeFolders(true);
            new picker.PickerBuilder()
              .addView(view)
              .enableFeature(picker.Feature.MULTISELECT_ENABLED)
              .setOAuthToken(token)
              .setDeveloperKey(oauthApps.google.apiKey)
              .setAppId(oauthApps.google.appId)
              .setOrigin(location.origin)
              .setCallback((data) => {
                if (data.action === picker.Action.PICKED)
                  resolve(
                    (data.docs ?? []).map((doc) => ({
                      id: doc.id,
                      name: doc.name,
                      mime: doc.mimeType,
                    })),
                  );
                else if (data.action === picker.Action.CANCEL) resolve([]);
              })
              .build()
              .setVisible(true);
          });
        },
    // On desktop, Drive shows what better-vault can open: what it made or was shown before.
    browse: desktopBridge()
      ? async () => {
          const body = (await (
            await drive(
              `/files?q=${encodeURIComponent(`trashed = false and mimeType != '${FOLDER}'`)}&orderBy=modifiedTime desc&pageSize=200&fields=files(id,name,mimeType,size,modifiedTime)`,
            )
          ).json()) as { files: DriveFile[] };
          return body.files.map(toCloud);
        }
      : undefined,
    listOwn: async (folder) => {
      const parent = await ownFolder(folder);
      const body = (await (
        await drive(
          `/files?q=${encodeURIComponent(`${quote(parent)} in parents and trashed = false`)}&orderBy=modifiedTime desc&fields=files(id,name,mimeType,size,modifiedTime)`,
        )
      ).json()) as { files: DriveFile[] };
      return body.files.map(toCloud);
    },
    download: async (file) => {
      const exported = file.mime ? exports[file.mime] : undefined;
      const response = exported
        ? await drive(
            `/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exported.mime)}`,
          )
        : await drive(`/files/${encodeURIComponent(file.id)}?alt=media`);
      const blob = await response.blob();
      const name = exported ? `${file.name}.${exported.extension}` : file.name;
      return new File([blob], name, { type: exported?.mime ?? blob.type });
    },
    upload: async (folder, name, blob) => {
      const parent = await ownFolder(folder);
      const form = new FormData();
      form.append(
        "metadata",
        new Blob([JSON.stringify({ name, parents: [parent] })], { type: "application/json" }),
      );
      form.append("file", blob);
      await drive(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
        {
          method: "POST",
          body: form,
        },
      );
    },
  };
}
