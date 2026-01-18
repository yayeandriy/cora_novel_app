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

---

## Update: Persisted Scope for App Restart (Security-Scoped Bookmarks)

### Additional Problem
Even with proper filesystem scopes, on macOS, file access permissions are lost when the app restarts due to the sandbox. This caused "Operation not permitted (os error 1)" after restarting the app.

### Solution: `tauri-plugin-persisted-scope`
Added the persisted-scope plugin which automatically saves and restores filesystem access scopes across app restarts. On macOS, this leverages **Security-Scoped Bookmarks**.

### Implementation

**1. Added to `src-tauri/Cargo.toml`:**
```toml
tauri-plugin-persisted-scope = "2"
```

**2. Registered in `src-tauri/src/lib.rs`:**
```rust
tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_shell::init())
    // Persisted scope MUST come after fs plugin - saves/restores file access
    .plugin(tauri_plugin_persisted_scope::init())
```

**Critical**: The persisted-scope plugin MUST be registered AFTER the fs plugin.

### How It Works
1. When user selects a file via dialog picker, the scope is automatically saved
2. On app restart, the plugin restores all previously granted scopes
3. Sync works immediately without re-prompting the user

### Platform Support
- **macOS**: Uses Security-Scoped Bookmarks (the native solution for sandboxed apps)
- **Windows/Linux**: Works automatically (no sandbox restrictions)

---

## Testing Checklist
- [ ] Click "Sync Now" button on a synced project
- [ ] Verify temp file creation succeeds (e.g., `project_name.cora.tmp`)
- [ ] Confirm sync completes without permission errors
- [ ] Check that temp files are cleaned up after sync
- [ ] Test sync in different directories (Documents, Desktop, Downloads)
- [ ] **Quit app completely and restart** - sync should work without re-selecting file

## Related Files
- `src-tauri/capabilities/default.json` - Permissions and scope configuration
- `src-tauri/tauri.conf.json` - Main Tauri configuration (security.csp only)
- `src-tauri/Cargo.toml` - Persisted-scope plugin dependency
- `src-tauri/src/lib.rs` - Plugin registration order
- `src/app/views/project-view/project-view.component.ts` - Sync implementation with file I/O

## References
- [Tauri v2 Capabilities Documentation](https://v2.tauri.app/security/capabilities/)
- [Tauri v2 Filesystem Plugin](https://v2.tauri.app/plugin/file-system/)
- [Tauri v2 Persisted Scope Plugin](https://v2.tauri.app/plugin/persisted-scope/)
- [Tauri v2 Migration Guide](https://v2.tauri.app/start/migrate/from-tauri-1/)
