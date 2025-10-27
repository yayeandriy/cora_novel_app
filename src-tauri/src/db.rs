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
    conn.execute_batch(include_str!("../migrations/001_create_schema.sql")).context("running migrations")?;

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
