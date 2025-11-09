#[cfg(test)]
mod tests {
    use crate::db::DbPool;
    use r2d2_sqlite::SqliteConnectionManager;

    fn create_test_db() -> DbPool {
        let manager = SqliteConnectionManager::memory();
        let pool = r2d2::Pool::new(manager).expect("Failed to create pool");
        let conn = pool.get().expect("Failed to get connection");
        conn.execute_batch(include_str!("../../migrations/001_create_schema.sql")).expect("migrations 001");
        conn.execute_batch(include_str!("../../migrations/010_add_doc_group_characters.sql")).expect("migrations 010");
        pool
    }

    fn create_test_project(pool: &DbPool) -> i64 {
        let conn = pool.get().expect("get conn");
        conn.execute("INSERT INTO projects (name) VALUES (?1)", rusqlite::params!["Test Project"]).expect("insert");
        conn.last_insert_rowid()
    }

    fn create_test_character(pool: &DbPool, project_id: i64, name: &str) -> i64 {
        let conn = pool.get().expect("get conn");
        conn.execute("INSERT INTO characters (project_id, name) VALUES (?1, ?2)", rusqlite::params![project_id, name]).expect("insert");
        conn.last_insert_rowid()
    }

    fn create_test_doc_group(pool: &DbPool, project_id: i64, name: &str) -> i64 {
        let conn = pool.get().expect("get conn");
        conn.execute("INSERT INTO doc_groups (project_id, name, sort_order) VALUES (?1, ?2, 0)", rusqlite::params![project_id, name]).expect("insert");
        conn.last_insert_rowid()
    }

    #[test]
    fn test_attach_character_to_doc_group() {
        let pool = create_test_db();
        let pid = create_test_project(&pool);
        let char_id = create_test_character(&pool, pid, "Hero");
        let group_id = create_test_doc_group(&pool, pid, "Chapter 1");

        crate::services::characters::attach_to_doc_group(&pool, group_id, char_id).expect("attach");

        let list = crate::services::characters::list_for_doc_group(&pool, group_id).expect("list");
        assert_eq!(list, vec![char_id]);
    }

    #[test]
    fn test_detach_character_from_doc_group() {
        let pool = create_test_db();
        let pid = create_test_project(&pool);
        let char_id = create_test_character(&pool, pid, "Hero");
        let group_id = create_test_doc_group(&pool, pid, "Chapter 1");

        crate::services::characters::attach_to_doc_group(&pool, group_id, char_id).expect("attach");
        let list = crate::services::characters::list_for_doc_group(&pool, group_id).expect("list");
        assert_eq!(list.len(), 1);

        crate::services::characters::detach_from_doc_group(&pool, group_id, char_id).expect("detach");
        let list = crate::services::characters::list_for_doc_group(&pool, group_id).expect("list");
        assert_eq!(list.len(), 0);
    }

    #[test]
    fn test_list_multiple_characters_for_doc_group() {
        let pool = create_test_db();
        let pid = create_test_project(&pool);
        let char1 = create_test_character(&pool, pid, "Hero");
        let char2 = create_test_character(&pool, pid, "Villain");
        let group_id = create_test_doc_group(&pool, pid, "Chapter 1");

        crate::services::characters::attach_to_doc_group(&pool, group_id, char1).expect("attach 1");
        crate::services::characters::attach_to_doc_group(&pool, group_id, char2).expect("attach 2");

        let list = crate::services::characters::list_for_doc_group(&pool, group_id).expect("list");
        assert_eq!(list.len(), 2);
        assert!(list.contains(&char1));
        assert!(list.contains(&char2));
    }

    #[test]
    fn test_attach_idempotent() {
        let pool = create_test_db();
        let pid = create_test_project(&pool);
        let char_id = create_test_character(&pool, pid, "Hero");
        let group_id = create_test_doc_group(&pool, pid, "Chapter 1");

        crate::services::characters::attach_to_doc_group(&pool, group_id, char_id).expect("attach 1");
        crate::services::characters::attach_to_doc_group(&pool, group_id, char_id).expect("attach 2");

        let list = crate::services::characters::list_for_doc_group(&pool, group_id).expect("list");
        assert_eq!(list.len(), 1);
    }

    #[test]
    fn test_detach_idempotent() {
        let pool = create_test_db();
        let pid = create_test_project(&pool);
        let char_id = create_test_character(&pool, pid, "Hero");
        let group_id = create_test_doc_group(&pool, pid, "Chapter 1");

        crate::services::characters::detach_from_doc_group(&pool, group_id, char_id).expect("detach when not attached");

        let list = crate::services::characters::list_for_doc_group(&pool, group_id).expect("list");
        assert_eq!(list.len(), 0);
    }
}
