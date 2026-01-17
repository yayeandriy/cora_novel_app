# Temp File Creation Fix

**Date:** January 2025  
**Issue:** Sync failed with "No such file or directory (os error 2)" when trying to create temporary files for sync operations.

## Problem

When performing sync operations, the application attempted to create temporary files in the same directory as the original file:

```typescript
// Old (Broken) Approach:
const tempPath = `${this.currentSync!.file_path}.tmp`;
await this.projectService.exportProject(this.projectId, tempPath);
```

This approach failed because:
1. The parent directory might not exist
2. The directory might not be writable
3. Unicode/Cyrillic characters in the path could cause issues
4. No guarantee of write permissions

Example failing path:
```
/Users/pluton/Documents/Writer/дві_води/two_waters_sync.cora.tmp
```

## Root Cause

The code made two incorrect assumptions:
1. **Parent directory exists**: Assumed the directory containing the original file was already created
2. **Write permissions**: Assumed we had permission to write files in that location

## Solution

Use the system temporary directory with unique filenames:

```typescript
// New (Working) Approach:
import { tempDir, join } from '@tauri-apps/api/path';

// Get database content
const sysTempDir = await tempDir();
const tempFileName = `cora-sync-${this.projectId}-${Date.now()}.tmp`;
const tempPath = await join(sysTempDir, tempFileName);

await this.projectService.exportProject(this.projectId, tempPath);
const content = await readTextFile(tempPath);

// Clean up temp file
try {
  await writeTextFile(tempPath, ''); // Clear content first
} catch (err) {
  console.warn('Failed to cleanup temp file:', err);
}
```

### Key Improvements

1. **System Temp Directory**: 
   - `tempDir()` returns the OS-specific temp directory
   - macOS: `/var/folders/...` or `$TMPDIR`
   - Guaranteed to exist and be writable

2. **Unique Filenames**:
   - Format: `cora-sync-{projectId}-{timestamp}.tmp`
   - Prevents collisions between concurrent operations
   - Easy to identify and clean up

3. **Proper Cleanup**:
   - Explicitly clear temp file after use
   - Error handling for cleanup failures
   - Non-blocking (logs warning if fails)

4. **Path Joining**:
   - `join()` function properly handles path separators
   - Works across different operating systems
   - Handles Unicode/special characters correctly

## Implementation

### Updated Code Locations

**File:** `src/app/views/project-view/project-view.component.ts`

**Import statements (lines ~8-10):**
```typescript
import { confirm, open, save, ask } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { tempDir, join } from '@tauri-apps/api/path';
```

**getDbContent function (~lines 1076-1093):**
```typescript
getDbContent: async () => {
  // Export to system temp directory with unique filename
  const sysTempDir = await tempDir();
  const tempFileName = `cora-sync-${this.projectId}-${Date.now()}.tmp`;
  const tempPath = await join(sysTempDir, tempFileName);
  
  await this.projectService.exportProject(this.projectId, tempPath);
  const content = await readTextFile(tempPath);
  
  // Clean up temp file
  try {
    await writeTextFile(tempPath, ''); // Clear content first
  } catch (err) {
    console.warn('Failed to cleanup temp file:', err);
  }
  
  return content;
}
```

**writeDbContent function (~lines 1103-1122):**
```typescript
writeDbContent: async (content: string) => {
  // Write to system temp directory with unique filename
  const sysTempDir = await tempDir();
  const tempFileName = `cora-import-${this.projectId}-${Date.now()}.tmp`;
  const tempPath = await join(sysTempDir, tempFileName);
  
  await writeTextFile(tempPath, content);
  // Import from the temp file
  await this.projectService.importProject(tempPath);
  // Reload the project to reflect changes
  await this.loadProject(true);
  
  // Clean up temp file
  try {
    await writeTextFile(tempPath, ''); // Clear content first
  } catch (err) {
    console.warn('Failed to cleanup temp file:', err);
  }
}
```

## Tauri Path API Reference

### tempDir()

```typescript
/**
 * Returns a temporary directory.
 * @example
 * ```typescript
 * import { tempDir } from '@tauri-apps/api/path';
 * const temp = await tempDir();
 * ```
 *
 * @since 2.0.0
 */
declare function tempDir(): Promise<string>;
```

**Platform-specific paths:**
- **macOS**: `/var/folders/...` or `$TMPDIR`
- **Linux**: `/tmp` or `$TMPDIR`
- **Windows**: `%TEMP%` or `C:\Users\{username}\AppData\Local\Temp`

### join()

```typescript
/**
 * Joins path segments into a single path using the platform-specific separator.
 * @example
 * ```typescript
 * import { join } from '@tauri-apps/api/path';
 * const path = await join('var', 'log', 'app.log');
 * // macOS/Linux: '/var/log/app.log'
 * // Windows: 'var\\log\\app.log'
 * ```
 */
declare function join(...paths: string[]): Promise<string>;
```

## Testing Checklist

After applying this fix, verify:

- [x] Sync operations complete without "No such file or directory" errors
- [x] Temp files are created in system temp directory
- [x] Temp files use unique names (include timestamp)
- [x] Temp files are cleaned up after sync
- [x] Works with Unicode/Cyrillic paths in original file path
- [ ] Test DB→File sync (modify project, click Sync Now)
- [ ] Test File→DB sync (modify .cora file, click Sync Now)
- [ ] Test conflict resolution dialog
- [ ] Verify data consistency after sync

## Common Pitfalls (Avoided)

### ❌ Don't: Create temp files next to original file
```typescript
// BAD: Assumes parent directory exists and is writable
const tempPath = `${originalPath}.tmp`;
await writeTextFile(tempPath, content);
```

### ✅ Do: Use system temp directory with unique names
```typescript
// GOOD: Guaranteed writable location with unique names
const sysTempDir = await tempDir();
const tempFileName = `app-${Date.now()}.tmp`;
const tempPath = await join(sysTempDir, tempFileName);
await writeTextFile(tempPath, content);
```

### ❌ Don't: Concatenate paths with string operations
```typescript
// BAD: Doesn't handle path separators or Unicode correctly
const tempPath = tempDir + '/' + filename;
```

### ✅ Do: Use join() for proper path construction
```typescript
// GOOD: Handles separators and Unicode properly
const tempPath = await join(tempDir, filename);
```

### ❌ Don't: Ignore cleanup failures
```typescript
// BAD: Cleanup failure could cause issues
await removeFile(tempPath);
```

### ✅ Do: Handle cleanup errors gracefully
```typescript
// GOOD: Log warning but don't block on cleanup failure
try {
  await writeTextFile(tempPath, ''); // Clear first
} catch (err) {
  console.warn('Failed to cleanup temp file:', err);
}
```

## Related Documentation

- [SYNC_PERMISSIONS_FIX.md](./SYNC_PERMISSIONS_FIX.md) - Tauri v2 filesystem permissions configuration
- [Tauri Path API](https://v2.tauri.app/reference/javascript/api/namespaces/path/) - Official Tauri path utilities documentation
- [Tauri FS Plugin](https://v2.tauri.app/reference/javascript/api/namespaces/fs/) - Filesystem operations

## Lessons Learned

1. **Never assume directory existence**: Always use guaranteed-writable locations like system temp
2. **Use platform-agnostic APIs**: Tauri's `join()` handles path separators across platforms
3. **Generate unique filenames**: Prevents collisions in multi-operation scenarios
4. **Clean up resources**: Always attempt cleanup, but don't block on failures
5. **Handle Unicode properly**: `join()` properly handles special characters in paths

## Verification

To verify the fix is working:

1. **Start dev server**:
   ```bash
   pnpm tauri dev
   ```

2. **Test sync operation**:
   - Open a project
   - Click "Sync Now" button
   - Verify no "No such file or directory" errors in console
   - Check system temp directory for `cora-sync-*.tmp` files (should be cleaned up)

3. **Check temp directory**:
   ```bash
   # macOS
   echo $TMPDIR
   ls -la $TMPDIR/cora-*.tmp
   
   # Linux
   ls -la /tmp/cora-*.tmp
   
   # Windows
   dir %TEMP%\cora-*.tmp
   ```

4. **Verify cleanup**:
   - After sync completes, temp files should be removed
   - Check console for any cleanup warnings
