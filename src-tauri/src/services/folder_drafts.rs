use crate::db::DbPool;
use crate::models::{FolderDraft, FolderDraftCreate, FolderDraftUpdate};
use anyhow::Context;
use chrono::Utc;
use rusqlite::OptionalExtension;

pub fn create(pool: &DbPool, doc_group_id: i64, req: FolderDraftCreate) -> anyhow::Result<FolderDraft> {
    let conn = pool.get()?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO folder_drafts (doc_group_id, name, content, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![doc_group_id, req.name, req.content, now, now],
    ).context("creating folder draft")?;
    let id = conn.last_insert_rowid();
    get(pool, id)?.context("folder draft not found after creation")
}

pub fn get(pool: &DbPool, id: i64) -> anyhow::Result<Option<FolderDraft>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare("SELECT id, doc_group_id, name, content, created_at, updated_at FROM folder_drafts WHERE id = ?1")?;
    let draft = stmt.query_row(rusqlite::params![id], |row| {
        Ok(FolderDraft { id: row.get(0)?, doc_group_id: row.get(1)?, name: row.get(2)?, content: row.get(3)?, created_at: row.get(4)?, updated_at: row.get(5)? })
    }).optional()?;
    Ok(draft)
}

pub fn list(pool: &DbPool, doc_group_id: i64) -> anyhow::Result<Vec<FolderDraft>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare("SELECT id, doc_group_id, name, content, created_at, updated_at FROM folder_drafts WHERE doc_group_id = ?1 ORDER BY id")?;
    let rows = stmt.query_map(rusqlite::params![doc_group_id], |row| {
        Ok(FolderDraft { id: row.get(0)?, doc_group_id: row.get(1)?, name: row.get(2)?, content: row.get(3)?, created_at: row.get(4)?, updated_at: row.get(5)? })
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
