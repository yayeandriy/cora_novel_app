use crate::db::{DbPool, get_conn};
use crate::models::Event;
use anyhow::Context;
use rusqlite::OptionalExtension;

pub fn create(pool: &DbPool, project_id: i64, name: &str, desc: Option<String>, date: Option<String>) -> anyhow::Result<Event> {
    let mut conn = get_conn(pool)?;

    if name.trim().is_empty() {
        return Err(anyhow::anyhow!("name cannot be empty"));
    }

    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO events (project_id, name, desc, date) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![project_id, name, desc, date],
    ).context("inserting event")?;

    let id = tx.last_insert_rowid();
    let event = tx.query_row("SELECT id, project_id, name, desc, date FROM events WHERE id = ?1", rusqlite::params![id], |row| {
        Ok(Event {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            desc: row.get(3)?,
            date: row.get(4)?,
        })
    })?;

    tx.commit()?;
    Ok(event)
}

pub fn get(pool: &DbPool, id: i64) -> anyhow::Result<Option<Event>> {
    let conn = get_conn(pool)?;
    let res = conn.query_row::<Event, _, _>("SELECT id, project_id, name, desc, date FROM events WHERE id = ?1", rusqlite::params![id], |row| {
        Ok(Event {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            desc: row.get(3)?,
            date: row.get(4)?,
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
        let manager = SqliteConnectionManager::file("file:memevents?mode=memory&cache=shared");
        Pool::new(manager).unwrap()
    }

    #[test]
    fn event_create_get() {
        let pool = make_pool();
        let conn = pool.get().unwrap();
        conn.execute_batch(include_str!("../../migrations/001_create_schema.sql")).unwrap();

        conn.execute("INSERT INTO projects (name) VALUES (?1)", rusqlite::params!["P"]).unwrap();
        let project_id = conn.last_insert_rowid();

        let event = create(&pool, project_id, "Battle", Some("Big battle".into()), Some("2025-01-01".into())).unwrap();
        let got = get(&pool, event.id).unwrap().unwrap();
        assert_eq!(got.project_id, project_id);
    }
}
