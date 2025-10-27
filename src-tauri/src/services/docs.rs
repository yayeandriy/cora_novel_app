use crate::db::{DbPool, get_conn};
use crate::models::Doc;
use rusqlite::OptionalExtension;
use anyhow::Context;

pub fn create(pool: &DbPool, project_id: i64, path: &str, name: Option<String>, timeline_id: Option<i64>, text: Option<String>) -> anyhow::Result<Doc> {
    let conn = get_conn(pool)?;
    conn.execute(
        "INSERT INTO docs (project_id, path, name, timeline_id, text) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![project_id, path, name, timeline_id, text],
    ).context("inserting doc")?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare("SELECT id, project_id, path, name, timeline_id, text FROM docs WHERE id = ?1")?;
    let doc = stmt.query_row(rusqlite::params![id], |row| {
        Ok(Doc {
            id: row.get(0)?,
            project_id: row.get(1)?,
            path: row.get(2)?,
            name: row.get(3)?,
            timeline_id: row.get(4)?,
            text: row.get(5)?,
        })
    }).context("querying created doc")?;

    Ok(doc)
}

pub fn get(pool: &DbPool, id: i64) -> anyhow::Result<Option<Doc>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT id, project_id, path, name, timeline_id, text FROM docs WHERE id = ?1")?;
    let res = stmt.query_row(rusqlite::params![id], |row| {
        Ok(Doc {
            id: row.get(0)?,
            project_id: row.get(1)?,
            path: row.get(2)?,
            name: row.get(3)?,
            timeline_id: row.get(4)?,
            text: row.get(5)?,
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
        let manager = SqliteConnectionManager::file("file:memdocs?mode=memory&cache=shared");
        Pool::new(manager).unwrap()
    }

    #[test]
    fn doc_create_get() {
        let pool = make_pool();
        let conn = pool.get().unwrap();
        conn.execute_batch(include_str!("../../migrations/001_create_schema.sql")).unwrap();

        // need a project to reference
        conn.execute("INSERT INTO projects (name) VALUES (?1)", rusqlite::params!["P"]).unwrap();
        let project_id = conn.last_insert_rowid();

        let doc = create(&pool, project_id, "notes/ch1.md", Some("Chapter 1".into()), None, Some("hello".into())).unwrap();
        assert_eq!(doc.project_id, project_id);
        let got = get(&pool, doc.id).unwrap().unwrap();
        assert_eq!(got.path, "notes/ch1.md");
    }
}
