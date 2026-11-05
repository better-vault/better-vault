import { desktopBridge } from "@/lib/desktop/bridge";
import { oauthApps } from "../apps";
import { accessToken, dropAccessToken } from "../auth";
import { loadScript } from "../load-script";
import { prepareGoogleSignIn } from "../web-oauth";
import type { CloudFile, StorageFolder } from "../catalog";
import type { StorageClient } from "./types";

/**
 * Google Drive with the `drive.file` scope: better-vault sees only the files
 * the person picks in Google's Picker and the ones it makes itself (its
 * "better-vault" folder of backups and exports).
 */
const api = "https://www.googleapis.com/drive/v3";
const FOLDER = "application/vnd.google-apps.folder";
const SHORTCUT = "application/vnd.google-apps.shortcut";

/** Google's own documents are exported to a file better-vault can read. */
const exports: Record<string, { mime: string; extension: string }> = {
  "application/vnd.google-apps.document": { mime: "text/plain", extension: "txt" },
  "application/vnd.google-apps.presentation": { mime: "text/plain", extension: "txt" },
  "application/vnd.google-apps.spreadsheet": { mime: "text/csv", extension: "csv" },
};

/** Whether a file is one of Google's own documents, which have no bytes of their own. */
export const isGoogleDocument = (mime?: string) =>
  Boolean(mime?.startsWith("application/vnd.google-apps.")) && mime !== FOLDER;

/** Whether better-vault can turn this Google document into a file. */
export const canExport = (mime?: string) => Boolean(mime && exports[mime]);

async function drive(path: string, init: RequestInit = {}, retried = false): Promise<Response> {
  const token = await accessToken("google");
  const response = await fetch(path.startsWith("http") ? path : `${api}${path}`, {
    ...init,
    headers: { ...init.headers, authorization: `Bearer ${token}` },
  });
  // A token can run out or be revoked between requests: get a new one, once.
  if (response.status === 401 && !retried) {
    dropAccessToken("google");
    return drive(path, init, true);
  }
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
  Action: { PICKED: string; CANCEL: string; ERROR?: string };
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

let pickerLoad: Promise<PickerApi> | null = null;

/** Loads the Picker once; a failed load is tried again next time. */
function loadPicker(): Promise<PickerApi> {
  pickerLoad ??= (async () => {
    await loadScript("https://apis.google.com/js/api.js", "Could not load the Google Picker.");
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("The Google Picker took too long to load.")),
        20_000,
      );
      window.gapi!.load("picker", () => {
        clearTimeout(timer);
        resolve();
      });
    });
    return (window.google as unknown as { picker: PickerApi }).picker;
  })().catch((error: unknown) => {
    pickerLoad = null;
    throw error;
  });
  return pickerLoad;
}

/* Whether the Picker is on screen, so a dialog under it can stay open. */
let pickerOpen = false;
const pickerListeners = new Set<() => void>();
function setPickerOpen(open: boolean) {
  pickerOpen = open;
  for (const listener of pickerListeners) listener();
}
export const googlePicker = {
  isOpen: () => pickerOpen,
  subscribe(listener: () => void) {
    pickerListeners.add(listener);
    return () => pickerListeners.delete(listener);
  },
  /**
   * Loads the Picker and Google's sign-in before the click, so the click
   * opens the sign-in popup straight away (a popup opened after slow awaits
   * is blocked by the browser).
   */
  prepare: () => Promise.all([loadPicker(), prepareGoogleSignIn()]).then(() => undefined),
};

/** A shortcut's target, which is the file that can be read. */
async function resolveShortcut(file: CloudFile): Promise<CloudFile> {
  if (file.mime !== SHORTCUT) return file;
  const body = (await (
    await drive(
      `/files/${encodeURIComponent(file.id)}?fields=shortcutDetails(targetId,targetMimeType)`,
    )
  ).json()) as { shortcutDetails?: { targetId?: string; targetMimeType?: string } };
  const target = body.shortcutDetails;
  if (!target?.targetId)
    throw new Error(`“${file.name}” is a shortcut to a file that can't be opened.`);
  return { ...file, id: target.targetId, mime: target.targetMimeType };
}

/** Adds the extension a file's type implies when its name has none, so it is read as that type. */
function withExtension(name: string, mime: string): string {
  if (/\.[a-z0-9]{1,5}$/i.test(name)) return name;
  const extension =
    mime === "application/pdf"
      ? "pdf"
      : mime === "text/markdown"
        ? "md"
        : mime === "text/csv"
          ? "csv"
          : mime.startsWith("text/")
            ? "txt"
            : "";
  return extension ? `${name}.${extension}` : name;
}

export function googleDriveClient(): StorageClient {
  return {
    // The Picker needs an address registered with Google, which the desktop app's page doesn't have.
    pick: desktopBridge()
      ? undefined
      : async () => {
          // The token first: it may open Google's popup, which must follow the click closely.
          const token = await accessToken("google");
          const picker = await loadPicker();
          setPickerOpen(true);
          try {
            return await new Promise<CloudFile[]>((resolve, reject) => {
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
                  else if (data.action === (picker.Action.ERROR ?? "error"))
                    reject(new Error("The Google Picker could not open your files. Try again."));
                })
                .build()
                .setVisible(true);
            });
          } finally {
            setPickerOpen(false);
          }
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
    download: async (picked) => {
      const file = await resolveShortcut(picked);
      if (isGoogleDocument(file.mime) && !canExport(file.mime))
        throw new Error(
          `“${file.name}” is a kind of Google file better-vault can't read. Docs, Slides and Sheets work.`,
        );
      const exported = file.mime ? exports[file.mime] : undefined;
      const response = exported
        ? await drive(
            `/files/${encodeURIComponent(file.id)}/export?mimeType=${encodeURIComponent(exported.mime)}`,
          )
        : await drive(`/files/${encodeURIComponent(file.id)}?alt=media`);
      const blob = await response.blob();
      const type = exported?.mime ?? (file.mime || blob.type);
      const name = exported ? `${file.name}.${exported.extension}` : withExtension(file.name, type);
      return new File([blob], name, { type });
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
