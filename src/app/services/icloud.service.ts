import { Injectable } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import type { ICloudFileStatus } from '../shared/models';

/** Max number of download-availability polls before giving up. */
const ICLOUD_DOWNLOAD_POLL_ATTEMPTS = 20;
/** Milliseconds between each availability poll. */
const ICLOUD_DOWNLOAD_POLL_INTERVAL_MS = 500;

@Injectable({ providedIn: 'root' })
export class ICloudService {
  // ─── Availability ─────────────────────────────────────────────────────────

  /** Returns true if the iCloud Drive container exists on this device. */
  isAvailable(): Promise<boolean> {
    return invoke<boolean>('icloud_is_available');
  }

  // ─── Paths ────────────────────────────────────────────────────────────────

  /**
   * Returns the canonical `.cora` path inside iCloud Drive for the given
   * project name, creating the Documents folder in the container if needed.
   */
  getProjectPath(projectName: string): Promise<string> {
    return invoke<string>('icloud_get_project_path', { projectName });
  }

  /** Returns true if `path` is inside the Cora iCloud Drive container. */
  isICloudPath(path: string): boolean {
    return path.includes('Mobile Documents') && path.includes('iCloud~com~pluton~cora');
  }

  // ─── File status ──────────────────────────────────────────────────────────

  /**
   * Checks whether a file in the iCloud container is available locally or
   * has been evicted (only a `.icloud` placeholder exists).
   */
  checkFileStatus(path: string): Promise<ICloudFileStatus> {
    return invoke<ICloudFileStatus>('icloud_check_file_status', { path });
  }

  /**
   * Asks iCloud to download an evicted file back to local storage.
   * Returns immediately — call `checkFileStatus` to track progress.
   */
  triggerDownload(path: string): Promise<void> {
    return invoke<void>('icloud_trigger_download', { path });
  }

  /**
   * Ensures a file in iCloud is locally available, triggering a download
   * if necessary and waiting for it to complete.
   *
   * Throws if the download does not complete within the poll timeout.
   */
  async ensureDownloaded(path: string): Promise<void> {
    const status = await this.checkFileStatus(path);
    if (status.isLocal) return;
    if (status.notFound) {
      throw new Error(`iCloud file not found (not even a placeholder): ${path}`);
    }
    // File is a placeholder — trigger download and poll.
    await this.triggerDownload(path);
    for (let i = 0; i < ICLOUD_DOWNLOAD_POLL_ATTEMPTS; i++) {
      await new Promise<void>(r => setTimeout(r, ICLOUD_DOWNLOAD_POLL_INTERVAL_MS));
      const s = await this.checkFileStatus(path);
      if (s.isLocal) return;
    }
    throw new Error(
      `iCloud file download timed out after ${(ICLOUD_DOWNLOAD_POLL_ATTEMPTS * ICLOUD_DOWNLOAD_POLL_INTERVAL_MS) / 1000}s. ` +
      'Please check your internet connection and try again.'
    );
  }

  // ─── Coordinated I/O ──────────────────────────────────────────────────────

  /**
   * Read a file using NSFileCoordinator on macOS so reads are safely
   * serialised with the iCloud daemon.
   */
  readFile(path: string): Promise<Uint8Array> {
    return invoke<number[]>('icloud_read_file', { path }).then(
      bytes => new Uint8Array(bytes)
    );
  }

  /**
   * Write a file using NSFileCoordinator on macOS so writes are safely
   * serialised with the iCloud daemon.
   */
  writeFile(path: string, content: Uint8Array): Promise<void> {
    return invoke<void>('icloud_write_file', {
      path,
      content: Array.from(content),
    });
  }
}
