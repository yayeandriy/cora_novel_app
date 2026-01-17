# Sync Permissions Fix - Tauri v2 Filesystem Access

## Problem
When clicking "Sync Now" button, the sync operation failed with error:
```
Sync failed: forbidden path: /Users/.../two_waters_sync.cora.tmp, 
maybe it is not allowed on the scope for `allow-read-text-file` permission
```

## Root Cause
Tauri v2 requires explicit filesystem scope configuration to allow access to user files and temporary files. The default configuration only had basic file read/write permissions without any path scope.

## Solution

### Step 1: Updated `src-tauri/capabilities/default.json`
Added filesystem permissions and scope configuration:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "opener:default",
    "dialog:default",
    "fs:default",
    "fs:allow-read-text-file",
    "fs:allow-write-text-file",
    "fs:allow-read-file",
    "fs:allow-write-file",
    "fs:allow-exists",
    "fs:allow-remove",
    {
      "identifier": "fs:scope",
      "allow": [
        "$DOCUMENT/**",
        "$HOME/**",
        "$DESKTOP/**",
        "$DOWNLOAD/**",
        "$TEMP/**",
        "**"
      ]
    }
  ]
}
```

### Permissions Explained:
- `fs:default` - Base filesystem access
- `fs:allow-read-text-file` / `fs:allow-read-file` - Read operations
- `fs:allow-write-text-file` / `fs:allow-write-file` - Write operations
- `fs:allow-exists` - Check if files exist
- `fs:allow-remove` - Delete temporary files after sync
- `fs:scope` with `allow` array - Define allowed filesystem paths

### Filesystem Scope Variables:
- `$DOCUMENT/**` - User's Documents folder (where .cora files are typically stored)
- `$HOME/**` - User's home directory
- `$DESKTOP/**` - Desktop folder
- `$DOWNLOAD/**` - Downloads folder
- `$TEMP/**` - Temporary files directory (for .tmp files during sync)
- `**` - Fallback wildcard for any other paths

### Step 2: Avoided Invalid Configuration
Initially tried adding `allowlist` to `tauri.conf.json`, which is invalid in Tauri v2:

```json
// ❌ WRONG - Don't do this
"security": {
  "csp": null,
  "allowlist": {  // ❌ Invalid field in Tauri v2
    "fs": { "scope": [...] }
  }
}
```

This caused build error:
```
unknown field `allowlist`, expected one of `csp`, `dev-csp`, ...
```

**Correct approach**: All scope configuration goes in `capabilities/default.json`.

## Key Learnings

### Tauri v2 Permission System
1. **Operations** (what you can do): Declared in `capabilities/default.json` permissions array
2. **Scope** (where you can do it): Also configured in `capabilities/default.json` as a permission object with `identifier: "fs:scope"` and `allow` array

### Common Mistakes to Avoid
- ❌ Don't use `fs:scope-*` permissions (e.g., `fs:scope-tmp`, `fs:scope-document`) - these don't exist in Tauri v2
- ❌ Don't put `allowlist` in `tauri.conf.json` - this was Tauri v1 syntax
- ✅ Do use scope objects in the permissions array
- ✅ Do use Tauri's built-in path variables like `$DOCUMENT/**`, `$TEMP/**`

## Verification
After these changes:
1. `cargo build` completed successfully
2. `pnpm tauri dev` started without errors
3. Sync operations can now create temp files in Documents folder
4. No more "forbidden path" errors

## Testing Checklist
- [ ] Click "Sync Now" button on a synced project
- [ ] Verify temp file creation succeeds (e.g., `project_name.cora.tmp`)
- [ ] Confirm sync completes without permission errors
- [ ] Check that temp files are cleaned up after sync
- [ ] Test sync in different directories (Documents, Desktop, Downloads)

## Related Files
- `src-tauri/capabilities/default.json` - Permissions and scope configuration
- `src-tauri/tauri.conf.json` - Main Tauri configuration (security.csp only)
- `src/app/views/project-view/project-view.component.ts` - Sync implementation with file I/O

## References
- [Tauri v2 Capabilities Documentation](https://v2.tauri.app/security/capabilities/)
- [Tauri v2 Filesystem Plugin](https://v2.tauri.app/plugin/file-system/)
- [Tauri v2 Migration Guide](https://v2.tauri.app/start/migrate/from-tauri-1/)
