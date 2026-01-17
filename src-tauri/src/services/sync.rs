use crate::db::{DbPool, get_conn};
use crate::models::{Sync, SyncCreate, SyncUpdate, SyncStatus};
use anyhow::{Context, Result};
use sha2::{Sha256, Digest};
use chrono::{Utc, DateTime, Duration};

/// Create a new sync record for a project
pub fn create(pool: &DbPool, payload: SyncCreate) -> Result<Sync> {
    let conn = get_conn(pool)?;
    let now = Utc::now().to_rfc3339();
    
    let sync_direction = payload.sync_direction.unwrap_or_else(|| "bidirectional".to_string());
    let throttle_ms = payload.throttle_ms.unwrap_or(2000);
    let auto_sync_enabled = payload.auto_sync_enabled.unwrap_or(true);
    
    conn.execute(
        "INSERT INTO sync (project_id, file_path, sync_direction, throttle_ms, auto_sync_enabled, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![
            payload.project_id,
            payload.file_path,
            sync_direction,
            throttle_ms,
            auto_sync_enabled,
            now,
            now
        ],
    ).context("inserting sync record")?;
    
    let id = conn.last_insert_rowid();
    get(pool, id)?.ok_or_else(|| anyhow::anyhow!("Failed to retrieve created sync record"))
}

/// Get a sync record by ID
pub fn get(pool: &DbPool, id: i64) -> Result<Option<Sync>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare(
        "SELECT id, project_id, file_path, sync_status, sync_direction,
                sync_version, db_version, file_version,
                db_hash, file_hash,
                last_sync_at, last_db_change_at, last_file_change_at,
                throttle_ms, last_sync_attempt_at, next_allowed_sync_at,
                retry_count, max_retries, next_retry_at, base_retry_delay_ms,
                last_error, last_error_at, consecutive_errors,
                conflict_data, conflict_resolved_at, conflict_resolution,
                auto_sync_enabled, watch_file_enabled, watch_db_enabled,
                created_at, updated_at
         FROM sync WHERE id = ?1"
    )?;
    
    let result = stmt.query_row([id], |row| {
        Ok(Sync {
            id: row.get(0)?,
            project_id: row.get(1)?,
            file_path: row.get(2)?,
            sync_status: row.get(3)?,
            sync_direction: row.get(4)?,
            sync_version: row.get(5)?,
            db_version: row.get(6)?,
            file_version: row.get(7)?,
            db_hash: row.get(8)?,
            file_hash: row.get(9)?,
            last_sync_at: row.get(10)?,
            last_db_change_at: row.get(11)?,
            last_file_change_at: row.get(12)?,
            throttle_ms: row.get(13)?,
            last_sync_attempt_at: row.get(14)?,
            next_allowed_sync_at: row.get(15)?,
            retry_count: row.get(16)?,
            max_retries: row.get(17)?,
            next_retry_at: row.get(18)?,
            base_retry_delay_ms: row.get(19)?,
            last_error: row.get(20)?,
            last_error_at: row.get(21)?,
            consecutive_errors: row.get(22)?,
            conflict_data: row.get(23)?,
            conflict_resolved_at: row.get(24)?,
            conflict_resolution: row.get(25)?,
            auto_sync_enabled: row.get::<_, i64>(26)? != 0,
            watch_file_enabled: row.get::<_, i64>(27)? != 0,
            watch_db_enabled: row.get::<_, i64>(28)? != 0,
            created_at: row.get(29)?,
            updated_at: row.get(30)?,
        })
    });
    
    match result {
        Ok(sync) => Ok(Some(sync)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Get sync record by project ID
pub fn get_by_project(pool: &DbPool, project_id: i64) -> Result<Option<Sync>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare(
        "SELECT id FROM sync WHERE project_id = ?1"
    )?;
    
    let result = stmt.query_row([project_id], |row| {
        row.get::<_, i64>(0)
    });
    
    match result {
        Ok(id) => get(pool, id),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// List all sync records
pub fn list(pool: &DbPool) -> Result<Vec<Sync>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT id FROM sync ORDER BY created_at DESC")?;
    
    let ids: Vec<i64> = stmt.query_map([], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;
    
    let mut syncs = Vec::new();
    for id in ids {
        if let Some(sync) = get(pool, id)? {
            syncs.push(sync);
        }
    }
    Ok(syncs)
}

/// Update a sync record
pub fn update(pool: &DbPool, id: i64, payload: SyncUpdate) -> Result<Sync> {
    let conn = get_conn(pool)?;
    let now = Utc::now().to_rfc3339();
    
    // Build dynamic UPDATE query
    let mut updates = vec!["updated_at = ?".to_string()];
    let mut params: Vec<Box<dyn rusqlite::ToSql>> = vec![Box::new(now.clone())];
    
    macro_rules! add_field {
        ($field:ident, $col:expr) => {
            if let Some(ref val) = payload.$field {
                updates.push(format!("{} = ?", $col));
                params.push(Box::new(val.clone()));
            }
        };
    }
    
    macro_rules! add_bool_field {
        ($field:ident, $col:expr) => {
            if let Some(val) = payload.$field {
                updates.push(format!("{} = ?", $col));
                params.push(Box::new(if val { 1i64 } else { 0i64 }));
            }
        };
    }
    
    macro_rules! add_int_field {
        ($field:ident, $col:expr) => {
            if let Some(val) = payload.$field {
                updates.push(format!("{} = ?", $col));
                params.push(Box::new(val));
            }
        };
    }
    
    add_field!(file_path, "file_path");
    add_field!(sync_status, "sync_status");
    add_field!(sync_direction, "sync_direction");
    add_int_field!(sync_version, "sync_version");
    add_int_field!(db_version, "db_version");
    add_int_field!(file_version, "file_version");
    add_field!(db_hash, "db_hash");
    add_field!(file_hash, "file_hash");
    add_field!(last_sync_at, "last_sync_at");
    add_field!(last_db_change_at, "last_db_change_at");
    add_field!(last_file_change_at, "last_file_change_at");
    add_int_field!(throttle_ms, "throttle_ms");
    add_field!(last_sync_attempt_at, "last_sync_attempt_at");
    add_field!(next_allowed_sync_at, "next_allowed_sync_at");
    add_int_field!(retry_count, "retry_count");
    add_int_field!(max_retries, "max_retries");
    add_field!(next_retry_at, "next_retry_at");
    add_int_field!(base_retry_delay_ms, "base_retry_delay_ms");
    add_field!(last_error, "last_error");
    add_field!(last_error_at, "last_error_at");
    add_int_field!(consecutive_errors, "consecutive_errors");
    add_field!(conflict_data, "conflict_data");
    add_field!(conflict_resolved_at, "conflict_resolved_at");
    add_field!(conflict_resolution, "conflict_resolution");
    add_bool_field!(auto_sync_enabled, "auto_sync_enabled");
    add_bool_field!(watch_file_enabled, "watch_file_enabled");
    add_bool_field!(watch_db_enabled, "watch_db_enabled");
    
    params.push(Box::new(id));
    
    let sql = format!(
        "UPDATE sync SET {} WHERE id = ?",
        updates.join(", ")
    );
    
    let params_refs: Vec<&dyn rusqlite::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params_refs.as_slice()).context("updating sync record")?;
    
    get(pool, id)?.ok_or_else(|| anyhow::anyhow!("Sync record not found after update"))
}

/// Delete a sync record
pub fn delete(pool: &DbPool, id: i64) -> Result<()> {
    let conn = get_conn(pool)?;
    conn.execute("DELETE FROM sync WHERE id = ?1", [id])?;
    Ok(())
}

/// Delete sync record by project ID
pub fn delete_by_project(pool: &DbPool, project_id: i64) -> Result<()> {
    let conn = get_conn(pool)?;
    conn.execute("DELETE FROM sync WHERE project_id = ?1", [project_id])?;
    Ok(())
}

/// Get sync status with computed fields
pub fn get_status(pool: &DbPool, project_id: i64) -> Result<Option<SyncStatus>> {
    let sync = match get_by_project(pool, project_id)? {
        Some(s) => s,
        None => return Ok(None),
    };
    
    let now = Utc::now();
    
    // Calculate if we can sync now based on throttling
    let can_sync_now = match &sync.next_allowed_sync_at {
        Some(next) => {
            match DateTime::parse_from_rfc3339(next) {
                Ok(next_time) => now >= next_time,
                Err(_) => true,
            }
        }
        None => true,
    };
    
    // Calculate next sync time in ms
    let next_sync_in_ms = if can_sync_now {
        None
    } else {
        sync.next_allowed_sync_at.as_ref().and_then(|next| {
            DateTime::parse_from_rfc3339(next).ok().map(|next_time| {
                let diff = next_time.signed_duration_since(now);
                diff.num_milliseconds().max(0)
            })
        })
    };
    
    // Check for pending changes by comparing hashes
    let has_pending_changes = sync.db_hash != sync.file_hash;
    
    // Determine which is newer based on timestamps
    let is_file_newer = match (&sync.last_file_change_at, &sync.last_db_change_at) {
        (Some(file_time), Some(db_time)) => file_time > db_time,
        (Some(_), None) => true,
        _ => false,
    };
    
    let is_db_newer = match (&sync.last_db_change_at, &sync.last_file_change_at) {
        (Some(db_time), Some(file_time)) => db_time > file_time,
        (Some(_), None) => true,
        _ => false,
    };
    
    Ok(Some(SyncStatus {
        sync,
        can_sync_now,
        next_sync_in_ms,
        has_pending_changes,
        is_file_newer,
        is_db_newer,
    }))
}

/// Mark sync as started (update status and timestamps)
pub fn mark_sync_started(pool: &DbPool, project_id: i64) -> Result<Sync> {
    let sync = get_by_project(pool, project_id)?
        .ok_or_else(|| anyhow::anyhow!("Sync record not found for project"))?;
    
    let now = Utc::now();
    let next_allowed = (now + Duration::milliseconds(sync.throttle_ms)).to_rfc3339();
    
    update(pool, sync.id, SyncUpdate {
        sync_status: Some("syncing".to_string()),
        last_sync_attempt_at: Some(now.to_rfc3339()),
        next_allowed_sync_at: Some(next_allowed),
        ..Default::default()
    })
}

/// Mark sync as completed successfully
pub fn mark_sync_completed(pool: &DbPool, project_id: i64, db_hash: String, file_hash: String) -> Result<Sync> {
    let sync = get_by_project(pool, project_id)?
        .ok_or_else(|| anyhow::anyhow!("Sync record not found for project"))?;
    
    let now = Utc::now().to_rfc3339();
    
    update(pool, sync.id, SyncUpdate {
        sync_status: Some("synced".to_string()),
        sync_version: Some(sync.sync_version + 1),
        db_hash: Some(db_hash),
        file_hash: Some(file_hash),
        last_sync_at: Some(now.clone()),
        retry_count: Some(0),
        consecutive_errors: Some(0),
        last_error: None,
        next_retry_at: None,
        ..Default::default()
    })
}

/// Mark sync as failed with error
pub fn mark_sync_failed(pool: &DbPool, project_id: i64, error: String) -> Result<Sync> {
    let sync = get_by_project(pool, project_id)?
        .ok_or_else(|| anyhow::anyhow!("Sync record not found for project"))?;
    
    let now = Utc::now();
    let new_retry_count = sync.retry_count + 1;
    let new_consecutive_errors = sync.consecutive_errors + 1;
    
    // Calculate next retry with exponential backoff
    let backoff_ms = sync.base_retry_delay_ms * (2_i64.pow(new_retry_count.min(10) as u32));
    let next_retry = if new_retry_count < sync.max_retries {
        Some((now + Duration::milliseconds(backoff_ms)).to_rfc3339())
    } else {
        None // Max retries exceeded
    };
    
    let new_status = if new_retry_count >= sync.max_retries {
        "error".to_string()
    } else {
        "pending".to_string() // Will retry
    };
    
    update(pool, sync.id, SyncUpdate {
        sync_status: Some(new_status),
        retry_count: Some(new_retry_count),
        consecutive_errors: Some(new_consecutive_errors),
        last_error: Some(error),
        last_error_at: Some(now.to_rfc3339()),
        next_retry_at: next_retry,
        ..Default::default()
    })
}

/// Mark sync as having a conflict
pub fn mark_sync_conflict(pool: &DbPool, project_id: i64, conflict_data: String) -> Result<Sync> {
    let sync = get_by_project(pool, project_id)?
        .ok_or_else(|| anyhow::anyhow!("Sync record not found for project"))?;
    
    update(pool, sync.id, SyncUpdate {
        sync_status: Some("conflict".to_string()),
        conflict_data: Some(conflict_data),
        ..Default::default()
    })
}

/// Resolve a conflict
pub fn resolve_conflict(pool: &DbPool, project_id: i64, resolution: String) -> Result<Sync> {
    let sync = get_by_project(pool, project_id)?
        .ok_or_else(|| anyhow::anyhow!("Sync record not found for project"))?;
    
    let now = Utc::now().to_rfc3339();
    
    update(pool, sync.id, SyncUpdate {
        sync_status: Some("pending".to_string()),
        conflict_resolved_at: Some(now),
        conflict_resolution: Some(resolution),
        conflict_data: None,
        ..Default::default()
    })
}

/// Reset retry counters (e.g., when user manually triggers sync)
pub fn reset_retries(pool: &DbPool, project_id: i64) -> Result<Sync> {
    let sync = get_by_project(pool, project_id)?
        .ok_or_else(|| anyhow::anyhow!("Sync record not found for project"))?;
    
    update(pool, sync.id, SyncUpdate {
        sync_status: Some("pending".to_string()),
        retry_count: Some(0),
        consecutive_errors: Some(0),
        next_retry_at: None,
        last_error: None,
        ..Default::default()
    })
}

/// Update DB change timestamp (call when project data changes)
pub fn mark_db_changed(pool: &DbPool, project_id: i64) -> Result<Option<Sync>> {
    let sync = match get_by_project(pool, project_id)? {
        Some(s) => s,
        None => return Ok(None),
    };
    
    let now = Utc::now().to_rfc3339();
    
    Ok(Some(update(pool, sync.id, SyncUpdate {
        last_db_change_at: Some(now),
        db_version: Some(sync.db_version + 1),
        ..Default::default()
    })?))
}

/// Update file change timestamp (call when file is modified externally)
pub fn mark_file_changed(pool: &DbPool, project_id: i64) -> Result<Option<Sync>> {
    let sync = match get_by_project(pool, project_id)? {
        Some(s) => s,
        None => return Ok(None),
    };
    
    let now = Utc::now().to_rfc3339();
    
    Ok(Some(update(pool, sync.id, SyncUpdate {
        last_file_change_at: Some(now),
        file_version: Some(sync.file_version + 1),
        ..Default::default()
    })?))
}

/// Calculate SHA256 hash of content
pub fn calculate_hash(content: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(content);
    format!("{:x}", hasher.finalize())
}

/// Get pending syncs that need to be retried
pub fn get_pending_retries(pool: &DbPool) -> Result<Vec<Sync>> {
    let conn = get_conn(pool)?;
    let now = Utc::now().to_rfc3339();
    
    let mut stmt = conn.prepare(
        "SELECT id FROM sync 
         WHERE sync_status = 'pending' 
         AND next_retry_at IS NOT NULL 
         AND next_retry_at <= ?1
         AND auto_sync_enabled = 1
         ORDER BY next_retry_at ASC"
    )?;
    
    let ids: Vec<i64> = stmt.query_map([now], |row| row.get(0))?
        .collect::<Result<Vec<_>, _>>()?;
    
    let mut syncs = Vec::new();
    for id in ids {
        if let Some(sync) = get(pool, id)? {
            syncs.push(sync);
        }
    }
    Ok(syncs)
}

/// Pause sync for a project
pub fn pause_sync(pool: &DbPool, project_id: i64) -> Result<Sync> {
    let sync = get_by_project(pool, project_id)?
        .ok_or_else(|| anyhow::anyhow!("Sync record not found for project"))?;
    
    update(pool, sync.id, SyncUpdate {
        sync_status: Some("paused".to_string()),
        auto_sync_enabled: Some(false),
        ..Default::default()
    })
}

/// Resume sync for a project
pub fn resume_sync(pool: &DbPool, project_id: i64) -> Result<Sync> {
    let sync = get_by_project(pool, project_id)?
        .ok_or_else(|| anyhow::anyhow!("Sync record not found for project"))?;
    
    update(pool, sync.id, SyncUpdate {
        sync_status: Some("pending".to_string()),
        auto_sync_enabled: Some(true),
        retry_count: Some(0),
        ..Default::default()
    })
}

/// Check if auto-sync should be triggered and return true if conditions are met
/// This function checks:
/// 1. If a sync record exists for the project
/// 2. If auto_sync_enabled is true
/// 3. If we're not within the throttle window
/// 4. If sync is not already in progress
pub fn should_auto_sync(pool: &DbPool, project_id: i64) -> Result<bool> {
    // Get sync record for this project
    let sync = match get_by_project(pool, project_id)? {
        Some(s) => s,
        None => return Ok(false), // No sync record, skip auto-sync
    };
    
    // Check if auto-sync is enabled
    if !sync.auto_sync_enabled {
        return Ok(false);
    }
    
    // Check if sync is already in progress
    if sync.sync_status == "syncing" {
        return Ok(false);
    }
    
    // Check throttle timing - only sync if enough time has passed
    if let Some(last_attempt) = sync.last_sync_attempt_at {
        if let Ok(last_time) = DateTime::parse_from_rfc3339(&last_attempt) {
            let now = Utc::now();
            // Convert both to UTC timestamps for comparison
            let last_time_utc = last_time.with_timezone(&Utc);
            let elapsed_ms = (now - last_time_utc).num_milliseconds();
            if elapsed_ms < sync.throttle_ms {
                return Ok(false); // Within throttle window, skip
            }
        }
    }
    
    Ok(true)
}

/// Mark that the database has changed for a project
/// This is called after any data modification to track when sync is needed
pub fn mark_db_changed_simple(pool: &DbPool, project_id: i64) -> Result<()> {
    // Check if sync record exists first
    let sync = match get_by_project(pool, project_id)? {
        Some(s) => s,
        None => return Ok(()), // No sync record, nothing to mark
    };
    
    let now = Utc::now().to_rfc3339();
    let conn = get_conn(pool)?;
    
    conn.execute(
        "UPDATE sync SET last_db_change_at = ?1, updated_at = ?2 WHERE id = ?3",
        rusqlite::params![now, now, sync.id],
    ).context("marking db changed")?;
    
    Ok(())
}

// Implement Default for SyncUpdate to make partial updates easier
impl Default for SyncUpdate {
    fn default() -> Self {
        SyncUpdate {
            file_path: None,
            sync_status: None,
            sync_direction: None,
            sync_version: None,
            db_version: None,
            file_version: None,
            db_hash: None,
            file_hash: None,
            last_sync_at: None,
            last_db_change_at: None,
            last_file_change_at: None,
            throttle_ms: None,
            last_sync_attempt_at: None,
            next_allowed_sync_at: None,
            retry_count: None,
            max_retries: None,
            next_retry_at: None,
            base_retry_delay_ms: None,
            last_error: None,
            last_error_at: None,
            consecutive_errors: None,
            conflict_data: None,
            conflict_resolved_at: None,
            conflict_resolution: None,
            auto_sync_enabled: None,
            watch_file_enabled: None,
            watch_db_enabled: None,
        }
    }
}
