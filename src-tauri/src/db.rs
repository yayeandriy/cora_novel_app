use anyhow::Context;
use r2d2_sqlite::SqliteConnectionManager;
use r2d2::{Pool, PooledConnection};
use std::fs;
use dirs::data_local_dir;

pub type DbPool = Pool<SqliteConnectionManager>;
pub type DbConn = PooledConnection<SqliteConnectionManager>;

pub fn init_pool() -> anyhow::Result<DbPool> {
    let mut dir = data_local_dir().ok_or_else(|| anyhow::anyhow!("failed to get app local data dir"))?;
    dir.push("cora");
    fs::create_dir_all(&dir).context("creating app data dir")?;
    dir.push("app.db");

    let manager = SqliteConnectionManager::file(&dir);
    let pool = Pool::new(manager).context("creating r2d2 pool")?;

    // Configure pragmas on a connection used for migrations and warm-up.
    // These pragmas improve concurrency and performance for a desktop app.
    let conn = pool.get().context("getting connection for migrations")?;
    // Set busy timeout (ms), enable foreign keys, use WAL for better concurrency, set synchronous to NORMAL
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;\n\
         PRAGMA journal_mode = WAL;\n\
         PRAGMA synchronous = NORMAL;\n\
         PRAGMA cache_size = -64000; -- use approx 64MB page cache (negative = KB)\n\
         PRAGMA temp_store = MEMORY;\n\
         PRAGMA busy_timeout = 5000;"
    ).context("setting pragmas")?;

    // Run initial migrations (idempotent)
    conn.execute_batch(include_str!("../migrations/001_create_schema.sql")).context("running migrations 001")?;
    conn.execute_batch(include_str!("../migrations/002_add_tree_order.sql")).context("running migrations 002")?;
    conn.execute_batch(include_str!("../migrations/003_add_doc_notes.sql")).context("running migrations 003")?;
    conn.execute_batch(include_str!("../migrations/004_add_doc_drafts.sql")).context("running migrations 004")?;

    // Conditionally run 005: add start_date/end_date to events if missing
    let mut stmt = conn.prepare("PRAGMA table_info(events)")?;
    let cols = stmt.query_map([], |row| Ok::<String, rusqlite::Error>(row.get(1)?))?;
    let mut has_start = false;
    let mut has_end = false;
    for c in cols { let name = c?; if name == "start_date" { has_start = true; } if name == "end_date" { has_end = true; } }
    if !(has_start && has_end) {
        conn.execute_batch(include_str!("../migrations/005_add_event_start_end.sql")).context("running migrations 005")?;
    }

    // Conditionally run 006: create timelines table if missing
    let table_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='timelines'",
        [],
        |row| row.get(0)
    ).unwrap_or(0) > 0;
    
    if !table_exists {
        conn.execute_batch(include_str!("../migrations/006_add_timelines.sql")).context("running migrations 006")?;
    }

    // Conditionally run 007: project_drafts and folder_drafts
    let drafts_tables_missing: bool = conn.query_row(
        "SELECT (
            (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='project_drafts') = 0
         ) OR (
            (SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='folder_drafts') = 0
         )",
        [],
        |row| row.get::<_, i64>(0)
    ).unwrap_or(1) != 0; // treat error as missing

    if drafts_tables_missing {
        conn.execute_batch(include_str!("../migrations/007_add_project_folder_drafts.sql")).context("running migrations 007")?;
    }

    // Conditionally run 008: add notes column to projects
    let mut stmt = conn.prepare("PRAGMA table_info(projects)")?;
    let cols = stmt.query_map([], |row| Ok::<String, rusqlite::Error>(row.get(1)?))?;
    let mut has_notes = false;
    for c in cols { let name = c?; if name == "notes" { has_notes = true; break; } }
    if !has_notes {
        conn.execute_batch(include_str!("../migrations/008_add_project_notes.sql")).context("running migrations 008")?;
    }

    // Conditionally run 009: add notes column to doc_groups
    let mut stmt = conn.prepare("PRAGMA table_info(doc_groups)")?;
    let cols = stmt.query_map([], |row| Ok::<String, rusqlite::Error>(row.get(1)?))?;
    let mut has_group_notes = false;
    for c in cols { let name = c?; if name == "notes" { has_group_notes = true; break; } }
    if !has_group_notes {
        conn.execute_batch(include_str!("../migrations/009_add_doc_group_notes.sql")).context("running migrations 009")?;
    }

    // Conditionally run 010: create doc_group_characters table
    let table_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='doc_group_characters'",
        [],
        |row| row.get(0)
    ).unwrap_or(0) > 0;
    
    if !table_exists {
        conn.execute_batch(include_str!("../migrations/010_add_doc_group_characters.sql")).context("running migrations 010")?;
    }

    // Conditionally run 011: create doc_group_events table
    let table_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='doc_group_events'",
        [],
        |row| row.get(0)
    ).unwrap_or(0) > 0;
    
    if !table_exists {
        conn.execute_batch(include_str!("../migrations/011_add_doc_group_events.sql")).context("running migrations 011")?;
    }

    // Conditionally run 012: create places, doc_places, and doc_group_places tables
    let table_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='places'",
        [],
        |row| row.get(0)
    ).unwrap_or(0) > 0;
    
    if !table_exists {
        conn.execute_batch(include_str!("../migrations/012_add_places.sql")).context("running migrations 012")?;
    }

    // Conditionally run 013: add sort_order column to folder_drafts
    let mut stmt = conn.prepare("PRAGMA table_info(folder_drafts)")?;
    let cols = stmt.query_map([], |row| Ok::<String, rusqlite::Error>(row.get(1)?))?;
    let mut has_sort_order = false;
    for c in cols { let name = c?; if name == "sort_order" { has_sort_order = true; break; } }
    if !has_sort_order {
        conn.execute_batch(include_str!("../migrations/013_add_folder_drafts_order.sql")).context("running migrations 013")?;
    }

    // Conditionally run 014: add grid_order column to projects
    let mut stmt = conn.prepare("PRAGMA table_info(projects)")?;
    let cols = stmt.query_map([], |row| Ok::<String, rusqlite::Error>(row.get(1)?))?;
    let mut has_grid_order = false;
    for c in cols { let name = c?; if name == "grid_order" { has_grid_order = true; break; } }
    if !has_grid_order {
        conn.execute_batch(include_str!("../migrations/014_add_project_grid_order.sql")).context("running migrations 014")?;
    }

    // Conditionally run 015: create archives table
    let table_exists: bool = conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='archives'",
        [],
        |row| row.get(0)
    ).unwrap_or(0) > 0;
    
    if !table_exists {
        conn.execute_batch(include_str!("../migrations/015_add_archives.sql")).context("running migrations 015")?;
    }

    // Conditionally run 016: add created_at and updated_at timestamps to projects
    let mut stmt = conn.prepare("PRAGMA table_info(projects)")?;
    let cols = stmt.query_map([], |row| Ok::<String, rusqlite::Error>(row.get(1)?))?;
    let mut has_created_at = false;
    let mut has_updated_at = false;
    for c in cols { let name = c?; if name == "created_at" { has_created_at = true; } if name == "updated_at" { has_updated_at = true; } }
    if !(has_created_at && has_updated_at) {
        conn.execute_batch(include_str!("../migrations/016_add_project_timestamps.sql")).context("running migrations 016")?;
    }

    Ok(pool)
}

// Helper to get a connection (maps errors to anyhow)
pub fn get_conn(pool: &DbPool) -> anyhow::Result<DbConn> {
    // Get a pooled connection and apply per-connection PRAGMA settings to ensure
    // each connection has the recommended runtime configuration.
    let conn = pool.get().map_err(|e| anyhow::anyhow!("pool get error: {}", e))?;
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;\n\
         PRAGMA synchronous = NORMAL;\n\
         PRAGMA cache_size = -64000;\n\
         PRAGMA temp_store = MEMORY;\n\
         PRAGMA busy_timeout = 5000;"
    ).context("setting per-connection pragmas")?;

    Ok(conn)
}
