# Sync Permission Re-Grant Fix - macOS Sandbox

**Date:** January 17, 2026  
**Status:** ✅ COMPLETED

## Problem

After restarting the app on macOS, sync operations failed with:
```
Sync failed: Operation not permitted (os error 1)
```

This occurred even though:
- The .cora file existed and was accessible via Finder
- The file path was correctly stored in the sync configuration
- Filesystem scope permissions were correctly configured in Tauri

## Root Cause

**macOS App Sandbox Security Model:**

When a user selects a file via the save/open dialog, macOS grants the app temporary permission to access that file. However, this permission is **not persisted across app restarts**.

The sandbox permission model:
1. ✅ User saves file via dialog → App gets access to that path
2. ✅ App can read/write to that path during current session
3. ❌ App restarts → Previous file permissions are **lost**
4. ❌ App tries to access same path → "Operation not permitted"

This is by design in macOS to protect user files from unauthorized access by apps.

## Solution

Implemented a re-grant file access flow that:
1. Detects permission errors when trying to access the sync file
2. Prompts the user to re-select the file (which re-grants access)
3. Updates the sync configuration with the new path
4. Allows user to disable sync if they choose not to re-select

### Implementation

**Location:** `/src/app/views/project-view/project-view.component.ts`

#### 1. Permission Error Detection

```typescript
private isPermissionError(err: any): boolean {
  const errStr = String(err).toLowerCase();
  return errStr.includes('operation not permitted') ||
         errStr.includes('os error 1') ||
         errStr.includes('permission denied') ||
         errStr.includes('not permitted');
}
```

#### 2. Re-Grant Access Prompt

```typescript
private async promptReGrantFileAccess(): Promise<string | null> {
  const shouldReselect = await ask(
    'File access permission was lost (this happens after restarting the app on macOS). Would you like to re-select the sync file to restore access?',
    {
      title: 'File Access Required',
      kind: 'warning',
      okLabel: 'Select File',
      cancelLabel: 'Disable Sync'
    }
  );

  if (!shouldReselect) {
    return null;
  }

  // Open file picker to re-grant access
  const selected = await open({
    title: 'Select the sync file to restore access',
    filters: [{ name: 'Cora Project', extensions: ['cora'] }],
    multiple: false,
    directory: false
  });

  if (!selected || Array.isArray(selected)) {
    return null;
  }

  return selected as string;
}
```

#### 3. Protected File Access Calls

All file read/write operations are now wrapped with permission error handling:

```typescript
try {
  const fileContent = await readFile(this.currentSync.file_path);
  // ... process file
} catch (err) {
  if (this.isPermissionError(err)) {
    const newPath = await this.promptReGrantFileAccess();
    if (newPath) {
      // Update sync config with new path and retry
      await this.syncService.updateSync(this.currentSync.id, { file_path: newPath });
      this.currentSync.file_path = newPath;
      return await readFile(newPath);
    } else {
      // User chose to disable sync
      await this.syncService.deleteSyncByProject(this.projectId);
      this.currentSync = null;
      this.syncStatus = 'idle';
      throw new Error('Sync disabled by user');
    }
  }
  throw err;  // Re-throw non-permission errors
}
```

## Protected Locations

The following file access operations are now protected:

1. **`performSync()` → `getFileContent` callback**
   - Triggered when sync starts and needs to read current file
   
2. **`autoResolveConflict()` → `readFile(this.currentSync.file_path)`**
   - Triggered when resolving existing conflict state
   
3. **Conflict resolution export**
   - Triggered when database is newer and needs to write to file

## User Experience

### Before Fix
1. User opens app after restart
2. Click "Sync Now" or auto-sync triggers
3. ❌ Error: "Sync failed: Operation not permitted"
4. User must manually reconfigure sync

### After Fix
1. User opens app after restart
2. Click "Sync Now" or auto-sync triggers
3. ✅ Dialog: "File access permission was lost... Would you like to re-select the sync file?"
4. User clicks "Select File" → File picker opens
5. User selects the same (or different) .cora file
6. ✅ Sync continues normally

If user clicks "Disable Sync":
- Sync is gracefully disabled
- User can re-enable sync later via export

## Alternative Solutions (Not Implemented)

### Security-Scoped Bookmarks
macOS provides security-scoped bookmarks that persist file access permissions across app restarts. However:
- Requires native Rust/Swift implementation
- More complex to implement correctly
- The re-grant dialog solution is sufficient for most users

### App-Sandboxed Storage Only
Store .cora files inside the app's sandbox (e.g., `~/Library/Application Support/cora/`):
- ✅ No permission issues
- ❌ Users can't easily share files via iCloud/Dropbox
- ❌ Files less accessible for backup

## Testing

### Manual Test Steps
1. Create a project and export with sync enabled
2. Completely quit the app (Cmd+Q)
3. Reopen the app and navigate to the synced project
4. Click "Sync Now" (or wait for auto-sync if enabled)
5. Verify the re-grant dialog appears
6. Click "Select File" and select the .cora file
7. Verify sync completes successfully

### Test: Cancel Re-Grant
1. Follow steps 1-4 above
2. When dialog appears, click "Disable Sync"
3. Verify sync is disabled without error
4. Verify project still works normally

## Related Files
- `src/app/views/project-view/project-view.component.ts` - Main sync implementation
- `src/app/services/sync.service.ts` - Sync service methods
- `docs/SYNC_AUTO_RESOLVE.md` - Automatic conflict resolution
- `docs/SYNC_PERMISSIONS_FIX.md` - Tauri filesystem scope configuration

## References
- [Apple: App Sandbox Design Guide](https://developer.apple.com/library/archive/documentation/Security/Conceptual/AppSandboxDesignGuide/)
- [macOS Security-Scoped Bookmarks](https://developer.apple.com/documentation/foundation/nsurl/1417795-startaccessingsecurityscopedreso)
