//! Recent files list stored in `recents.db`.

use crate::db::DbPool;
use crate::models::RecentFile;
use anyhow::Result;

/// Add or refresh a recent file entry (upsert on path).
pub fn touch(pool: &DbPool, path: &str, name: &str) -> Result<()> {
    let conn = crate::db::get_conn(pool)?;
    let now = chrono::Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO recent_files (path, name, last_opened) VALUES (?1, ?2, ?3)
         ON CONFLICT(path) DO UPDATE SET name=excluded.name, last_opened=excluded.last_opened",
        rusqlite::params![path, name, now],
    )?;
    Ok(())
}

/// Return recent files ordered by most-recently opened first, max 20.
pub fn list(pool: &DbPool) -> Result<Vec<RecentFile>> {
    let conn = crate::db::get_conn(pool)?;
    let mut stmt = conn.prepare(
        "SELECT path, name, last_opened FROM recent_files ORDER BY last_opened DESC LIMIT 20",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(RecentFile {
            path: r.get(0)?,
            name: r.get(1)?,
            last_opened: r.get(2)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

/// Remove a recent file entry (e.g. when the file no longer exists).
pub fn remove(pool: &DbPool, path: &str) -> Result<()> {
    let conn = crate::db::get_conn(pool)?;
    conn.execute("DELETE FROM recent_files WHERE path = ?1", [path])?;
    Ok(())
}
