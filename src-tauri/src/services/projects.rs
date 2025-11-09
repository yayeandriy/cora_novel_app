use crate::db::{DbPool, get_conn};
use crate::models::{Project, ProjectCreate};
use rusqlite::OptionalExtension;
use anyhow::Context;

pub fn create(pool: &DbPool, payload: ProjectCreate) -> anyhow::Result<Project> {
    let conn = get_conn(pool)?;
    conn.execute(
        "INSERT INTO projects (name, desc, path, notes) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![payload.name, payload.desc, payload.path, payload.notes],
    )
    .context("inserting project")?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare("SELECT id, name, desc, path, notes, timeline_start, timeline_end FROM projects WHERE id = ?1")?;
    let project = stmt
        .query_row(rusqlite::params![id], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                desc: row.get(2)?,
                path: row.get(3)?,
                notes: row.get(4)?,
                timeline_start: row.get(5)?,
                timeline_end: row.get(6)?,
            })
        })
        .context("querying created project")?;

    Ok(project)
}

pub fn get(pool: &DbPool, id: i64) -> anyhow::Result<Option<Project>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT id, name, desc, path, notes, timeline_start, timeline_end FROM projects WHERE id = ?1")?;
    let res = stmt.query_row(rusqlite::params![id], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            desc: row.get(2)?,
            path: row.get(3)?,
            notes: row.get(4)?,
            timeline_start: row.get(5)?,
            timeline_end: row.get(6)?,
        })
    }).optional()?;

    Ok(res)
}

pub fn list(pool: &DbPool) -> anyhow::Result<Vec<Project>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT id, name, desc, path, notes, timeline_start, timeline_end FROM projects ORDER BY id")?;
    let rows = stmt.query_map([], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            desc: row.get(2)?,
            path: row.get(3)?,
            notes: row.get(4)?,
            timeline_start: row.get(5)?,
            timeline_end: row.get(6)?,
        })
    })?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn update(pool: &DbPool, id: i64, name: Option<String>, desc: Option<String>, path: Option<String>, notes: Option<String>) -> anyhow::Result<Project> {
    // Ensure project exists
    let existing = get(pool, id)?;
    let existing = existing.ok_or_else(|| anyhow::anyhow!("project not found"))?;

    let mut conn = get_conn(pool)?;
    let tx = conn.transaction()?;

    // Prepare updates; use current values as fallback
    let new_name = name.unwrap_or(existing.name);
    if new_name.trim().is_empty() {
        return Err(anyhow::anyhow!("name cannot be empty"));
    }
    let new_desc = desc.or(existing.desc);
    let new_path = path.or(existing.path);
    let new_notes = notes.or(existing.notes);

    tx.execute(
        "UPDATE projects SET name = ?1, desc = ?2, path = ?3, notes = ?4 WHERE id = ?5",
        rusqlite::params![new_name, new_desc, new_path, new_notes, id],
    )?;

    tx.commit()?;
    // Return updated
    get(pool, id).and_then(|opt| opt.ok_or_else(|| anyhow::anyhow!("not found after update")))
}

pub fn delete(pool: &DbPool, id: i64) -> anyhow::Result<bool> {
    let mut conn = get_conn(pool)?;
    let tx = conn.transaction()?;
    // ensure exists
    let exists = tx.query_row::<i64, _, _>("SELECT id FROM projects WHERE id = ?1", rusqlite::params![id], |r| r.get(0)).optional()?;
    if exists.is_none() {
        return Ok(false);
    }
    let affected = tx.execute("DELETE FROM projects WHERE id = ?1", rusqlite::params![id])?;
    tx.commit()?;
    Ok(affected > 0)
}
