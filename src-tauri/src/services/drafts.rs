use crate::db::DbPool;
use crate::models::{Draft, DraftCreate, DraftUpdate};
use anyhow::Context;
use chrono::Utc;
use rusqlite::OptionalExtension;

pub fn create_draft(pool: &DbPool, doc_id: i64, req: DraftCreate) -> anyhow::Result<Draft> {
    let conn = pool.get()?;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO drafts (doc_id, name, content, created_at, updated_at) 
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![doc_id, req.name, req.content, now, now],
    )
    .context("creating draft")?;

    let draft_id = conn.last_insert_rowid();
    get_draft(pool, draft_id)
        .context("fetching created draft")?
        .context("draft not found after creation")
}

pub fn get_draft(pool: &DbPool, id: i64) -> anyhow::Result<Option<Draft>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT id, doc_id, name, content, created_at, updated_at FROM drafts WHERE id = ?1",
    )?;

    let draft = stmt
        .query_row(rusqlite::params![id], |row| {
            Ok(Draft {
                id: row.get(0)?,
                doc_id: row.get(1)?,
                name: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })
        .optional()?;

    Ok(draft)
}

pub fn list_drafts(pool: &DbPool, doc_id: i64) -> anyhow::Result<Vec<Draft>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare(
        "SELECT id, doc_id, name, content, created_at, updated_at 
         FROM drafts 
         WHERE doc_id = ?1 
         ORDER BY created_at DESC",
    )?;

    let drafts = stmt
        .query_map(rusqlite::params![doc_id], |row| {
            Ok(Draft {
                id: row.get(0)?,
                doc_id: row.get(1)?,
                name: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(drafts)
}

pub fn update_draft(pool: &DbPool, id: i64, req: DraftUpdate) -> anyhow::Result<Draft> {
    let conn = pool.get()?;
    let now = Utc::now().to_rfc3339();

    // Get current draft
    let current = get_draft(pool, id)?
        .context("draft not found")?;

    let new_name = req.name.unwrap_or(current.name);
    let new_content = req.content.unwrap_or(current.content);

    conn.execute(
        "UPDATE drafts SET name = ?1, content = ?2, updated_at = ?3 WHERE id = ?4",
        rusqlite::params![new_name, new_content, now, id],
    )
    .context("updating draft")?;

    get_draft(pool, id)?
        .context("draft not found after update")
}

pub fn delete_draft(pool: &DbPool, id: i64) -> anyhow::Result<()> {
    let conn = pool.get()?;
    let result = conn.execute("DELETE FROM drafts WHERE id = ?1", rusqlite::params![id])
        .context("deleting draft")?;

    if result == 0 {
        anyhow::bail!("draft not found");
    }

    Ok(())
}

pub fn restore_draft_to_doc(pool: &DbPool, draft_id: i64) -> anyhow::Result<()> {
    let conn = pool.get()?;

    // Get the draft
    let draft = get_draft(pool, draft_id)?
        .context("draft not found")?;

    // Update the document's text with draft content
    conn.execute(
        "UPDATE docs SET text = ?1 WHERE id = ?2",
        rusqlite::params![draft.content, draft.doc_id],
    )
    .context("restoring draft to document")?;

    Ok(())
}

pub fn delete_all_drafts_for_doc(pool: &DbPool, doc_id: i64) -> anyhow::Result<()> {
    let conn = pool.get()?;
    conn.execute("DELETE FROM drafts WHERE doc_id = ?1", rusqlite::params![doc_id])
        .context("deleting all drafts for document")?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use r2d2_sqlite::SqliteConnectionManager;
    use r2d2::Pool;
    use std::sync::atomic::{AtomicUsize, Ordering};

    static TEST_COUNTER: AtomicUsize = AtomicUsize::new(0);

    fn make_pool() -> DbPool {
        let id = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);
        let db_name = format!("file:memdraft{}?mode=memory&cache=shared", id);
        let manager = SqliteConnectionManager::file(&db_name);
        Pool::new(manager).unwrap()
    }

    #[allow(dead_code)]
    fn init_schema(conn: &rusqlite::Connection) {
        // execute_batch properly handles transactions
        conn.execute_batch(include_str!("../../migrations/001_create_schema.sql"))
            .expect("Failed to execute migration 001");
        conn.execute_batch(include_str!("../../migrations/002_add_tree_order.sql"))
            .expect("Failed to execute migration 002");
        conn.execute_batch(include_str!("../../migrations/003_add_doc_notes.sql"))
            .expect("Failed to execute migration 003");
        conn.execute_batch(include_str!("../../migrations/004_add_doc_drafts.sql"))
            .expect("Failed to execute migration 004");
        conn.execute_batch("PRAGMA foreign_keys = ON;")
            .expect("Failed to enable foreign keys");
    }

    #[test]
    fn test_create_draft() {
        let pool = make_pool();
        let conn = pool.get().unwrap();

        // Initialize schema
        init_schema(&conn);

        conn.execute(
            "INSERT INTO projects (name) VALUES (?1)",
            rusqlite::params!["Test Project"],
        )
        .unwrap();
        let project_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO docs (project_id, path, name) VALUES (?1, ?2, ?3)",
            rusqlite::params![project_id, "test.md", "Test Doc"],
        )
        .unwrap();
        let doc_id = conn.last_insert_rowid();

        let draft = create_draft(
            &pool,
            doc_id,
            DraftCreate {
                name: "Draft 1".to_string(),
                content: "Draft content".to_string(),
            },
        )
        .unwrap();

        assert_eq!(draft.doc_id, doc_id);
        assert_eq!(draft.name, "Draft 1");
        assert_eq!(draft.content, "Draft content");
    }

    #[test]
    fn test_list_drafts() {
        let pool = make_pool();
        let conn = pool.get().unwrap();

        init_schema(&conn);

        conn.execute(
            "INSERT INTO projects (name) VALUES (?1)",
            rusqlite::params!["Test Project"],
        )
        .unwrap();
        let project_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO docs (project_id, path, name) VALUES (?1, ?2, ?3)",
            rusqlite::params![project_id, "test.md", "Test Doc"],
        )
        .unwrap();
        let doc_id = conn.last_insert_rowid();

        create_draft(
            &pool,
            doc_id,
            DraftCreate {
                name: "Draft 1".to_string(),
                content: "Content 1".to_string(),
            },
        )
        .unwrap();

        create_draft(
            &pool,
            doc_id,
            DraftCreate {
                name: "Draft 2".to_string(),
                content: "Content 2".to_string(),
            },
        )
        .unwrap();

        let drafts = list_drafts(&pool, doc_id).unwrap();
        assert_eq!(drafts.len(), 2);
        assert_eq!(drafts[0].name, "Draft 2"); // Most recent first
        assert_eq!(drafts[1].name, "Draft 1");
    }

    #[test]
    fn test_update_draft() {
        let pool = make_pool();
        let conn = pool.get().unwrap();

        init_schema(&conn);

        conn.execute(
            "INSERT INTO projects (name) VALUES (?1)",
            rusqlite::params!["Test Project"],
        )
        .unwrap();
        let project_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO docs (project_id, path, name) VALUES (?1, ?2, ?3)",
            rusqlite::params![project_id, "test.md", "Test Doc"],
        )
        .unwrap();
        let doc_id = conn.last_insert_rowid();

        let draft = create_draft(
            &pool,
            doc_id,
            DraftCreate {
                name: "Original".to_string(),
                content: "Original content".to_string(),
            },
        )
        .unwrap();

        let updated = update_draft(
            &pool,
            draft.id,
            DraftUpdate {
                name: Some("Updated".to_string()),
                content: Some("Updated content".to_string()),
            },
        )
        .unwrap();

        assert_eq!(updated.name, "Updated");
        assert_eq!(updated.content, "Updated content");
    }

    #[test]
    fn test_delete_draft() {
        let pool = make_pool();
        let conn = pool.get().unwrap();

        init_schema(&conn);

        conn.execute(
            "INSERT INTO projects (name) VALUES (?1)",
            rusqlite::params!["Test Project"],
        )
        .unwrap();
        let project_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO docs (project_id, path, name) VALUES (?1, ?2, ?3)",
            rusqlite::params![project_id, "test.md", "Test Doc"],
        )
        .unwrap();
        let doc_id = conn.last_insert_rowid();

        let draft = create_draft(
            &pool,
            doc_id,
            DraftCreate {
                name: "Draft".to_string(),
                content: "Content".to_string(),
            },
        )
        .unwrap();

        delete_draft(&pool, draft.id).unwrap();

        let found = get_draft(&pool, draft.id).unwrap();
        assert!(found.is_none());
    }

    #[test]
    fn test_restore_draft_to_doc() {
        let pool = make_pool();
        let conn = pool.get().unwrap();

        init_schema(&conn);

        conn.execute(
            "INSERT INTO projects (name) VALUES (?1)",
            rusqlite::params!["Test Project"],
        )
        .unwrap();
        let project_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO docs (project_id, path, name, text) VALUES (?1, ?2, ?3, ?4)",
            rusqlite::params![project_id, "test.md", "Test Doc", "Original text"],
        )
        .unwrap();
        let doc_id = conn.last_insert_rowid();

        let draft = create_draft(
            &pool,
            doc_id,
            DraftCreate {
                name: "Draft".to_string(),
                content: "Draft text".to_string(),
            },
        )
        .unwrap();

        restore_draft_to_doc(&pool, draft.id).unwrap();

        // Verify document text was updated
        let mut stmt = conn
            .prepare("SELECT text FROM docs WHERE id = ?1")
            .unwrap();
        let doc_text: String = stmt
            .query_row(rusqlite::params![doc_id], |row| row.get(0))
            .unwrap();

        assert_eq!(doc_text, "Draft text");
    }

    #[test]
    fn test_multiple_drafts_per_doc() {
        let pool = make_pool();
        let conn = pool.get().unwrap();

        init_schema(&conn);

        conn.execute(
            "INSERT INTO projects (name) VALUES (?1)",
            rusqlite::params!["Test Project"],
        )
        .unwrap();
        let project_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO docs (project_id, path, name) VALUES (?1, ?2, ?3)",
            rusqlite::params![project_id, "test1.md", "Doc 1"],
        )
        .unwrap();
        let doc1_id = conn.last_insert_rowid();

        conn.execute(
            "INSERT INTO docs (project_id, path, name) VALUES (?1, ?2, ?3)",
            rusqlite::params![project_id, "test2.md", "Doc 2"],
        )
        .unwrap();
        let doc2_id = conn.last_insert_rowid();

        // Create multiple drafts for doc 1
        for i in 1..=3 {
            create_draft(
                &pool,
                doc1_id,
                DraftCreate {
                    name: format!("Draft {}", i),
                    content: format!("Content {}", i),
                },
            )
            .unwrap();
        }

        // Create draft for doc 2
        create_draft(
            &pool,
            doc2_id,
            DraftCreate {
                name: "Draft A".to_string(),
                content: "Content A".to_string(),
            },
        )
        .unwrap();

        let doc1_drafts = list_drafts(&pool, doc1_id).unwrap();
        let doc2_drafts = list_drafts(&pool, doc2_id).unwrap();

        assert_eq!(doc1_drafts.len(), 3);
        assert_eq!(doc2_drafts.len(), 1);
    }
}
