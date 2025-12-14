use crate::db::DbPool;
use crate::models::{FolderDraft, FolderDraftCreate, FolderDraftUpdate};
use anyhow::Context;
use chrono::Utc;
use rusqlite::OptionalExtension;

pub fn create(pool: &DbPool, doc_group_id: i64, req: FolderDraftCreate) -> anyhow::Result<FolderDraft> {
    let conn = pool.get()?;
    let now = Utc::now().to_rfc3339();
    
    // Get max sort_order (handle NULL when no drafts exist)
    let max_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), 0) FROM folder_drafts WHERE doc_group_id = ?1",
        rusqlite::params![doc_group_id],
        |row| row.get(0)
    )?;
    let sort_order = max_order + 1;

    conn.execute(
        "INSERT INTO folder_drafts (doc_group_id, name, content, created_at, updated_at, sort_order) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        rusqlite::params![doc_group_id, req.name, req.content, now, now, sort_order],
    ).context("creating folder draft")?;
    let id = conn.last_insert_rowid();
    
    // If an index was requested, move the new draft to that index
    if let Some(index) = req.insert_at_index {
        drop(conn); // Release connection before calling move_to_index which gets its own
        move_to_index(pool, id, index)?;
    }

    get(pool, id)?.context("folder draft not found after creation")
}

pub fn get(pool: &DbPool, id: i64) -> anyhow::Result<Option<FolderDraft>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare("SELECT id, doc_group_id, name, content, created_at, updated_at, sort_order FROM folder_drafts WHERE id = ?1")?;
    let draft = stmt.query_row(rusqlite::params![id], |row| {
        Ok(FolderDraft { 
            id: row.get(0)?, 
            doc_group_id: row.get(1)?, 
            name: row.get(2)?, 
            content: row.get(3)?, 
            created_at: row.get(4)?, 
            updated_at: row.get(5)?,
            sort_order: row.get(6)?
        })
    }).optional()?;
    Ok(draft)
}

pub fn list(pool: &DbPool, doc_group_id: i64) -> anyhow::Result<Vec<FolderDraft>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare("SELECT id, doc_group_id, name, content, created_at, updated_at, sort_order FROM folder_drafts WHERE doc_group_id = ?1 ORDER BY sort_order ASC, id ASC")?;
    let rows = stmt.query_map(rusqlite::params![doc_group_id], |row| {
        Ok(FolderDraft { 
            id: row.get(0)?, 
            doc_group_id: row.get(1)?, 
            name: row.get(2)?, 
            content: row.get(3)?, 
            created_at: row.get(4)?, 
            updated_at: row.get(5)?,
            sort_order: row.get(6)?
        })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn update(pool: &DbPool, id: i64, req: FolderDraftUpdate) -> anyhow::Result<FolderDraft> {
    let conn = pool.get()?;
    let now = Utc::now().to_rfc3339();
    let current = get(pool, id)?.context("folder draft not found")?;
    let new_name = req.name.unwrap_or(current.name);
    let new_content = req.content.unwrap_or(current.content);
    conn.execute("UPDATE folder_drafts SET name = ?1, content = ?2, updated_at = ?3 WHERE id = ?4", rusqlite::params![new_name, new_content, now, id]).context("updating folder draft")?;
    get(pool, id)?.context("folder draft not found after update")
}

pub fn delete(pool: &DbPool, id: i64) -> anyhow::Result<()> {
    let conn = pool.get()?;
    let n = conn.execute("DELETE FROM folder_drafts WHERE id = ?1", rusqlite::params![id]).context("deleting folder draft")?;
    if n == 0 { anyhow::bail!("folder draft not found"); }
    Ok(())
}

pub fn delete_all_for_group(pool: &DbPool, doc_group_id: i64) -> anyhow::Result<()> {
    let conn = pool.get()?;
    conn.execute("DELETE FROM folder_drafts WHERE doc_group_id = ?1", rusqlite::params![doc_group_id]).context("deleting folder drafts for group")?;
    Ok(())
}

pub fn reorder(pool: &DbPool, id: i64, direction: &str) -> anyhow::Result<()> {
    let conn = pool.get()?;
    let current = get(pool, id)?.context("folder draft not found")?;
    let current_order = current.sort_order.unwrap_or(0);
    
    if direction == "up" {
        // Find the draft immediately before this one
        let prev: Option<(i64, i64)> = conn.query_row(
            "SELECT id, sort_order FROM folder_drafts WHERE doc_group_id = ?1 AND sort_order < ?2 ORDER BY sort_order DESC LIMIT 1",
            rusqlite::params![current.doc_group_id, current_order],
            |row| Ok((row.get(0)?, row.get(1)?))
        ).optional()?;
        
        if let Some((prev_id, prev_order)) = prev {
            // Swap sort orders
            conn.execute("UPDATE folder_drafts SET sort_order = ?1 WHERE id = ?2", rusqlite::params![prev_order, id])?;
            conn.execute("UPDATE folder_drafts SET sort_order = ?1 WHERE id = ?2", rusqlite::params![current_order, prev_id])?;
        }
    } else if direction == "down" {
        // Find the draft immediately after this one
        let next: Option<(i64, i64)> = conn.query_row(
            "SELECT id, sort_order FROM folder_drafts WHERE doc_group_id = ?1 AND sort_order > ?2 ORDER BY sort_order ASC LIMIT 1",
            rusqlite::params![current.doc_group_id, current_order],
            |row| Ok((row.get(0)?, row.get(1)?))
        ).optional()?;
        
        if let Some((next_id, next_order)) = next {
            // Swap sort orders
            conn.execute("UPDATE folder_drafts SET sort_order = ?1 WHERE id = ?2", rusqlite::params![next_order, id])?;
            conn.execute("UPDATE folder_drafts SET sort_order = ?1 WHERE id = ?2", rusqlite::params![current_order, next_id])?;
        }
    }
    Ok(())
}

pub fn move_to_index(pool: &DbPool, id: i64, new_index: usize) -> anyhow::Result<()> {
    let conn = pool.get()?;
    let current = get(pool, id)?.context("folder draft not found")?;
    
    // Get all drafts for the group
    let mut drafts = list(pool, current.doc_group_id)?;
    
    // Remove current draft
    if let Some(pos) = drafts.iter().position(|d| d.id == id) {
        drafts.remove(pos);
    }
    
    // Insert at new index
    if new_index >= drafts.len() {
        drafts.push(current);
    } else {
        drafts.insert(new_index, current);
    }
    
    // Update all sort orders
    for (i, draft) in drafts.iter().enumerate() {
        conn.execute(
            "UPDATE folder_drafts SET sort_order = ?1 WHERE id = ?2",
            rusqlite::params![i as i64, draft.id],
        )?;
    }
    
    Ok(())
}
