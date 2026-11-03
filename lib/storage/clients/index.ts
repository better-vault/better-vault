import type { StorageId } from "../catalog";
import type { StorageSettings } from "../settings";
import { googleDriveClient } from "./google-drive";
import { oneDriveClient } from "./onedrive";
import { s3Client } from "./s3";
import type { StorageClient } from "./types";

export type { StorageClient } from "./types";

/** The client of a storage service, with its saved settings. */
export function storageClient(id: StorageId, settings: StorageSettings): StorageClient {
  switch (id) {
    case "google-drive":
      return googleDriveClient();
    case "onedrive":
      return oneDriveClient();
    case "s3":
    case "r2":
      return s3Client(id, settings);
  }
}
