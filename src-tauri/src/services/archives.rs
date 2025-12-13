use crate::db::{DbPool, get_conn};
use crate::models::{Archive, ArchiveCreate, ArchiveUpdate};
use rusqlite::OptionalExtension;
use anyhow::Context;

pub fn create(pool: &DbPool, project_id: i64, payload: ArchiveCreate) -> anyhow::Result<Archive> {
    let mut conn = get_conn(pool)?;

    if payload.name.trim().is_empty() {
        return Err(anyhow::anyhow!("name cannot be empty"));
    }

    let tx = conn.transaction()?;
    
    if let Some(archived_at) = &payload.archived_at {
        tx.execute(
            "INSERT INTO archives (project_id, name, desc, archived_at) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![project_id, payload.name, payload.desc, archived_at],
        ).context("inserting archive with archived_at")?;
    } else {
        tx.execute(
            "INSERT INTO archives (project_id, name, desc) VALUES (?1, ?2, ?3)",
            rusqlite::params![project_id, payload.name, payload.desc],
        ).context("inserting archive")?;
    }

    let id = tx.last_insert_rowid();
    let archive = tx.query_row(
        "SELECT id, project_id, name, desc, created_at, archived_at FROM archives WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Archive {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                desc: row.get(3)?,
                created_at: row.get(4)?,
                archived_at: row.get(5)?,
            })
        }
    )?;

    tx.commit()?;
    Ok(archive)
}

pub fn get(pool: &DbPool, id: i64) -> anyhow::Result<Option<Archive>> {
    let conn = get_conn(pool)?;
    let res = conn.query_row::<Archive, _, _>(
        "SELECT id, project_id, name, desc, created_at, archived_at FROM archives WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Archive {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                desc: row.get(3)?,
                created_at: row.get(4)?,
                archived_at: row.get(5)?,
            })
        }
    ).optional()?;
    Ok(res)
}

/// List all archives for a project
pub fn list(pool: &DbPool, project_id: i64) -> anyhow::Result<Vec<Archive>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, desc, created_at, archived_at FROM archives 
         WHERE project_id = ?1 ORDER BY created_at DESC"
    )?;
    let items = stmt.query_map(rusqlite::params![project_id], |row| {
        Ok(Archive {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            desc: row.get(3)?,
            created_at: row.get(4)?,
            archived_at: row.get(5)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(items)
}

/// Update an archive
pub fn update(pool: &DbPool, id: i64, payload: ArchiveUpdate) -> anyhow::Result<Archive> {
    let conn = get_conn(pool)?;
    
    // Fetch existing to preserve unspecified fields
    let current: Archive = conn.query_row(
        "SELECT id, project_id, name, desc, created_at, archived_at FROM archives WHERE id = ?1",
        rusqlite::params![id],
        |row| {
            Ok(Archive {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                desc: row.get(3)?,
                created_at: row.get(4)?,
                archived_at: row.get(5)?,
            })
        }
    )?;

    let new_name = payload.name.unwrap_or(current.name);
    let new_desc = payload.desc.or(current.desc);
    let new_archived_at = payload.archived_at.or(current.archived_at);

    conn.execute(
        "UPDATE archives SET name = ?1, desc = ?2, archived_at = ?3 WHERE id = ?4",
        rusqlite::params![new_name, new_desc, new_archived_at, id],
    ).context("updating archive")?;

    get(pool, id)?.ok_or_else(|| anyhow::anyhow!("archive not found after update"))
}

/// Delete an archive
pub fn delete(pool: &DbPool, id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute("DELETE FROM archives WHERE id = ?1", rusqlite::params![id])
        .context("deleting archive")?;
    Ok(())
}
