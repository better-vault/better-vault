/**
 * The storage services better-vault can use for files: picking sources,
 * keeping backups and saving Studio exports. To add a service, add it here,
 * write its client in `lib/storage/clients/` and register it in
 * `lib/storage/clients/index.ts`.
 */
export const storageIds = ["google-drive", "onedrive", "s3", "r2"] as const;
export type StorageId = (typeof storageIds)[number];

/** A setting a keys-based service asks for. */
export interface StorageField {
  key:
    "accessKeyId" | "secretAccessKey" | "bucket" | "region" | "endpoint" | "accountId" | "prefix";
  secret?: boolean;
  optional?: boolean;
  placeholder?: string;
}

export interface StorageInfo {
  id: StorageId;
  /** Brand name, shown as is in every language. */
  name: string;
  /** Its logo, from theSVG (public/storage). */
  logo: string;
  /** "keys": the person pastes keys; "oauth": they sign in with the service. */
  auth: "keys" | "oauth";
  /** Which sign-in an OAuth service uses. */
  oauth?: "google" | "microsoft";
  fields: readonly StorageField[];
  /** Where to create the keys, or manage the connection. */
  helpUrl: string;
}

export const storages: Record<StorageId, StorageInfo> = {
  "google-drive": {
    id: "google-drive",
    name: "Google Drive",
    logo: "/storage/google-drive.svg",
    auth: "oauth",
    oauth: "google",
    fields: [],
    helpUrl: "https://myaccount.google.com/connections",
  },
  onedrive: {
    id: "onedrive",
    name: "OneDrive",
    logo: "/storage/onedrive.svg",
    auth: "oauth",
    oauth: "microsoft",
    fields: [],
    helpUrl: "https://account.live.com/consent/Manage",
  },
  s3: {
    id: "s3",
    name: "Amazon S3",
    logo: "/storage/s3.svg",
    auth: "keys",
    fields: [
      { key: "accessKeyId", placeholder: "AKIA…" },
      { key: "secretAccessKey", secret: true },
      { key: "bucket", placeholder: "my-notes" },
      { key: "region", placeholder: "us-east-1" },
      { key: "endpoint", optional: true, placeholder: "https://s3.example.com" },
      { key: "prefix", optional: true, placeholder: "better-vault/" },
    ],
    helpUrl: "https://console.aws.amazon.com/iam/home#/security_credentials",
  },
  r2: {
    id: "r2",
    name: "Cloudflare R2",
    logo: "/storage/r2.svg",
    auth: "keys",
    fields: [
      { key: "accountId", placeholder: "0123456789abcdef…" },
      { key: "accessKeyId" },
      { key: "secretAccessKey", secret: true },
      { key: "bucket", placeholder: "my-notes" },
      { key: "prefix", optional: true, placeholder: "better-vault/" },
    ],
    helpUrl: "https://dash.cloudflare.com/?to=/:account/r2/api-tokens",
  },
};

export function isStorageId(value: unknown): value is StorageId {
  return typeof value === "string" && (storageIds as readonly string[]).includes(value);
}

/** Folders better-vault writes to, inside its own folder (or the bucket's prefix). */
export type StorageFolder = "backups" | "exports";

/** A file in a storage service. */
export interface CloudFile {
  /** The service's id for it: an object key, or a file id. */
  id: string;
  name: string;
  /** True for a folder (OneDrive) or a prefix (S3, R2) that can be opened. */
  folder?: boolean;
  size?: number;
  /** Milliseconds since the epoch. */
  modified?: number;
  mime?: string;
}
