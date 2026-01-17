import { Injectable } from "@angular/core";
import { invoke } from "@tauri-apps/api/core";
import type { Sync, SyncCreate, SyncUpdate, SyncStatus } from "../shared/models";

@Injectable({ providedIn: "root" })
export class SyncService {
  // ==================== CRUD Operations ====================

  async createSync(payload: SyncCreate): Promise<Sync> {
    return invoke<Sync>("sync_create", { payload });
  }

  async getSync(id: number): Promise<Sync | null> {
    return invoke<Sync | null>("sync_get", { id });
  }

  async getSyncByProject(projectId: number): Promise<Sync | null> {
    return invoke<Sync | null>("sync_get_by_project", { projectId });
  }

  async listSyncs(): Promise<Sync[]> {
    return invoke<Sync[]>("sync_list", {});
  }

  async updateSync(id: number, payload: SyncUpdate): Promise<Sync> {
    return invoke<Sync>("sync_update", { id, payload });
  }

  async deleteSync(id: number): Promise<void> {
    return invoke<void>("sync_delete", { id });
  }

  async deleteSyncByProject(projectId: number): Promise<void> {
    return invoke<void>("sync_delete_by_project", { projectId });
  }

  // ==================== Status & State Management ====================

  /**
   * Get comprehensive sync status with computed fields
   * Includes: can_sync_now, next_sync_in_ms, has_pending_changes, is_file_newer, is_db_newer
   */
  async getSyncStatus(projectId: number): Promise<SyncStatus | null> {
    return invoke<SyncStatus | null>("sync_get_status", { projectId });
  }

  /**
   * Mark sync as started (status -> 'syncing')
   */
  async markSyncStarted(projectId: number): Promise<Sync> {
    return invoke<Sync>("sync_mark_started", { projectId });
  }

  /**
   * Mark sync as successfully completed
   * Updates hashes, versions, timestamps, and resets error state
   */
  async markSyncCompleted(projectId: number, dbHash: string, fileHash: string): Promise<Sync> {
    return invoke<Sync>("sync_mark_completed", { projectId, dbHash, fileHash });
  }

  /**
   * Mark sync as failed with error message
   * Increments retry count and calculates next retry time with exponential backoff
   */
  async markSyncFailed(projectId: number, error: string): Promise<Sync> {
    return invoke<Sync>("sync_mark_failed", { projectId, error });
  }

  // ==================== Conflict Resolution ====================

  /**
   * Mark sync as having a conflict
   * Stores conflict data (JSON) for later resolution
   */
  async markSyncConflict(projectId: number, conflictData: string): Promise<Sync> {
    return invoke<Sync>("sync_mark_conflict", { projectId, conflictData });
  }

  /**
   * Resolve a sync conflict
   * Resolution should be: 'use_db', 'use_file', or 'manual'
   */
  async resolveConflict(projectId: number, resolution: string): Promise<Sync> {
    return invoke<Sync>("sync_resolve_conflict", { projectId, resolution });
  }

  // ==================== Retry Management ====================

  /**
   * Reset retry count and error state
   * Useful after manual intervention
   */
  async resetRetries(projectId: number): Promise<Sync> {
    return invoke<Sync>("sync_reset_retries", { projectId });
  }

  /**
   * Get all syncs that have pending retries (failed but not exceeded max_retries)
   */
  async getPendingRetries(): Promise<Sync[]> {
    return invoke<Sync[]>("sync_get_pending_retries", {});
  }

  // ==================== Change Tracking ====================

  /**
   * Mark that the database content has changed
   * Increments db_version and updates last_db_change_at
   */
  async markDbChanged(projectId: number): Promise<Sync | null> {
    return invoke<Sync | null>("sync_mark_db_changed", { projectId });
  }

  /**
   * Mark that the file content has changed
   * Increments file_version and updates last_file_change_at
   */
  async markFileChanged(projectId: number): Promise<Sync | null> {
    return invoke<Sync | null>("sync_mark_file_changed", { projectId });
  }

  // ==================== Sync Control ====================

  /**
   * Pause syncing for a project
   */
  async pauseSync(projectId: number): Promise<Sync> {
    return invoke<Sync>("sync_pause", { projectId });
  }

  /**
   * Resume syncing for a project
   */
  async resumeSync(projectId: number): Promise<Sync> {
    return invoke<Sync>("sync_resume", { projectId });
  }

  // ==================== Utilities ====================

  /**
   * Calculate SHA256 hash of content
   * Useful for comparing file/db content
   */
  async calculateHash(content: Uint8Array): Promise<string> {
    // Convert Uint8Array to regular array for invoke
    return invoke<string>("sync_calculate_hash", { content: Array.from(content) });
  }

  /**
   * Helper to calculate hash from string content
   */
  async calculateHashFromString(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(content);
    return this.calculateHash(bytes);
  }

  // ==================== High-Level Sync Operations ====================

  /**
   * Initialize sync for a project
   * Creates sync record if it doesn't exist
   */
  async initializeSync(projectId: number, filePath: string, options?: {
    syncDirection?: 'bidirectional' | 'db_to_file' | 'file_to_db';
    throttleMs?: number;
    autoSyncEnabled?: boolean;
  }): Promise<Sync> {
    // Check if sync already exists
    const existing = await this.getSyncByProject(projectId);
    if (existing) {
      // Update file path if different
      if (existing.file_path !== filePath) {
        return this.updateSync(existing.id, { file_path: filePath });
      }
      return existing;
    }

    // Create new sync
    return this.createSync({
      project_id: projectId,
      file_path: filePath,
      sync_direction: options?.syncDirection,
      throttle_ms: options?.throttleMs,
      auto_sync_enabled: options?.autoSyncEnabled
    });
  }

  /**
   * Check if sync is ready and can proceed
   * Returns status with all computed fields
   */
  async canSync(projectId: number): Promise<{
    canSync: boolean;
    reason?: string;
    status: SyncStatus | null;
  }> {
    const status = await this.getSyncStatus(projectId);
    
    if (!status) {
      return { canSync: false, reason: 'No sync configuration found', status: null };
    }

    if (status.sync.sync_status === 'paused') {
      return { canSync: false, reason: 'Sync is paused', status };
    }

    if (status.sync.sync_status === 'syncing') {
      return { canSync: false, reason: 'Sync already in progress', status };
    }

    if (status.sync.sync_status === 'conflict') {
      return { canSync: false, reason: 'Unresolved conflict', status };
    }

    if (!status.can_sync_now && status.next_sync_in_ms) {
      return { canSync: false, reason: `Throttled. Next sync in ${status.next_sync_in_ms}ms`, status };
    }

    if (status.sync.retry_count >= status.sync.max_retries) {
      return { canSync: false, reason: 'Max retries exceeded', status };
    }

    return { canSync: true, status };
  }

  /**
   * Perform a full sync cycle
   * This is a high-level operation that coordinates the sync process
   */
  async performSync(
    projectId: number,
    callbacks: {
      getDbContent: () => Promise<string>;
      getFileContent: () => Promise<string>;
      writeDbContent: (content: string) => Promise<void>;
      writeFileContent: (content: string) => Promise<void>;
    }
  ): Promise<{ success: boolean; error?: string; conflict?: boolean }> {
    // Check if we can sync
    const { canSync, reason, status } = await this.canSync(projectId);
    if (!canSync || !status) {
      return { success: false, error: reason || 'Cannot sync' };
    }

    try {
      // Mark sync as started
      await this.markSyncStarted(projectId);

      // Get current content
      const [dbContent, fileContent] = await Promise.all([
        callbacks.getDbContent(),
        callbacks.getFileContent()
      ]);

      // Calculate hashes
      const [dbHash, fileHash] = await Promise.all([
        this.calculateHashFromString(dbContent),
        this.calculateHashFromString(fileContent)
      ]);

      // Check for changes
      const dbChanged = dbHash !== status.sync.db_hash;
      const fileChanged = fileHash !== status.sync.file_hash;

      if (!dbChanged && !fileChanged) {
        // No changes, mark as synced
        await this.markSyncCompleted(projectId, dbHash, fileHash);
        return { success: true };
      }

      if (dbChanged && fileChanged) {
        // Both changed - conflict
        const conflictData = JSON.stringify({
          db_hash: dbHash,
          file_hash: fileHash,
          db_changed_at: new Date().toISOString(),
          file_changed_at: new Date().toISOString()
        });
        await this.markSyncConflict(projectId, conflictData);
        return { success: false, conflict: true, error: 'Both database and file have changed' };
      }

      // Determine sync direction
      const direction = status.sync.sync_direction;

      if (dbChanged && (direction === 'bidirectional' || direction === 'db_to_file')) {
        // DB is newer, write to file
        await callbacks.writeFileContent(dbContent);
        await this.markSyncCompleted(projectId, dbHash, dbHash);
        return { success: true };
      }

      if (fileChanged && (direction === 'bidirectional' || direction === 'file_to_db')) {
        // File is newer, write to DB
        await callbacks.writeDbContent(fileContent);
        await this.markSyncCompleted(projectId, fileHash, fileHash);
        return { success: true };
      }

      // Direction doesn't allow this sync
      await this.markSyncCompleted(projectId, dbHash, fileHash);
      return { success: true };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.markSyncFailed(projectId, errorMessage);
      return { success: false, error: errorMessage };
    }
  }
}
