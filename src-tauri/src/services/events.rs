use crate::db::{DbPool, get_conn};
use crate::models::Event;
use anyhow::Context;
use rusqlite::OptionalExtension;

pub fn create(pool: &DbPool, project_id: i64, name: &str, desc: Option<String>, start_date: Option<String>, end_date: Option<String>, date: Option<String>) -> anyhow::Result<Event> {
    let mut conn = get_conn(pool)?;

    if name.trim().is_empty() {
        return Err(anyhow::anyhow!("name cannot be empty"));
    }

    let tx = conn.transaction()?;
    tx.execute(
        "INSERT INTO events (project_id, name, desc, date, start_date, end_date) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![project_id, name, desc, date, start_date, end_date],
    ).context("inserting event")?;

    let id = tx.last_insert_rowid();
    let event = tx.query_row("SELECT id, project_id, name, desc, date, start_date, end_date FROM events WHERE id = ?1", rusqlite::params![id], |row| {
        Ok(Event {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            desc: row.get(3)?,
            date: row.get(4)?,
            start_date: row.get(5)?,
            end_date: row.get(6)?,
        })
    })?;

    tx.commit()?;
    Ok(event)
}

pub fn get(pool: &DbPool, id: i64) -> anyhow::Result<Option<Event>> {
    let conn = get_conn(pool)?;
    let res = conn.query_row::<Event, _, _>("SELECT id, project_id, name, desc, date, start_date, end_date FROM events WHERE id = ?1", rusqlite::params![id], |row| {
        Ok(Event {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            desc: row.get(3)?,
            date: row.get(4)?,
            start_date: row.get(5)?,
            end_date: row.get(6)?,
        })
    }).optional()?;
    Ok(res)
}

pub fn list(pool: &DbPool, project_id: i64) -> anyhow::Result<Vec<Event>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT id, project_id, name, desc, date, start_date, end_date FROM events WHERE project_id = ?1 ORDER BY id ASC")?;
    let rows = stmt.query_map(rusqlite::params![project_id], |row| {
        Ok(Event {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            desc: row.get(3)?,
            date: row.get(4)?,
            start_date: row.get(5)?,
            end_date: row.get(6)?,
        })
    })?;
    let mut items = Vec::new();
    for r in rows { items.push(r?); }
    Ok(items)
}

pub fn update(pool: &DbPool, id: i64, name: Option<String>, desc: Option<String>, start_date: Option<String>, end_date: Option<String>) -> anyhow::Result<Event> {
    let conn = get_conn(pool)?;
    // Build dynamic SQL
    let mut sets: Vec<&str> = Vec::new();
    if name.is_some() { sets.push("name = COALESCE(?1, name)"); } else { sets.push("name = name"); }
    if desc.is_some() { sets.push("desc = COALESCE(?2, desc)"); } else { sets.push("desc = desc"); }
    if start_date.is_some() { sets.push("start_date = COALESCE(?3, start_date)"); } else { sets.push("start_date = start_date"); }
    if end_date.is_some() { sets.push("end_date = COALESCE(?4, end_date)"); } else { sets.push("end_date = end_date"); }
    let sql = format!("UPDATE events SET {} WHERE id = ?5", sets.join(", "));
    conn.execute(&sql, rusqlite::params![name, desc, start_date, end_date, id])?;

    let ev = conn.query_row("SELECT id, project_id, name, desc, date, start_date, end_date FROM events WHERE id = ?1", rusqlite::params![id], |row| {
        Ok(Event {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            desc: row.get(3)?,
            date: row.get(4)?,
            start_date: row.get(5)?,
            end_date: row.get(6)?,
        })
    })?;
    Ok(ev)
}

pub fn delete_(pool: &DbPool, id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute("DELETE FROM events WHERE id = ?1", rusqlite::params![id])?;
    Ok(())
}

pub fn list_for_doc(pool: &DbPool, doc_id: i64) -> anyhow::Result<Vec<i64>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT event_id FROM doc_events WHERE doc_id = ?1")?;
    let ids = stmt.query_map(rusqlite::params![doc_id], |row| row.get(0))?;
    let mut v = Vec::new();
    for id in ids { v.push(id?); }
    Ok(v)
}

pub fn attach_to_doc(pool: &DbPool, doc_id: i64, event_id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute("INSERT OR IGNORE INTO doc_events (doc_id, event_id) VALUES (?1, ?2)", rusqlite::params![doc_id, event_id])?;
    Ok(())
}

pub fn detach_from_doc(pool: &DbPool, doc_id: i64, event_id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute("DELETE FROM doc_events WHERE doc_id = ?1 AND event_id = ?2", rusqlite::params![doc_id, event_id])?;
    Ok(())
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
        // Add start/end date columns if not present (migration 005)
        let mut stmt = conn.prepare("PRAGMA table_info(events)").unwrap();
        let cols = stmt.query_map([], |row| Ok::<String, rusqlite::Error>(row.get(1)?)).unwrap();
        let mut has_start = false; let mut has_end = false;
        for c in cols { let name = c.unwrap(); if name == "start_date" { has_start = true; } if name == "end_date" { has_end = true; } }
        if !(has_start && has_end) { conn.execute_batch(include_str!("../../migrations/005_add_event_start_end.sql")).unwrap(); }

        conn.execute("INSERT INTO projects (name) VALUES (?1)", rusqlite::params!["P"]).unwrap();
        let project_id = conn.last_insert_rowid();

        let event = create(&pool, project_id, "Battle", Some("Big battle".into()), Some("2025-01-01".into()), Some("2025-01-02".into()), None).unwrap();
        let got = get(&pool, event.id).unwrap().unwrap();
        assert_eq!(got.project_id, project_id);
    }
}
