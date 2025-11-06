# Timeline Feature - Troubleshooting

## App Frozen / Not Responding

### Issue
After adding the timeline feature, the app appears frozen with an empty project view.

### Root Cause
The timeline component tries to call new Tauri commands (`timeline_get_by_entity`, etc.) that don't exist in the currently running Rust binary because the backend hasn't been recompiled.

### Solution
Restart the Tauri development server to compile the new Rust code:

```bash
# Kill any running Tauri processes
pkill -f "tauri dev"

# Restart Tauri dev server
cd /path/to/cora-novel-app
pnpm tauri dev
```

Wait for the Rust compilation to complete (this may take 2-5 minutes on first run).

### What Was Fixed
1. **Removed blocking async calls**: Changed `ngOnInit` to not block on timeline loading
2. **Changed to promise-based**: Used `.then()/.catch()` instead of `async/await` to prevent UI blocking
3. **Graceful error handling**: Timeline loading failures are silently handled
4. **Optional loading**: Timeline component won't crash if backend isn't ready
5. **Removed OnPush**: Changed to Default change detection for more reliable updates

## Database Migration Not Applied

### Issue
Timeline features don't work even after restart.

### Check
The migration `006_add_timelines.sql` should have been applied automatically on first run.

### Manual Fix (if needed)
If the migration didn't apply:

1. Check your database location (usually in app data folder)
2. Manually run the SQL:
```sql
CREATE TABLE IF NOT EXISTS timelines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('project', 'doc', 'folder', 'event')),
    entity_id INTEGER NOT NULL,
    start_date TEXT,
    end_date TEXT,
    UNIQUE(entity_type, entity_id)
);

CREATE INDEX idx_timelines_entity ON timelines(entity_type, entity_id);
```

## Console Errors

### "Command not found: timeline_create"
- The Rust backend needs to be recompiled
- Follow the "App Frozen" solution above

### "Cannot read property 'start_date' of null"
- This is normal - timeline doesn't exist yet for the project
- The component handles this gracefully

### Angular compilation warnings
- `CharacterCardComponent is not used` - This is a pre-existing warning, not related to timeline
- Can be safely ignored

## Timeline Not Visible

### Issue
Timeline section doesn't appear in project view.

### Check
1. Ensure you're in a project view (not dashboard)
2. Check browser console for errors
3. Verify the timeline component is imported in project-view imports array

## Dates Don't Persist

### Issue  
Set dates but they disappear on reload.

### Check
1. Open browser devtools
2. Look for failed network/IPC calls
3. Check if the Rust commands are registered in `src-tauri/src/lib.rs`
4. Verify database write permissions

## Performance Issues

### Issue
App is slow after adding timeline.

### Solutions
1. Timeline component uses Default change detection - safe but may cause extra renders
2. Can optimize by changing back to OnPush after ensuring stability
3. Remove `console.log` statements in production

## Development Tips

1. **Always restart Tauri dev server** after modifying:
   - Rust files (`src-tauri/src/**/*.rs`)
   - Migrations (`src-tauri/migrations/*.sql`)
   - Tauri config files

2. **Clear browser cache** if seeing old code:
   - Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)

3. **Check both consoles**:
   - Browser console (frontend errors)
   - Terminal (Rust compile errors)

4. **Database location**:
   - macOS: `~/Library/Application Support/com.cora.novel/`
   - Linux: `~/.local/share/com.cora.novel/`
   - Windows: `%APPDATA%\com.cora.novel\`

## Known Issues

1. **First load may be slow**: Rust compilation on first run takes time
2. **Date picker quirks**: In Tauri, programmatic date picker opening may not work - inline fallback is used
3. **Change detection**: Using Default instead of OnPush for reliability

## Getting Help

If issues persist:
1. Check terminal output for Rust compilation errors
2. Check browser console for JavaScript errors
3. Verify all files were saved and server restarted
4. Try deleting `target/` folder and rebuilding from scratch
