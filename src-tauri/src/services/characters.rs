use crate::db::{DbPool, get_conn};
use crate::models::Character;
use rusqlite::OptionalExtension;
use anyhow::Context;

pub fn create(pool: &DbPool, project_id: i64, name: &str, desc: Option<String>) -> anyhow::Result<Character> {
    let mut conn = get_conn(pool)?;

    if name.trim().is_empty() {
        return Err(anyhow::anyhow!("name cannot be empty"));
    }

    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO characters (project_id, name, desc) VALUES (?1, ?2, ?3)",
        rusqlite::params![project_id, name, desc],
    ).context("inserting character")?;

    let id = tx.last_insert_rowid();
    let character = tx.query_row("SELECT id, project_id, name, desc FROM characters WHERE id = ?1", rusqlite::params![id], |row| {
        Ok(Character {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            desc: row.get(3)?,
        })
    })?;

    tx.commit()?;
    Ok(character)
}

pub fn get(pool: &DbPool, id: i64) -> anyhow::Result<Option<Character>> {
    let conn = get_conn(pool)?;
    let res = conn.query_row::<Character, _, _>("SELECT id, project_id, name, desc FROM characters WHERE id = ?1", rusqlite::params![id], |row| {
        Ok(Character {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            desc: row.get(3)?,
        })
    }).optional()?;
    Ok(res)
}

/// List all characters for a project
pub fn list(pool: &DbPool, project_id: i64) -> anyhow::Result<Vec<Character>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, desc FROM characters WHERE project_id = ?1 ORDER BY name COLLATE NOCASE"
    )?;
    let items = stmt.query_map(rusqlite::params![project_id], |row| {
        Ok(Character {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            desc: row.get(3)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    Ok(items)
}

/// Update a character
pub fn update(pool: &DbPool, id: i64, name: Option<String>, desc: Option<String>) -> anyhow::Result<Character> {
    let conn = get_conn(pool)?;
    // Fetch existing to preserve unspecified fields
    let current: Character = conn.query_row(
        "SELECT id, project_id, name, desc FROM characters WHERE id = ?1",
        rusqlite::params![id],
        |row| Ok(Character { id: row.get(0)?, project_id: row.get(1)?, name: row.get(2)?, desc: row.get(3)? })
    )?;

    let new_name = name.unwrap_or(current.name);
    let new_desc = desc.or(current.desc);

    conn.execute(
        "UPDATE characters SET name = ?1, desc = ?2 WHERE id = ?3",
        rusqlite::params![new_name, new_desc, id],
    ).context("updating character")?;

    get(pool, id).map(|opt| opt.expect("character must exist after update"))
}

/// Delete a character
pub fn delete_(pool: &DbPool, id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute("DELETE FROM characters WHERE id = ?1", rusqlite::params![id])?;
    // Cascades remove from doc_characters due to FK
    Ok(())
}

/// List character ids attached to a doc
pub fn list_for_doc(pool: &DbPool, doc_id: i64) -> anyhow::Result<Vec<i64>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT character_id FROM doc_characters WHERE doc_id = ?1 ORDER BY character_id")?;
    let ids = stmt.query_map(rusqlite::params![doc_id], |row| row.get(0))?.collect::<Result<Vec<i64>, _>>()?;
    Ok(ids)
}

/// Attach a character to a doc (idempotent)
pub fn attach_to_doc(pool: &DbPool, doc_id: i64, character_id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute(
        "INSERT OR IGNORE INTO doc_characters (doc_id, character_id) VALUES (?1, ?2)",
        rusqlite::params![doc_id, character_id],
    )?;
    Ok(())
}

/// Detach a character from a doc (idempotent)
pub fn detach_from_doc(pool: &DbPool, doc_id: i64, character_id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute(
        "DELETE FROM doc_characters WHERE doc_id = ?1 AND character_id = ?2",
        rusqlite::params![doc_id, character_id],
    )?;
    Ok(())
}

/// List character ids attached to a doc group
pub fn list_for_doc_group(pool: &DbPool, doc_group_id: i64) -> anyhow::Result<Vec<i64>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT character_id FROM doc_group_characters WHERE doc_group_id = ?1 ORDER BY character_id")?;
    let ids = stmt.query_map(rusqlite::params![doc_group_id], |row| row.get(0))?.collect::<Result<Vec<i64>, _>>()?;
    Ok(ids)
}

/// Attach a character to a doc group (idempotent)
pub fn attach_to_doc_group(pool: &DbPool, doc_group_id: i64, character_id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute(
        "INSERT OR IGNORE INTO doc_group_characters (doc_group_id, character_id) VALUES (?1, ?2)",
        rusqlite::params![doc_group_id, character_id],
    )?;
    Ok(())
}

/// Detach a character from a doc group (idempotent)
pub fn detach_from_doc_group(pool: &DbPool, doc_group_id: i64, character_id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute(
        "DELETE FROM doc_group_characters WHERE doc_group_id = ?1 AND character_id = ?2",
        rusqlite::params![doc_group_id, character_id],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use r2d2_sqlite::SqliteConnectionManager;
    use r2d2::Pool;

    fn make_pool() -> DbPool {
        let manager = SqliteConnectionManager::file("file:memchars?mode=memory&cache=shared");
        Pool::new(manager).unwrap()
    }

    #[test]
    fn character_create_get() {
        let pool = make_pool();
        let conn = pool.get().unwrap();
        conn.execute_batch(include_str!("../../migrations/001_create_schema.sql")).unwrap();

    conn.execute("INSERT INTO projects (name) VALUES (?1)", rusqlite::params!["P"]).unwrap();
    let project_id = conn.last_insert_rowid();

    let character = create(&pool, project_id, "Alice", Some("Protagonist".into())).unwrap();
    let got = get(&pool, character.id).unwrap().unwrap();
    assert_eq!(got.name, "Alice");
    }
}
