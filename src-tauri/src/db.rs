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
