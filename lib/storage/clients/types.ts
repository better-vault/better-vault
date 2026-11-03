import type { CloudFile, StorageFolder } from "../catalog";

/**
 * What better-vault does with a storage service. Every client works the
 * same way, so the Add source dialog, backups and exports don't need to know
 * which service is behind it.
 */
export interface StorageClient {
  /**
   * The files and folders in `folder` (undefined for the top), to browse for
   * sources. Absent when the service has its own picker instead.
   */
  browse?(folder?: string): Promise<CloudFile[]>;
  /** Opens the service's own file picker (Google Drive); answers the files chosen. */
  pick?(): Promise<CloudFile[]>;
  /** The files better-vault saved in one of its folders, newest first. */
  listOwn(folder: StorageFolder): Promise<CloudFile[]>;
  download(file: CloudFile): Promise<File>;
  upload(folder: StorageFolder, name: string, blob: Blob): Promise<void>;
}
