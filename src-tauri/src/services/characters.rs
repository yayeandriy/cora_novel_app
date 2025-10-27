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
