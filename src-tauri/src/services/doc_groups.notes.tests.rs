#[cfg(test)]
mod tests {
    use crate::db::DbPool;
    use r2d2_sqlite::SqliteConnectionManager;

    fn create_test_db() -> DbPool {
        let manager = SqliteConnectionManager::memory();
        let pool = r2d2::Pool::new(manager).expect("Failed to create pool");
        let conn = pool.get().expect("Failed to get connection");
        conn.execute_batch(include_str!("../../migrations/001_create_schema.sql")).expect("migrations 001");
        conn.execute_batch(include_str!("../../migrations/009_add_doc_group_notes.sql")).expect("migrations 009");
        pool
    }

    fn create_test_project(pool: &DbPool) -> i64 {
        let conn = pool.get().expect("get conn");
        conn.execute("INSERT INTO projects (name) VALUES (?1)", rusqlite::params!["Test Project"]).expect("insert");
        conn.last_insert_rowid()
    }

    #[test]
    fn test_create_doc_group_notes_null() {
        let pool = create_test_db();
        let pid = create_test_project(&pool);
        let g = crate::services::doc_groups::create_doc_group(&pool, pid, "Folder", None).expect("create");
        assert_eq!(g.notes, None);
    }

    #[test]
    fn test_list_includes_notes() {
        let pool = create_test_db();
        let pid = create_test_project(&pool);
        let g = crate::services::doc_groups::create_doc_group(&pool, pid, "Folder A", None).expect("create");
        crate::services::doc_groups::update_doc_group_notes(&pool, g.id, "Some notes").expect("update notes");

        let list = crate::services::doc_groups::list_doc_groups(&pool, pid).expect("list");
        let found = list.iter().find(|x| x.id == g.id).expect("not found");
        assert_eq!(found.notes.as_deref(), Some("Some notes"));
    }

    #[test]
    fn test_update_doc_group_notes() {
        let pool = create_test_db();
        let pid = create_test_project(&pool);
        let g = crate::services::doc_groups::create_doc_group(&pool, pid, "Folder", None).expect("create");

        crate::services::doc_groups::update_doc_group_notes(&pool, g.id, "First").expect("update 1");
        let list = crate::services::doc_groups::list_doc_groups(&pool, pid).expect("list");
        let found = list.iter().find(|x| x.id == g.id).expect("not found");
        assert_eq!(found.notes.as_deref(), Some("First"));

        crate::services::doc_groups::update_doc_group_notes(&pool, g.id, "Second").expect("update 2");
        let list = crate::services::doc_groups::list_doc_groups(&pool, pid).expect("list");
        let found = list.iter().find(|x| x.id == g.id).expect("not found");
        assert_eq!(found.notes.as_deref(), Some("Second"));
    }

    #[test]
    fn test_update_notes_empty_string() {
        let pool = create_test_db();
        let pid = create_test_project(&pool);
        let g = crate::services::doc_groups::create_doc_group(&pool, pid, "Folder", None).expect("create");

        crate::services::doc_groups::update_doc_group_notes(&pool, g.id, "").expect("update");
        let list = crate::services::doc_groups::list_doc_groups(&pool, pid).expect("list");
        let found = list.iter().find(|x| x.id == g.id).expect("not found");
        assert_eq!(found.notes.as_deref(), Some(""));
    }
}
