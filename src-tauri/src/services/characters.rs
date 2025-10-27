use crate::db::{DbPool, get_conn};
use crate::models::Project; // placeholder, model for Character can be added later
use rusqlite::OptionalExtension;
use anyhow::Context;

pub fn create(pool: &DbPool, project_id: i64, name: &str, desc: Option<String>) -> anyhow::Result<i64> {
    let conn = get_conn(pool)?;
    conn.execute(
        "INSERT INTO characters (project_id, name, desc) VALUES (?1, ?2, ?3)",
        rusqlite::params![project_id, name, desc],
    ).context("inserting character")?;
    Ok(conn.last_insert_rowid())
}

pub fn get(pool: &DbPool, id: i64) -> anyhow::Result<Option<(i64, i64, String, Option<String>)>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT id, project_id, name, desc FROM characters WHERE id = ?1")?;
    let res = stmt.query_row(rusqlite::params![id], |row| {
        Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
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

        let id = create(&pool, project_id, "Alice", Some("Protagonist".into())).unwrap();
        let got = get(&pool, id).unwrap().unwrap();
        assert_eq!(got.2, "Alice");
    }
}
