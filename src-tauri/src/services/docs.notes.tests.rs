#[cfg(test)]
mod tests {
    use crate::services::docs;
    use crate::db::DbPool;
    use rusqlite::Connection;
    use r2d2_sqlite::SqliteConnectionManager;

    fn create_test_db() -> DbPool {
        let manager = SqliteConnectionManager::memory();
        let pool = r2d2::Pool::new(manager).expect("Failed to create pool");
        
        // Initialize schema
        let conn = pool.get().expect("Failed to get connection");
        conn.execute_batch(include_str!("../../migrations/001_create_schema.sql"))
            .expect("Failed to run migrations");
        
        pool
    }

    fn create_test_project(pool: &DbPool) -> i64 {
        let conn = pool.get().expect("Failed to get connection");
        conn.execute(
            "INSERT INTO projects (name, desc) VALUES (?1, ?2)",
            rusqlite::params!["Test Project", "Test Description"],
        ).expect("Failed to create project");
        conn.last_insert_rowid()
    }

    fn create_test_group(pool: &DbPool, project_id: i64) -> i64 {
        let conn = pool.get().expect("Failed to get connection");
        conn.execute(
            "INSERT INTO doc_groups (project_id, name, sort_order) VALUES (?1, ?2, ?3)",
            rusqlite::params![project_id, "Test Group", 0],
        ).expect("Failed to create group");
        conn.last_insert_rowid()
    }

    #[test]
    fn test_create_doc_with_notes() {
        let pool = create_test_db();
        let project_id = create_test_project(&pool);
        let group_id = create_test_group(&pool, project_id);

        let doc = docs::create_doc(&pool, project_id, "Test Doc", Some(group_id))
            .expect("Failed to create doc");

        assert_eq!(doc.id > 0, true);
        assert_eq!(doc.name, Some("Test Doc".to_string()));
        assert_eq!(doc.project_id, project_id);
        assert_eq!(doc.doc_group_id, Some(group_id));
        assert_eq!(doc.notes, None);
    }

    #[test]
    fn test_get_doc_returns_notes() {
        let pool = create_test_db();
        let project_id = create_test_project(&pool);
        let group_id = create_test_group(&pool, project_id);

        let doc = docs::create_doc(&pool, project_id, "Test Doc", Some(group_id))
            .expect("Failed to create doc");

        // Add notes
        docs::update_doc_notes(&pool, doc.id, "Test notes")
            .expect("Failed to save notes");

        // Retrieve and verify
        let retrieved = docs::get_doc(&pool, doc.id)
            .expect("Failed to get doc")
            .expect("Doc not found");

        assert_eq!(retrieved.notes, Some("Test notes".to_string()));
    }

    #[test]
    fn test_update_doc_notes_empty_string() {
        let pool = create_test_db();
        let project_id = create_test_project(&pool);
        let group_id = create_test_group(&pool, project_id);

        let doc = docs::create_doc(&pool, project_id, "Test Doc", Some(group_id))
            .expect("Failed to create doc");

        // Update with empty string
        docs::update_doc_notes(&pool, doc.id, "")
            .expect("Failed to save notes");

        let retrieved = docs::get_doc(&pool, doc.id)
            .expect("Failed to get doc")
            .expect("Doc not found");

        assert_eq!(retrieved.notes, Some("".to_string()));
    }

    #[test]
    fn test_update_doc_notes_multiple_times() {
        let pool = create_test_db();
        let project_id = create_test_project(&pool);
        let group_id = create_test_group(&pool, project_id);

        let doc = docs::create_doc(&pool, project_id, "Test Doc", Some(group_id))
            .expect("Failed to create doc");

        // Update multiple times
        docs::update_doc_notes(&pool, doc.id, "First note")
            .expect("Failed to save first note");
        
        let retrieved1 = docs::get_doc(&pool, doc.id)
            .expect("Failed to get doc")
            .expect("Doc not found");
        assert_eq!(retrieved1.notes, Some("First note".to_string()));

        docs::update_doc_notes(&pool, doc.id, "Second note")
            .expect("Failed to save second note");
        
        let retrieved2 = docs::get_doc(&pool, doc.id)
            .expect("Failed to get doc")
            .expect("Doc not found");
        assert_eq!(retrieved2.notes, Some("Second note".to_string()));
    }

    #[test]
    fn test_update_doc_notes_with_special_characters() {
        let pool = create_test_db();
        let project_id = create_test_project(&pool);
        let group_id = create_test_group(&pool, project_id);

        let doc = docs::create_doc(&pool, project_id, "Test Doc", Some(group_id))
            .expect("Failed to create doc");

        let special_notes = "Notes with 'quotes' and \"double quotes\" and \n newlines \t tabs";
        docs::update_doc_notes(&pool, doc.id, special_notes)
            .expect("Failed to save notes");

        let retrieved = docs::get_doc(&pool, doc.id)
            .expect("Failed to get doc")
            .expect("Doc not found");

        assert_eq!(retrieved.notes, Some(special_notes.to_string()));
    }

    #[test]
    fn test_list_docs_includes_notes() {
        let pool = create_test_db();
        let project_id = create_test_project(&pool);
        let group_id = create_test_group(&pool, project_id);

        let doc1 = docs::create_doc(&pool, project_id, "Doc 1", Some(group_id))
            .expect("Failed to create doc1");
        let doc2 = docs::create_doc(&pool, project_id, "Doc 2", Some(group_id))
            .expect("Failed to create doc2");

        docs::update_doc_notes(&pool, doc1.id, "Notes for doc 1")
            .expect("Failed to save notes for doc1");
        docs::update_doc_notes(&pool, doc2.id, "Notes for doc 2")
            .expect("Failed to save notes for doc2");

        let docs_list = docs::list_docs(&pool, project_id)
            .expect("Failed to list docs");

        assert_eq!(docs_list.len(), 2);
        
        let doc1_retrieved = docs_list.iter().find(|d| d.id == doc1.id).expect("Doc1 not found");
        assert_eq!(doc1_retrieved.notes, Some("Notes for doc 1".to_string()));
        
        let doc2_retrieved = docs_list.iter().find(|d| d.id == doc2.id).expect("Doc2 not found");
        assert_eq!(doc2_retrieved.notes, Some("Notes for doc 2".to_string()));
    }

    #[test]
    fn test_delete_doc_with_notes() {
        let pool = create_test_db();
        let project_id = create_test_project(&pool);
        let group_id = create_test_group(&pool, project_id);

        let doc = docs::create_doc(&pool, project_id, "Test Doc", Some(group_id))
            .expect("Failed to create doc");

        docs::update_doc_notes(&pool, doc.id, "Important notes")
            .expect("Failed to save notes");

        // Delete doc
        docs::delete_doc(&pool, doc.id)
            .expect("Failed to delete doc");

        // Verify deleted
        let retrieved = docs::get_doc(&pool, doc.id)
            .expect("Failed to get doc");
        assert_eq!(retrieved, None);
    }

    #[test]
    fn test_update_doc_notes_nonexistent_doc() {
        let pool = create_test_db();
        
        // Try to update notes for non-existent doc (should succeed but do nothing)
        let result = docs::update_doc_notes(&pool, 99999, "Some notes");
        assert!(result.is_ok());
    }

    #[test]
    fn test_notes_field_in_multiple_operations() {
        let pool = create_test_db();
        let project_id = create_test_project(&pool);
        let group_id = create_test_group(&pool, project_id);

        // Create doc
        let doc = docs::create_doc(&pool, project_id, "Doc", Some(group_id))
            .expect("Failed to create");

        // Update text and notes
        docs::update_doc_text(&pool, doc.id, "Updated text")
            .expect("Failed to update text");
        docs::update_doc_notes(&pool, doc.id, "Updated notes")
            .expect("Failed to update notes");

        // Verify both are saved
        let retrieved = docs::get_doc(&pool, doc.id)
            .expect("Failed to get")
            .expect("Not found");

        assert_eq!(retrieved.text, Some("Updated text".to_string()));
        assert_eq!(retrieved.notes, Some("Updated notes".to_string()));
    }

    #[test]
    fn test_very_long_notes() {
        let pool = create_test_db();
        let project_id = create_test_project(&pool);
        let group_id = create_test_group(&pool, project_id);

        let doc = docs::create_doc(&pool, project_id, "Test Doc", Some(group_id))
            .expect("Failed to create doc");

        // Create a very long notes string (10KB)
        let long_notes = "x".repeat(10240);
        docs::update_doc_notes(&pool, doc.id, &long_notes)
            .expect("Failed to save long notes");

        let retrieved = docs::get_doc(&pool, doc.id)
            .expect("Failed to get doc")
            .expect("Doc not found");

        assert_eq!(retrieved.notes.unwrap().len(), 10240);
    }
}
