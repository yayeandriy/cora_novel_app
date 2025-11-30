use crate::db::{DbPool, get_conn};
use crate::models::Place;
use rusqlite::OptionalExtension;
use anyhow::Context;

pub fn create(pool: &DbPool, project_id: i64, name: &str, desc: Option<String>) -> anyhow::Result<Place> {
    let mut conn = get_conn(pool)?;

    if name.trim().is_empty() {
        return Err(anyhow::anyhow!("name cannot be empty"));
    }

    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO places (project_id, name, desc) VALUES (?1, ?2, ?3)",
        rusqlite::params![project_id, name, desc],
    ).context("inserting place")?;

    let id = tx.last_insert_rowid();
    let place = tx.query_row("SELECT id, project_id, name, desc FROM places WHERE id = ?1", rusqlite::params![id], |row| {
        Ok(Place {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            desc: row.get(3)?,
        })
    })?;

    tx.commit()?;
    Ok(place)
}

pub fn get(pool: &DbPool, id: i64) -> anyhow::Result<Option<Place>> {
    let conn = get_conn(pool)?;
    let res = conn.query_row::<Place, _, _>("SELECT id, project_id, name, desc FROM places WHERE id = ?1", rusqlite::params![id], |row| {
        Ok(Place {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            desc: row.get(3)?,
        })
    }).optional()?;
    Ok(res)
}

/// List all places for a project
pub fn list(pool: &DbPool, project_id: i64) -> anyhow::Result<Vec<Place>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, desc FROM places WHERE project_id = ?1 ORDER BY name COLLATE NOCASE"
    )?;
    let items = stmt.query_map(rusqlite::params![project_id], |row| {
        Ok(Place {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            desc: row.get(3)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(items)
}

/// Update a place
pub fn update(pool: &DbPool, id: i64, name: Option<String>, desc: Option<String>) -> anyhow::Result<Place> {
    let conn = get_conn(pool)?;
    // Fetch existing to preserve unspecified fields
    let current: Place = conn.query_row(
        "SELECT id, project_id, name, desc FROM places WHERE id = ?1",
        rusqlite::params![id],
        |row| Ok(Place { id: row.get(0)?, project_id: row.get(1)?, name: row.get(2)?, desc: row.get(3)? })
    )?;

    let new_name = name.unwrap_or(current.name);
    let new_desc = desc.or(current.desc);

    conn.execute(
        "UPDATE places SET name = ?1, desc = ?2 WHERE id = ?3",
        rusqlite::params![new_name, new_desc, id],
    ).context("updating place")?;

    get(pool, id).map(|opt| opt.expect("place must exist after update"))
}

/// Delete a place
pub fn delete_(pool: &DbPool, id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute("DELETE FROM places WHERE id = ?1", rusqlite::params![id])?;
    // Cascades remove from doc_places due to FK
    Ok(())
}

/// List place ids attached to a doc
pub fn list_for_doc(pool: &DbPool, doc_id: i64) -> anyhow::Result<Vec<i64>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT place_id FROM doc_places WHERE doc_id = ?1 ORDER BY place_id")?;
    let ids = stmt.query_map(rusqlite::params![doc_id], |row| row.get(0))?.collect::<Result<Vec<i64>, _>>()?;
    Ok(ids)
}

/// Attach a place to a doc (idempotent)
pub fn attach_to_doc(pool: &DbPool, doc_id: i64, place_id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute(
        "INSERT OR IGNORE INTO doc_places (doc_id, place_id) VALUES (?1, ?2)",
        rusqlite::params![doc_id, place_id],
    )?;
    Ok(())
}

/// Detach a place from a doc (idempotent)
pub fn detach_from_doc(pool: &DbPool, doc_id: i64, place_id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute(
        "DELETE FROM doc_places WHERE doc_id = ?1 AND place_id = ?2",
        rusqlite::params![doc_id, place_id],
    )?;
    Ok(())
}

/// List place ids attached to a doc group (directly attached to the folder)
pub fn list_for_doc_group(pool: &DbPool, doc_group_id: i64) -> anyhow::Result<Vec<i64>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT place_id FROM doc_group_places WHERE doc_group_id = ?1 ORDER BY place_id")?;
    let ids = stmt.query_map(rusqlite::params![doc_group_id], |row| row.get(0))?.collect::<Result<Vec<i64>, _>>()?;
    Ok(ids)
}

/// List all distinct place ids used in docs within a doc group (mirrored from docs)
/// This returns places attached to any document in the folder
pub fn list_from_docs_in_group(pool: &DbPool, doc_group_id: i64) -> anyhow::Result<Vec<i64>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare(
        "SELECT DISTINCT dp.place_id 
         FROM doc_places dp
         INNER JOIN docs d ON dp.doc_id = d.id
         WHERE d.doc_group_id = ?1
         ORDER BY dp.place_id"
    )?;
    let ids = stmt.query_map(rusqlite::params![doc_group_id], |row| row.get(0))?.collect::<Result<Vec<i64>, _>>()?;
    Ok(ids)
}

/// Attach a place to a doc group (idempotent)
pub fn attach_to_doc_group(pool: &DbPool, doc_group_id: i64, place_id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute(
        "INSERT OR IGNORE INTO doc_group_places (doc_group_id, place_id) VALUES (?1, ?2)",
        rusqlite::params![doc_group_id, place_id],
    )?;
    Ok(())
}

/// Detach a place from a doc group (idempotent)
pub fn detach_from_doc_group(pool: &DbPool, doc_group_id: i64, place_id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute(
        "DELETE FROM doc_group_places WHERE doc_group_id = ?1 AND place_id = ?2",
        rusqlite::params![doc_group_id, place_id],
    )?;
    Ok(())
}
