use crate::db::{DbPool, get_conn};
use crate::models::{Project, ProjectCreate};
use rusqlite::OptionalExtension;
use anyhow::Context;

pub fn create(pool: &DbPool, payload: ProjectCreate) -> anyhow::Result<Project> {
    let conn = get_conn(pool)?;
    conn.execute(
        "INSERT INTO projects (name, desc, path) VALUES (?1, ?2, ?3)",
        rusqlite::params![payload.name, payload.desc, payload.path],
    )
    .context("inserting project")?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare("SELECT id, name, desc, path, timeline_start, timeline_end FROM projects WHERE id = ?1")?;
    let project = stmt
        .query_row(rusqlite::params![id], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                desc: row.get(2)?,
                path: row.get(3)?,
                timeline_start: row.get(4)?,
                timeline_end: row.get(5)?,
            })
        })
        .context("querying created project")?;

    Ok(project)
}

pub fn get(pool: &DbPool, id: i64) -> anyhow::Result<Option<Project>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT id, name, desc, path, timeline_start, timeline_end FROM projects WHERE id = ?1")?;
    let res = stmt.query_row(rusqlite::params![id], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            desc: row.get(2)?,
            path: row.get(3)?,
            timeline_start: row.get(4)?,
            timeline_end: row.get(5)?,
        })
    }).optional()?;

    Ok(res)
}

pub fn list(pool: &DbPool) -> anyhow::Result<Vec<Project>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT id, name, desc, path, timeline_start, timeline_end FROM projects ORDER BY id")?;
    let rows = stmt.query_map([], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            desc: row.get(2)?,
            path: row.get(3)?,
            timeline_start: row.get(4)?,
            timeline_end: row.get(5)?,
        })
    })?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn update(pool: &DbPool, id: i64, name: Option<String>, desc: Option<String>, path: Option<String>) -> anyhow::Result<Project> {
    let conn = get_conn(pool)?;
    // Build update dynamically
    let mut parts = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    if let Some(n) = name {
        parts.push("name = ?");
        params.push(Box::new(n));
    }
    if let Some(d) = desc {
        parts.push("desc = ?");
        params.push(Box::new(d));
    }
    if let Some(p) = path {
        parts.push("path = ?");
        params.push(Box::new(p));
    }

    if parts.is_empty() {
        // Nothing to do, just return current
        return get(pool, id).and_then(|opt| opt.ok_or_else(|| anyhow::anyhow!("not found")));
    }

    let sql = format!("UPDATE projects SET {} WHERE id = ?", parts.join(", "));
    // push id param
    params.push(Box::new(id));

    // Convert params to slice
    let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|b| &**b as &dyn rusqlite::ToSql).collect();
    conn.execute(&sql, params_refs.as_slice())?;

    get(pool, id).and_then(|opt| opt.ok_or_else(|| anyhow::anyhow!("not found after update")))
}

pub fn delete(pool: &DbPool, id: i64) -> anyhow::Result<bool> {
    let conn = get_conn(pool)?;
    let affected = conn.execute("DELETE FROM projects WHERE id = ?1", rusqlite::params![id])?;
    Ok(affected > 0)
}
