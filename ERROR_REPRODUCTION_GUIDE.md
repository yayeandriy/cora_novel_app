# Error Reproduction: "no such column: name"

## The Error

From the screenshots provided, we see two related errors:

```
Failed to load drafts: — "no such column: name"
Failed to create draft: — "creating draft"
```

## Root Cause

The database has an **old schema** that was created by Migration 001:

```sql
-- OLD SCHEMA (Migration 001)
CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id INTEGER NOT NULL,
    text TEXT NOT NULL,          -- OLD: was "text", not "name"
    created_at TEXT NOT NULL
    -- MISSING: updated_at, and name column
)
```

But the **backend code expects a NEW schema** with different columns:

```rust
// Backend code in drafts.rs (lines 11-14)
conn.execute(
    "INSERT INTO drafts (doc_id, name, content, created_at, updated_at) 
     VALUES (?1, ?2, ?3, ?4, ?5)",
    rusqlite::params![doc_id, req.name, req.content, now, now],
)
```

The code tries to insert into columns `name` and `updated_at` which don't exist in the old schema.

## Why Migration 004 Didn't Fix It

Migration 004 was supposed to create the new schema:

```sql
-- Migration 004 attempt
CREATE TABLE IF NOT EXISTS drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    ...
)
```

**But it has no effect** because:
- The `IF NOT EXISTS` clause means "skip if table already exists"
- Migration 001 already created the `drafts` table
- So Migration 004 is completely skipped
- The old schema persists

## The Migration Sequence Problem

```
1. Migration 001: CREATE TABLE IF NOT EXISTS drafts (...old schema...)
   ✅ Creates table with id, doc_id, text, created_at

2. Migration 002: (no changes to drafts)
   
3. Migration 003: (no changes to drafts)

4. Migration 004: CREATE TABLE IF NOT EXISTS drafts (...new schema...)
   ❌ SKIPPED! Table already exists from migration 001

Result: Database still has old schema!
```

### Fix: Clean Database Before Running

The most reliable solution is to clean the database files before running the app:

**macOS:**
```bash
rm -f ~/Library/Application\ Support/cora/app.db*
```

**Linux/Windows:**
```bash
rm -f ~/.local/share/cora/app.db*
```

Then start the app:
```bash
pnpm tauri dev
```

The app will automatically recreate the database with all migrations in the correct order, creating the proper schema with the new `name` and `updated_at` columns.

## Verification Checklist

- ✅ Migration 001: No longer creates old drafts table
- ✅ Migration 004: Creates new drafts table with correct schema
- ✅ Backend tests: All 16 tests passing (uses in-memory DB with migrations)
- ✅ Frontend unit tests: All 45 tests passing
- ✅ Frontend code: Already correctly using `name` and `updated_at`
- ✅ Build: Successful
- ⚠️ Running app: **Requires database cleanup** (`rm -f ~/.local/share/cora/app.db*`)

## Next Steps

1. ✅ **Backend Fix**: Update Migration 001 to remove old drafts table (DONE)
2. ✅ **Backend Tests**: Verify all 16 tests still pass (DONE)
3. ✅ **Frontend Code**: Already correct (DONE)
4. ✅ **Frontend Tests**: All 45 tests passing (DONE)
5. 🔄 **Running App**: 
   - Clean database: `rm -f ~/.local/share/cora/app.db*`
   - Start app: `pnpm tauri dev`
   - Test drafts feature in UI

## Error Messages Decoded

| Error | Cause | Solution |
|-------|-------|----------|
| `"no such column: name"` | INSERT references `name` which doesn't exist in old schema | Remove old drafts table from migration 001 |
| `"Failed to load drafts"` | SELECT tries to fetch `name` column which doesn't exist | Same solution |
| `"creating draft"` | The context error message from backend when INSERT fails | Same solution |

## Summary

The **"no such column: name"** error occurs because:
1. ❌ Old database has wrong schema from Migration 001
2. ❌ Migration 004 can't fix it (IF NOT EXISTS skips it)
3. ✅ Solution: Remove old definition from Migration 001
4. ✅ Then Migration 004 creates correct schema on next app run
