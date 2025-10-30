use crate::db::{DbPool, get_conn};
use crate::models::Doc;
use rusqlite::OptionalExtension;
use anyhow::Context;

/// List all docs for a project, ordered by doc_group_id and sort_order
pub fn list_docs(pool: &DbPool, project_id: i64) -> anyhow::Result<Vec<Doc>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare(
        "SELECT id, project_id, path, name, timeline_id, text, notes, doc_group_id, sort_order 
         FROM docs 
         WHERE project_id = ?1 
         ORDER BY doc_group_id, sort_order"
    )?;
    
    let docs = stmt.query_map(rusqlite::params![project_id], |row| {
        Ok(Doc {
            id: row.get(0)?,
            project_id: row.get(1)?,
            path: row.get(2)?,
            name: row.get(3)?,
            timeline_id: row.get(4)?,
            text: row.get(5)?,
            notes: row.get(6)?,
            doc_group_id: row.get(7)?,
            sort_order: row.get(8)?,
        })
    })?.collect::<Result<Vec<_>, _>>()?;
    
    Ok(docs)
}

/// Create a new doc with auto-calculated sort_order
pub fn create_doc(pool: &DbPool, project_id: i64, name: &str, doc_group_id: Option<i64>) -> anyhow::Result<Doc> {
    let conn = get_conn(pool)?;
    
    // Calculate next sort_order for this group
    let next_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM docs WHERE project_id = ?1 AND doc_group_id IS ?2",
        rusqlite::params![project_id, doc_group_id],
        |row| row.get(0),
    )?;
    
    conn.execute(
        "INSERT INTO docs (project_id, name, doc_group_id, sort_order, path, text) VALUES (?1, ?2, ?3, ?4, '', '')",
        rusqlite::params![project_id, name, doc_group_id, next_order],
    ).context("inserting doc")?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare("SELECT id, project_id, path, name, timeline_id, text, notes, doc_group_id, sort_order FROM docs WHERE id = ?1")?;
    let doc = stmt.query_row(rusqlite::params![id], |row| {
        Ok(Doc {
            id: row.get(0)?,
            project_id: row.get(1)?,
            path: row.get(2)?,
            name: row.get(3)?,
            timeline_id: row.get(4)?,
            text: row.get(5)?,
            notes: row.get(6)?,
            doc_group_id: row.get(7)?,
            sort_order: row.get(8)?,
        })
    })?;

    Ok(doc)
}

/// Create a new doc after a specific position
pub fn create_doc_after(pool: &DbPool, project_id: i64, name: &str, doc_group_id: Option<i64>, after_sort_order: i64) -> anyhow::Result<Doc> {
    let conn = get_conn(pool)?;
    
    // Insert after the specified position
    // First, increment all items with sort_order > after
    conn.execute(
        "UPDATE docs SET sort_order = sort_order + 1 
         WHERE project_id = ?1 AND doc_group_id IS ?2 AND sort_order > ?3",
        rusqlite::params![project_id, doc_group_id, after_sort_order]
    )?;
    
    let next_order = after_sort_order + 1;
    
    conn.execute(
        "INSERT INTO docs (project_id, name, doc_group_id, sort_order, path, text) VALUES (?1, ?2, ?3, ?4, '', '')",
        rusqlite::params![project_id, name, doc_group_id, next_order],
    ).context("inserting doc")?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare("SELECT id, project_id, path, name, timeline_id, text, notes, doc_group_id, sort_order FROM docs WHERE id = ?1")?;
    let doc = stmt.query_row(rusqlite::params![id], |row| {
        Ok(Doc {
            id: row.get(0)?,
            project_id: row.get(1)?,
            path: row.get(2)?,
            name: row.get(3)?,
            timeline_id: row.get(4)?,
            text: row.get(5)?,
            notes: row.get(6)?,
            doc_group_id: row.get(7)?,
            sort_order: row.get(8)?,
        })
    }).context("querying created doc")?;

    Ok(doc)
}

/// Get a single doc by ID
pub fn get_doc(pool: &DbPool, id: i64) -> anyhow::Result<Option<Doc>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT id, project_id, path, name, timeline_id, text, notes, doc_group_id, sort_order FROM docs WHERE id = ?1")?;
    let res = stmt.query_row(rusqlite::params![id], |row| {
        Ok(Doc {
            id: row.get(0)?,
            project_id: row.get(1)?,
            path: row.get(2)?,
            name: row.get(3)?,
            timeline_id: row.get(4)?,
            text: row.get(5)?,
            notes: row.get(6)?,
            doc_group_id: row.get(7)?,
            sort_order: row.get(8)?,
        })
    }).optional()?;

    Ok(res)
}

/// Update doc text content
pub fn update_doc(pool: &DbPool, id: i64, text: &str) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute(
        "UPDATE docs SET text = ?1 WHERE id = ?2",
        rusqlite::params![text, id],
    ).context("updating doc text")?;
    Ok(())
}

/// Update doc notes content
pub fn update_doc_notes(pool: &DbPool, id: i64, notes: &str) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    
    // Ensure notes column exists (silently ignored if already exists)
    conn.execute(
        "ALTER TABLE docs ADD COLUMN notes TEXT",
        [],
    ).ok();
    
    // Update the notes
    conn.execute(
        "UPDATE docs SET notes = ?1 WHERE id = ?2",
        rusqlite::params![notes, id],
    ).context("updating doc notes")?;
    Ok(())
}

/// Delete a doc and reorder remaining docs in same group
pub fn delete_doc(pool: &DbPool, id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    
    // Get doc info before deletion
    let (project_id, doc_group_id, sort_order): (i64, Option<i64>, i64) = conn.query_row(
        "SELECT project_id, doc_group_id, sort_order FROM docs WHERE id = ?1",
        rusqlite::params![id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;
    
    // Delete the doc
    conn.execute("DELETE FROM docs WHERE id = ?1", rusqlite::params![id])?;
    
    // Reorder remaining docs in same group with higher sort_order
    conn.execute(
        "UPDATE docs SET sort_order = sort_order - 1 WHERE project_id = ?1 AND doc_group_id IS ?2 AND sort_order > ?3",
        rusqlite::params![project_id, doc_group_id, sort_order],
    )?;
    
    Ok(())
}

/// Reorder a doc within its group (direction: "up" or "down")
pub fn reorder_doc(pool: &DbPool, id: i64, direction: &str) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    
    let (project_id, doc_group_id, current_order): (i64, Option<i64>, i64) = conn.query_row(
        "SELECT project_id, doc_group_id, sort_order FROM docs WHERE id = ?1",
        rusqlite::params![id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;
    
    let target_order = match direction {
        "up" => current_order - 1,
        "down" => current_order + 1,
        _ => return Err(anyhow::anyhow!("Invalid direction")),
    };
    
    // Swap sort_order with sibling
    conn.execute(
        "UPDATE docs SET sort_order = ?1 WHERE project_id = ?2 AND doc_group_id IS ?3 AND sort_order = ?4",
        rusqlite::params![current_order, project_id, doc_group_id, target_order],
    )?;
    
    conn.execute(
        "UPDATE docs SET sort_order = ?1 WHERE id = ?2",
        rusqlite::params![target_order, id],
    )?;
    
    Ok(())
}

/// Move a doc to a different group (or to root level with None)
pub fn move_doc_to_group(pool: &DbPool, doc_id: i64, new_group_id: Option<i64>) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    
    // Get current doc info
    let (project_id, old_group_id, old_order): (i64, Option<i64>, i64) = conn.query_row(
        "SELECT project_id, doc_group_id, sort_order FROM docs WHERE id = ?1",
        rusqlite::params![doc_id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
    )?;
    
    // Calculate next sort_order in new group
    let next_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM docs WHERE project_id = ?1 AND doc_group_id IS ?2",
        rusqlite::params![project_id, new_group_id],
        |row| row.get(0),
    )?;
    
    // Move doc to new group
    conn.execute(
        "UPDATE docs SET doc_group_id = ?1, sort_order = ?2 WHERE id = ?3",
        rusqlite::params![new_group_id, next_order, doc_id],
    )?;
    
    // Reorder remaining docs in old group
    conn.execute(
        "UPDATE docs SET sort_order = sort_order - 1 WHERE project_id = ?1 AND doc_group_id IS ?2 AND sort_order > ?3",
        rusqlite::params![project_id, old_group_id, old_order],
    )?;
    
    Ok(())
}

/// Rename a doc
pub fn rename_doc(pool: &DbPool, id: i64, new_name: &str) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute(
        "UPDATE docs SET name = ?1 WHERE id = ?2",
        rusqlite::params![new_name, id],
    ).context("renaming doc")?;
    Ok(())
}

// Legacy create function for backward compatibility
pub fn create(pool: &DbPool, project_id: i64, path: &str, name: Option<String>, timeline_id: Option<i64>, text: Option<String>) -> anyhow::Result<Doc> {
    let conn = get_conn(pool)?;
    conn.execute(
        "INSERT INTO docs (project_id, path, name, timeline_id, text) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![project_id, path, name, timeline_id, text],
    ).context("inserting doc")?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare("SELECT id, project_id, path, name, timeline_id, text, notes, doc_group_id, sort_order FROM docs WHERE id = ?1")?;
    let doc = stmt.query_row(rusqlite::params![id], |row| {
        Ok(Doc {
            id: row.get(0)?,
            project_id: row.get(1)?,
            path: row.get(2)?,
            name: row.get(3)?,
            timeline_id: row.get(4)?,
            text: row.get(5)?,
            notes: row.get(6)?,
            doc_group_id: row.get(7)?,
            sort_order: row.get(8)?,
        })
    }).context("querying created doc")?;

    Ok(doc)
}

// Legacy get function for backward compatibility
#[allow(dead_code)]
pub fn get(pool: &DbPool, id: i64) -> anyhow::Result<Option<Doc>> {
    get_doc(pool, id)
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
        let db_name = format!("file:memdocs{}?mode=memory&cache=shared", id);
        let manager = SqliteConnectionManager::file(&db_name);
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

    #[test]
    fn test_update_doc_notes() {
        let pool = make_pool();
        let conn = pool.get().unwrap();
        
        // Initialize schema
        conn.execute_batch(include_str!("../../migrations/001_create_schema.sql")).unwrap();

        conn.execute("INSERT INTO projects (name) VALUES (?1)", rusqlite::params!["P"]).unwrap();
        let project_id = conn.last_insert_rowid();

        let doc = create(&pool, project_id, "test.md", Some("Test".into()), None, None).unwrap();

        // Update notes
        update_doc_notes(&pool, doc.id, "Important notes").unwrap();

        let updated = get(&pool, doc.id).unwrap().unwrap();
        assert_eq!(updated.notes, Some("Important notes".to_string()));
    }

    #[test]
    fn test_update_doc_notes_multiple_times() {
        let pool = make_pool();
        let conn = pool.get().unwrap();
        
        // Initialize schema
        conn.execute_batch(include_str!("../../migrations/001_create_schema.sql")).unwrap();

        conn.execute("INSERT INTO projects (name) VALUES (?1)", rusqlite::params!["P"]).unwrap();
        let project_id = conn.last_insert_rowid();

        let doc = create(&pool, project_id, "test.md", Some("Test".into()), None, None).unwrap();

        update_doc_notes(&pool, doc.id, "First notes").unwrap();
        let after_first = get(&pool, doc.id).unwrap().unwrap();
        assert_eq!(after_first.notes, Some("First notes".to_string()));

        update_doc_notes(&pool, doc.id, "Second notes").unwrap();
        let after_second = get(&pool, doc.id).unwrap().unwrap();
        assert_eq!(after_second.notes, Some("Second notes".to_string()));
    }

    #[test]
    fn test_notes_with_special_characters() {
        let pool = make_pool();
        let conn = pool.get().unwrap();
        
        // Initialize schema
        conn.execute_batch(include_str!("../../migrations/001_create_schema.sql")).unwrap();

        conn.execute("INSERT INTO projects (name) VALUES (?1)", rusqlite::params!["P"]).unwrap();
        let project_id = conn.last_insert_rowid();

        let doc = create(&pool, project_id, "test.md", Some("Test".into()), None, None).unwrap();

        let special_notes = "Notes with 'quotes' and \"double\" and \n newlines \t tabs";
        update_doc_notes(&pool, doc.id, special_notes).unwrap();

        let updated = get(&pool, doc.id).unwrap().unwrap();
        assert_eq!(updated.notes, Some(special_notes.to_string()));
    }

    #[test]
    fn test_list_docs_includes_notes() {
        let pool = make_pool();
        let conn = pool.get().unwrap();
        
        // Initialize schema
        conn.execute_batch(include_str!("../../migrations/001_create_schema.sql")).unwrap();

        conn.execute("INSERT INTO projects (name) VALUES (?1)", rusqlite::params!["P"]).unwrap();
        let project_id = conn.last_insert_rowid();

        let doc1 = create(&pool, project_id, "doc1.md", Some("Doc1".into()), None, None).unwrap();
        let doc2 = create(&pool, project_id, "doc2.md", Some("Doc2".into()), None, None).unwrap();

        update_doc_notes(&pool, doc1.id, "Notes for doc 1").unwrap();
        update_doc_notes(&pool, doc2.id, "Notes for doc 2").unwrap();

        let all_docs = list_docs(&pool, project_id).unwrap();
        assert_eq!(all_docs.len(), 2);

        let doc1_from_list = all_docs.iter().find(|d| d.id == doc1.id).unwrap();
        assert_eq!(doc1_from_list.notes, Some("Notes for doc 1".to_string()));

        let doc2_from_list = all_docs.iter().find(|d| d.id == doc2.id).unwrap();
        assert_eq!(doc2_from_list.notes, Some("Notes for doc 2".to_string()));
    }

    #[test]
    fn test_empty_notes() {
        let pool = make_pool();
        let conn = pool.get().unwrap();
        
        // Initialize schema
        conn.execute_batch(include_str!("../../migrations/001_create_schema.sql")).unwrap();

        conn.execute("INSERT INTO projects (name) VALUES (?1)", rusqlite::params!["P"]).unwrap();
        let project_id = conn.last_insert_rowid();

        let doc = create(&pool, project_id, "test.md", Some("Test".into()), None, None).unwrap();

        update_doc_notes(&pool, doc.id, "").unwrap();

        let updated = get(&pool, doc.id).unwrap().unwrap();
        assert_eq!(updated.notes, Some("".to_string()));
    }

    #[test]
    fn test_very_long_notes() {
        let pool = make_pool();
        let conn = pool.get().unwrap();
        
        // Initialize schema
        conn.execute_batch(include_str!("../../migrations/001_create_schema.sql")).unwrap();

        conn.execute("INSERT INTO projects (name) VALUES (?1)", rusqlite::params!["P"]).unwrap();
        let project_id = conn.last_insert_rowid();

        let doc = create(&pool, project_id, "test.md", Some("Test".into()), None, None).unwrap();

        // Create a 10KB note
        let long_notes = "x".repeat(10240);
        update_doc_notes(&pool, doc.id, &long_notes).unwrap();

        let updated = get(&pool, doc.id).unwrap().unwrap();
        assert_eq!(updated.notes.unwrap().len(), 10240);
    }

    #[test]
    fn test_notes_persist_across_other_updates() {
        let pool = make_pool();
        let conn = pool.get().unwrap();
        
        // Initialize schema
        conn.execute_batch(include_str!("../../migrations/001_create_schema.sql")).unwrap();

        conn.execute("INSERT INTO projects (name) VALUES (?1)", rusqlite::params!["P"]).unwrap();
        let project_id = conn.last_insert_rowid();

        let doc = create(&pool, project_id, "test.md", Some("Test".into()), None, None).unwrap();

        update_doc_notes(&pool, doc.id, "Preserved notes").unwrap();
        update_doc(&pool, doc.id, "Updated text").unwrap();

        let updated = get(&pool, doc.id).unwrap().unwrap();
        assert_eq!(updated.notes, Some("Preserved notes".to_string()));
        assert_eq!(updated.text, Some("Updated text".to_string()));
    }
}
