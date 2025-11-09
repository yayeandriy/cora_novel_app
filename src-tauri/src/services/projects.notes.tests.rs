#[cfg(test)]
mod tests {
    use crate::db::DbPool;
    use r2d2_sqlite::SqliteConnectionManager;

    fn create_test_db() -> DbPool {
        let manager = SqliteConnectionManager::memory();
        let pool = r2d2::Pool::new(manager).expect("Failed to create pool");
        let conn = pool.get().expect("Failed to get connection");
        // Base schema
        conn.execute_batch(include_str!("../../migrations/001_create_schema.sql")).expect("migrations 001");
        // Ensure project notes column exists
        conn.execute_batch(include_str!("../../migrations/008_add_project_notes.sql")).expect("migrations 008");
        pool
    }

    #[test]
    fn test_create_project_with_notes() {
        let pool = create_test_db();
        let payload = crate::models::ProjectCreate {
            name: "Project A".into(),
            desc: Some("Desc".into()),
            path: None,
            notes: Some("Project notes".into()),
        };
        let p = crate::services::projects::create(&pool, payload).expect("create project");
        assert!(p.id > 0);
        assert_eq!(p.name, "Project A");
        assert_eq!(p.notes.as_deref(), Some("Project notes"));
    }

    #[test]
    fn test_update_project_notes() {
        let pool = create_test_db();
        // Create without notes
        let payload = crate::models::ProjectCreate { name: "P".into(), desc: None, path: None, notes: None };
        let p = crate::services::projects::create(&pool, payload).expect("create");

        // Update notes only
        let updated = crate::services::projects::update(&pool, p.id, None, None, None, Some("Updated".into()))
            .expect("update");
        assert_eq!(updated.notes.as_deref(), Some("Updated"));

        // Update notes again
        let updated2 = crate::services::projects::update(&pool, p.id, None, None, None, Some("Again".into()))
            .expect("update 2");
        assert_eq!(updated2.notes.as_deref(), Some("Again"));
    }

    #[test]
    fn test_list_includes_notes() {
        let pool = create_test_db();
        let p1 = crate::services::projects::create(&pool, crate::models::ProjectCreate { name: "P1".into(), desc: None, path: None, notes: Some("N1".into()) }).expect("create 1");
        let p2 = crate::services::projects::create(&pool, crate::models::ProjectCreate { name: "P2".into(), desc: None, path: None, notes: Some("N2".into()) }).expect("create 2");

        let list = crate::services::projects::list(&pool).expect("list");
        assert!(list.len() >= 2);
        let a = list.iter().find(|x| x.id == p1.id).expect("p1 missing");
        let b = list.iter().find(|x| x.id == p2.id).expect("p2 missing");
        assert_eq!(a.notes.as_deref(), Some("N1"));
        assert_eq!(b.notes.as_deref(), Some("N2"));
    }

    #[test]
    fn test_get_returns_notes() {
        let pool = create_test_db();
        let p = crate::services::projects::create(&pool, crate::models::ProjectCreate { name: "P".into(), desc: None, path: None, notes: Some("Hello".into()) }).expect("create");
        let got = crate::services::projects::get(&pool, p.id).expect("get").expect("not found");
        assert_eq!(got.notes.as_deref(), Some("Hello"));
    }
}
