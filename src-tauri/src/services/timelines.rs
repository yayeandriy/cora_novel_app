use crate::db::{DbPool, get_conn};
use crate::models::{Timeline, TimelineCreate, TimelineUpdate};
use rusqlite::OptionalExtension;
use anyhow::Context;

pub fn create(pool: &DbPool, payload: TimelineCreate) -> anyhow::Result<Timeline> {
    let conn = get_conn(pool)?;
    
    // First, check if a timeline already exists for this entity
    let existing: Option<i64> = conn
        .query_row(
            "SELECT id FROM timelines WHERE entity_type = ?1 AND entity_id = ?2",
            rusqlite::params![payload.entity_type, payload.entity_id],
            |row| row.get(0),
        )
        .optional()?;
    
    if let Some(existing_id) = existing {
        // Update existing timeline
        conn.execute(
            "UPDATE timelines SET start_date = ?1, end_date = ?2 WHERE id = ?3",
            rusqlite::params![payload.start_date, payload.end_date, existing_id],
        )
        .context("updating existing timeline")?;
        
        return get(pool, existing_id)?
            .ok_or_else(|| anyhow::anyhow!("timeline not found after update"));
    }
    
    // Create new timeline
    conn.execute(
        "INSERT INTO timelines (entity_type, entity_id, start_date, end_date) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![payload.entity_type, payload.entity_id, payload.start_date, payload.end_date],
    )
    .context("inserting timeline")?;

    let id = conn.last_insert_rowid();
    get(pool, id)?
        .ok_or_else(|| anyhow::anyhow!("timeline not found after creation"))
}

pub fn get(pool: &DbPool, id: i64) -> anyhow::Result<Option<Timeline>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT id, entity_type, entity_id, start_date, end_date FROM timelines WHERE id = ?1")?;
    let res = stmt.query_row(rusqlite::params![id], |row| {
        Ok(Timeline {
            id: row.get(0)?,
            entity_type: row.get(1)?,
            entity_id: row.get(2)?,
            start_date: row.get(3)?,
            end_date: row.get(4)?,
        })
    }).optional()?;

    Ok(res)
}

pub fn get_by_entity(pool: &DbPool, entity_type: &str, entity_id: i64) -> anyhow::Result<Option<Timeline>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare(
        "SELECT id, entity_type, entity_id, start_date, end_date FROM timelines WHERE entity_type = ?1 AND entity_id = ?2"
    )?;
    let res = stmt.query_row(rusqlite::params![entity_type, entity_id], |row| {
        Ok(Timeline {
            id: row.get(0)?,
            entity_type: row.get(1)?,
            entity_id: row.get(2)?,
            start_date: row.get(3)?,
            end_date: row.get(4)?,
        })
    }).optional()?;

    Ok(res)
}

pub fn list(pool: &DbPool) -> anyhow::Result<Vec<Timeline>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT id, entity_type, entity_id, start_date, end_date FROM timelines ORDER BY id")?;
    let rows = stmt.query_map([], |row| {
        Ok(Timeline {
            id: row.get(0)?,
            entity_type: row.get(1)?,
            entity_id: row.get(2)?,
            start_date: row.get(3)?,
            end_date: row.get(4)?,
        })
    })?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn update(pool: &DbPool, id: i64, payload: TimelineUpdate) -> anyhow::Result<Timeline> {
    let conn = get_conn(pool)?;
    
    // Ensure timeline exists
    let existing = get(pool, id)?
        .ok_or_else(|| anyhow::anyhow!("timeline not found"))?;
    
    conn.execute(
        "UPDATE timelines SET start_date = ?1, end_date = ?2 WHERE id = ?3",
        rusqlite::params![
            payload.start_date.or(existing.start_date),
            payload.end_date.or(existing.end_date),
            id
        ],
    )
    .context("updating timeline")?;
    
    get(pool, id)?
        .ok_or_else(|| anyhow::anyhow!("timeline not found after update"))
}

pub fn delete(pool: &DbPool, id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    let rows = conn.execute("DELETE FROM timelines WHERE id = ?1", rusqlite::params![id])?;
    if rows == 0 {
        anyhow::bail!("timeline not found");
    }
    Ok(())
}

pub fn delete_by_entity(pool: &DbPool, entity_type: &str, entity_id: i64) -> anyhow::Result<()> {
    let conn = get_conn(pool)?;
    conn.execute(
        "DELETE FROM timelines WHERE entity_type = ?1 AND entity_id = ?2",
        rusqlite::params![entity_type, entity_id],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use r2d2_sqlite::SqliteConnectionManager;
    use std::sync::atomic::{AtomicU32, Ordering};

    static TEST_COUNTER: AtomicU32 = AtomicU32::new(0);

    fn setup_test_pool() -> anyhow::Result<DbPool> {
        // Generate unique database name for each test
        let test_id = TEST_COUNTER.fetch_add(1, Ordering::SeqCst);
        let db_name = format!("file:test_timelines_{}?mode=memory&cache=shared", test_id);
        
        let manager = SqliteConnectionManager::file(&db_name);
        let pool = r2d2::Pool::builder()
            .max_size(5) // Allow multiple connections for tests
            .build(manager)?;
        
        let conn = pool.get()?;
        
        // Enable foreign keys and create table
        conn.execute_batch(
            "PRAGMA foreign_keys = ON;
            
            CREATE TABLE timelines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL CHECK(entity_type IN ('project', 'doc', 'folder', 'event')),
                entity_id INTEGER NOT NULL,
                start_date TEXT,
                end_date TEXT,
                UNIQUE(entity_type, entity_id)
            );
            
            CREATE INDEX idx_timelines_entity ON timelines(entity_type, entity_id);"
        )?;
        
        Ok(pool)
    }

    #[test]
    fn test_create_timeline() {
        let pool = setup_test_pool().unwrap();
        
        // Verify table exists
        let conn = pool.get().unwrap();
        let table_check: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='timelines'",
            [],
            |row| row.get(0)
        ).unwrap();
        assert_eq!(table_check, 1, "Timelines table should exist");
        drop(conn);
        
        let payload = TimelineCreate {
            entity_type: "project".to_string(),
            entity_id: 1,
            start_date: Some("2025-01-01".to_string()),
            end_date: Some("2025-12-31".to_string()),
        };
        
        let result = create(&pool, payload).unwrap();
        
        assert_eq!(result.entity_type, "project");
        assert_eq!(result.entity_id, 1);
        assert_eq!(result.start_date, Some("2025-01-01".to_string()));
    }

    #[test]
    fn test_upsert_behavior() {
        let pool = setup_test_pool().unwrap();
        
        let payload1 = TimelineCreate {
            entity_type: "project".to_string(),
            entity_id: 1,
            start_date: Some("2025-01-01".to_string()),
            end_date: Some("2025-06-30".to_string()),
        };
        let timeline1 = create(&pool, payload1).unwrap();
        
        let payload2 = TimelineCreate {
            entity_type: "project".to_string(),
            entity_id: 1,
            start_date: Some("2025-02-01".to_string()),
            end_date: Some("2025-12-31".to_string()),
        };
        let timeline2 = create(&pool, payload2).unwrap();
        
        assert_eq!(timeline1.id, timeline2.id);
        assert_eq!(timeline2.start_date, Some("2025-02-01".to_string()));
    }

    #[test]
    fn test_get_timeline() {
        let pool = setup_test_pool().unwrap();
        
        let payload = TimelineCreate {
            entity_type: "doc".to_string(),
            entity_id: 5,
            start_date: Some("2025-03-01".to_string()),
            end_date: Some("2025-03-31".to_string()),
        };
        let created = create(&pool, payload).unwrap();
        
        let fetched = get(&pool, created.id).unwrap().unwrap();
        
        assert_eq!(fetched.id, created.id);
        assert_eq!(fetched.entity_type, "doc");
    }

    #[test]
    fn test_get_by_entity() {
        let pool = setup_test_pool().unwrap();
        
        let payload = TimelineCreate {
            entity_type: "event".to_string(),
            entity_id: 10,
            start_date: Some("2025-04-01".to_string()),
            end_date: Some("2025-04-15".to_string()),
        };
        create(&pool, payload).unwrap();
        
        let fetched = get_by_entity(&pool, "event", 10).unwrap().unwrap();
        
        assert_eq!(fetched.entity_type, "event");
        assert_eq!(fetched.entity_id, 10);
    }

    #[test]
    fn test_delete_timeline() {
        let pool = setup_test_pool().unwrap();
        
        let payload = TimelineCreate {
            entity_type: "doc".to_string(),
            entity_id: 8,
            start_date: Some("2025-06-01".to_string()),
            end_date: Some("2025-06-30".to_string()),
        };
        let created = create(&pool, payload).unwrap();
        
        delete(&pool, created.id).unwrap();
        
        let fetched = get(&pool, created.id).unwrap();
        assert!(fetched.is_none());
    }
}

