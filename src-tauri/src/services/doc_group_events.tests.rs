#[cfg(test)]
mod tests {
    use crate::db::DbPool;
    use r2d2_sqlite::SqliteConnectionManager;

    fn create_test_db() -> DbPool {
        let manager = SqliteConnectionManager::memory();
        let pool = r2d2::Pool::new(manager).expect("Failed to create pool");
        let conn = pool.get().expect("Failed to get connection");
        conn.execute_batch(include_str!("../../migrations/001_create_schema.sql")).expect("migrations 001");
        conn.execute_batch(include_str!("../../migrations/005_add_event_start_end.sql")).expect("migrations 005");
        conn.execute_batch(include_str!("../../migrations/011_add_doc_group_events.sql")).expect("migrations 011");
        pool
    }

    fn create_test_project(pool: &DbPool) -> i64 {
        let conn = pool.get().expect("get conn");
        conn.execute("INSERT INTO projects (name) VALUES (?1)", rusqlite::params!["Test Project"]).expect("insert");
        conn.last_insert_rowid()
    }

    fn create_test_event(pool: &DbPool, project_id: i64, name: &str) -> i64 {
        let conn = pool.get().expect("get conn");
        conn.execute("INSERT INTO events (project_id, name) VALUES (?1, ?2)", rusqlite::params![project_id, name]).expect("insert");
        conn.last_insert_rowid()
    }

    fn create_test_doc_group(pool: &DbPool, project_id: i64, name: &str) -> i64 {
        let conn = pool.get().expect("get conn");
        conn.execute("INSERT INTO doc_groups (project_id, name, sort_order) VALUES (?1, ?2, 0)", rusqlite::params![project_id, name]).expect("insert");
        conn.last_insert_rowid()
    }

    #[test]
    fn test_attach_event_to_doc_group() {
        let pool = create_test_db();
        let pid = create_test_project(&pool);
        let event_id = create_test_event(&pool, pid, "Battle");
        let group_id = create_test_doc_group(&pool, pid, "Chapter 1");

        crate::services::events::attach_to_doc_group(&pool, group_id, event_id).expect("attach");

        let list = crate::services::events::list_for_doc_group(&pool, group_id).expect("list");
        assert_eq!(list, vec![event_id]);
    }

    #[test]
    fn test_detach_event_from_doc_group() {
        let pool = create_test_db();
        let pid = create_test_project(&pool);
        let event_id = create_test_event(&pool, pid, "Battle");
        let group_id = create_test_doc_group(&pool, pid, "Chapter 1");

        crate::services::events::attach_to_doc_group(&pool, group_id, event_id).expect("attach");
        let list = crate::services::events::list_for_doc_group(&pool, group_id).expect("list");
        assert_eq!(list.len(), 1);

        crate::services::events::detach_from_doc_group(&pool, group_id, event_id).expect("detach");
        let list = crate::services::events::list_for_doc_group(&pool, group_id).expect("list");
        assert_eq!(list.len(), 0);
    }

    #[test]
    fn test_list_multiple_events_for_doc_group() {
        let pool = create_test_db();
        let pid = create_test_project(&pool);
        let event1 = create_test_event(&pool, pid, "Battle");
        let event2 = create_test_event(&pool, pid, "Meeting");
        let group_id = create_test_doc_group(&pool, pid, "Chapter 1");

        crate::services::events::attach_to_doc_group(&pool, group_id, event1).expect("attach 1");
        crate::services::events::attach_to_doc_group(&pool, group_id, event2).expect("attach 2");

        let list = crate::services::events::list_for_doc_group(&pool, group_id).expect("list");
        assert_eq!(list.len(), 2);
        assert!(list.contains(&event1));
        assert!(list.contains(&event2));
    }

    #[test]
    fn test_attach_idempotent() {
        let pool = create_test_db();
        let pid = create_test_project(&pool);
        let event_id = create_test_event(&pool, pid, "Battle");
        let group_id = create_test_doc_group(&pool, pid, "Chapter 1");

        crate::services::events::attach_to_doc_group(&pool, group_id, event_id).expect("attach 1");
        crate::services::events::attach_to_doc_group(&pool, group_id, event_id).expect("attach 2");

        let list = crate::services::events::list_for_doc_group(&pool, group_id).expect("list");
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn test_detach_idempotent() {
        let pool = create_test_db();
        let pid = create_test_project(&pool);
        let event_id = create_test_event(&pool, pid, "Battle");
        let group_id = create_test_doc_group(&pool, pid, "Chapter 1");

        crate::services::events::detach_from_doc_group(&pool, group_id, event_id).expect("detach when not attached");

        let list = crate::services::events::list_for_doc_group(&pool, group_id).expect("list");
        assert_eq!(list.len(), 0);
    }

    #[test]
    fn test_list_from_docs_in_group() {
        let pool = create_test_db();
        let pid = create_test_project(&pool);

        // Create folder
        let group_id = create_test_doc_group(&pool, pid, "Chapter 1");

        // Create two docs in the folder
        let conn = pool.get().expect("get conn");
        conn.execute("INSERT INTO docs (project_id, doc_group_id, path) VALUES (?1, ?2, ?3)", 
            rusqlite::params![pid, group_id, "doc1.txt"]).expect("insert doc1");
        let doc1_id = conn.last_insert_rowid();

        conn.execute("INSERT INTO docs (project_id, doc_group_id, path) VALUES (?1, ?2, ?3)", 
            rusqlite::params![pid, group_id, "doc2.txt"]).expect("insert doc2");
        let doc2_id = conn.last_insert_rowid();
        drop(conn);

        // Create three events
        let event1 = create_test_event(&pool, pid, "Battle");
        let event2 = create_test_event(&pool, pid, "Meeting");
        let event3 = create_test_event(&pool, pid, "Festival");

        // Attach event1 to doc1, event2 to both docs, event3 to doc2
        crate::services::events::attach_to_doc(&pool, doc1_id, event1).expect("attach event1 to doc1");
        crate::services::events::attach_to_doc(&pool, doc1_id, event2).expect("attach event2 to doc1");
        crate::services::events::attach_to_doc(&pool, doc2_id, event2).expect("attach event2 to doc2");
        crate::services::events::attach_to_doc(&pool, doc2_id, event3).expect("attach event3 to doc2");

        // List events from docs in folder - should get all three distinct events
        let ids = crate::services::events::list_from_docs_in_group(&pool, group_id).expect("list from docs");
        assert_eq!(ids.len(), 3);
        assert!(ids.contains(&event1));
        assert!(ids.contains(&event2));
        assert!(ids.contains(&event3));
    }
}
