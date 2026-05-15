use anyhow::Context;
use r2d2_sqlite::SqliteConnectionManager;
use r2d2::{Pool, PooledConnection};
use std::fs;
use std::path::Path;
use dirs::data_local_dir;

pub type DbPool = Pool<SqliteConnectionManager>;
pub type DbConn = PooledConnection<SqliteConnectionManager>;

/// Opens (or creates) the tiny recents database stored in
/// `~/Library/Application Support/cora/recents.db`.
/// Only contains the `recent_files` table — no project data.
pub fn init_recents_pool() -> anyhow::Result<DbPool> {
    let mut dir = data_local_dir()
        .ok_or_else(|| anyhow::anyhow!("failed to get app local data dir"))?;
    dir.push("cora");
    fs::create_dir_all(&dir).context("creating app data dir")?;
    dir.push("recents.db");

    let pool = Pool::new(SqliteConnectionManager::file(&dir))
        .context("creating recents r2d2 pool")?;

    let conn = pool.get().context("getting recents connection")?;
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = WAL;
         PRAGMA synchronous = NORMAL;
         PRAGMA busy_timeout = 5000;
         CREATE TABLE IF NOT EXISTS recent_files (
             path         TEXT PRIMARY KEY,
             name         TEXT NOT NULL,
             last_opened  TEXT NOT NULL
         );"
    ).context("initialising recents.db")?;

    Ok(pool)
}

/// Opens (or creates) a per-project `.cora` SQLite file and runs all
/// schema migrations against it.  Returns the connection pool.
pub fn open_project_pool(path: &Path) -> anyhow::Result<DbPool> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).context("creating project directory")?;
    }

    let pool = Pool::new(SqliteConnectionManager::file(path))
        .context("creating project r2d2 pool")?;

    let conn = pool.get().context("getting project connection")?;
    // DELETE journal mode keeps the database as a single file — important for
    // iCloud Drive, which otherwise has to sync separate -wal/-shm sidecar files.
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA journal_mode = DELETE;
         PRAGMA synchronous = NORMAL;
         PRAGMA cache_size = -32000;
         PRAGMA temp_store = MEMORY;
         PRAGMA busy_timeout = 5000;"
    ).context("setting pragmas")?;

    run_project_migrations(&conn)?;
    Ok(pool)
}

/// Runs all project schema migrations idempotently against `conn`.
pub fn run_project_migrations(conn: &DbConn) -> anyhow::Result<()> {
    conn.execute_batch(include_str!("../migrations/001_create_schema.sql"))
        .context("migration 001")?;
    conn.execute_batch(include_str!("../migrations/002_add_tree_order.sql"))
        .context("migration 002")?;
    conn.execute_batch(include_str!("../migrations/003_add_doc_notes.sql"))
        .context("migration 003")?;
    conn.execute_batch(include_str!("../migrations/004_add_doc_drafts.sql"))
        .context("migration 004")?;

    // 005 — start_date / end_date on events
    let has_start_date = col_exists(conn, "events", "start_date");
    if !has_start_date {
        conn.execute_batch(include_str!("../migrations/005_add_event_start_end.sql"))
            .context("migration 005")?;
    }

    // 006 — timelines table
    if !table_exists(conn, "timelines") {
        conn.execute_batch(include_str!("../migrations/006_add_timelines.sql"))
            .context("migration 006")?;
    }

    // 007 — project_drafts / folder_drafts
    if !table_exists(conn, "project_drafts") || !table_exists(conn, "folder_drafts") {
        conn.execute_batch(include_str!("../migrations/007_add_project_folder_drafts.sql"))
            .context("migration 007")?;
    }

    // 008 — notes column on projects
    if !col_exists(conn, "projects", "notes") {
        conn.execute_batch(include_str!("../migrations/008_add_project_notes.sql"))
            .context("migration 008")?;
    }

    // 009 — notes column on doc_groups
    if !col_exists(conn, "doc_groups", "notes") {
        conn.execute_batch(include_str!("../migrations/009_add_doc_group_notes.sql"))
            .context("migration 009")?;
    }

    // 010 — doc_group_characters
    if !table_exists(conn, "doc_group_characters") {
        conn.execute_batch(include_str!("../migrations/010_add_doc_group_characters.sql"))
            .context("migration 010")?;
    }

    // 011 — doc_group_events
    if !table_exists(conn, "doc_group_events") {
        conn.execute_batch(include_str!("../migrations/011_add_doc_group_events.sql"))
            .context("migration 011")?;
    }

    // 012 — places
    if !table_exists(conn, "places") {
        conn.execute_batch(include_str!("../migrations/012_add_places.sql"))
            .context("migration 012")?;
    }

    // 013 — sort_order on folder_drafts
    if !col_exists(conn, "folder_drafts", "sort_order") {
        conn.execute_batch(include_str!("../migrations/013_add_folder_drafts_order.sql"))
            .context("migration 013")?;
    }

    // 014 — grid_order on projects (kept for compat; unused in per-file model)
    if !col_exists(conn, "projects", "grid_order") {
        conn.execute_batch(include_str!("../migrations/014_add_project_grid_order.sql"))
            .context("migration 014")?;
    }

    // 015 — archives
    if !table_exists(conn, "archives") {
        conn.execute_batch(include_str!("../migrations/015_add_archives.sql"))
            .context("migration 015")?;
    }

    // 016 — created_at / updated_at on projects
    if !col_exists(conn, "projects", "created_at") {
        conn.execute_batch(include_str!("../migrations/016_add_project_timestamps.sql"))
            .context("migration 016")?;
    }

    // 017 — sync table (kept for compat with existing files; unused in new flow)
    if !table_exists(conn, "sync") {
        conn.execute_batch(include_str!("../migrations/017_add_sync.sql"))
            .context("migration 017")?;
    }

    Ok(())
}

fn table_exists(conn: &DbConn, name: &str) -> bool {
    conn.query_row(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?1",
        [name],
        |r| r.get::<_, i64>(0),
    ).unwrap_or(0) > 0
}

fn col_exists(conn: &DbConn, table: &str, col: &str) -> bool {
    let mut stmt = match conn.prepare(&format!("PRAGMA table_info({table})")) {
        Ok(s) => s,
        Err(_) => return false,
    };
    stmt.query_map([], |r| r.get::<_, String>(1))
        .map(|rows| rows.filter_map(|r| r.ok()).any(|c| c == col))
        .unwrap_or(false)
}

/// Helper to get a connection from any pool.
pub fn get_conn(pool: &DbPool) -> anyhow::Result<DbConn> {
    let conn = pool.get().map_err(|e| anyhow::anyhow!("pool get: {}", e))?;
    conn.execute_batch(
        "PRAGMA foreign_keys = ON;
         PRAGMA synchronous = NORMAL;
         PRAGMA cache_size = -32000;
         PRAGMA temp_store = MEMORY;
         PRAGMA busy_timeout = 5000;"
    ).context("per-connection pragmas")?;
    Ok(conn)
}
