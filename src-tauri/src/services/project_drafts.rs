use crate::db::DbPool;
use crate::models::{ProjectDraft, ProjectDraftCreate, ProjectDraftUpdate};
use anyhow::Context;
use chrono::Utc;
use rusqlite::OptionalExtension;

pub fn create(pool: &DbPool, project_id: i64, req: ProjectDraftCreate) -> anyhow::Result<ProjectDraft> {
    let conn = pool.get()?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "INSERT INTO project_drafts (project_id, name, content, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![project_id, req.name, req.content, now, now],
    ).context("creating project draft")?;
    let id = conn.last_insert_rowid();
    get(pool, id)?.context("project draft not found after creation")
}

pub fn get(pool: &DbPool, id: i64) -> anyhow::Result<Option<ProjectDraft>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare("SELECT id, project_id, name, content, created_at, updated_at FROM project_drafts WHERE id = ?1")?;
    let draft = stmt.query_row(rusqlite::params![id], |row| {
        Ok(ProjectDraft { id: row.get(0)?, project_id: row.get(1)?, name: row.get(2)?, content: row.get(3)?, created_at: row.get(4)?, updated_at: row.get(5)? })
    }).optional()?;
    Ok(draft)
}

pub fn list(pool: &DbPool, project_id: i64) -> anyhow::Result<Vec<ProjectDraft>> {
    let conn = pool.get()?;
    let mut stmt = conn.prepare("SELECT id, project_id, name, content, created_at, updated_at FROM project_drafts WHERE project_id = ?1 ORDER BY updated_at DESC")?;
    let rows = stmt.query_map(rusqlite::params![project_id], |row| {
        Ok(ProjectDraft { id: row.get(0)?, project_id: row.get(1)?, name: row.get(2)?, content: row.get(3)?, created_at: row.get(4)?, updated_at: row.get(5)? })
    })?;
    Ok(rows.collect::<Result<Vec<_>, _>>()?)
}

pub fn update(pool: &DbPool, id: i64, req: ProjectDraftUpdate) -> anyhow::Result<ProjectDraft> {
    let conn = pool.get()?;
    let now = Utc::now().to_rfc3339();
    let current = get(pool, id)?.context("project draft not found")?;
    let new_name = req.name.unwrap_or(current.name);
    let new_content = req.content.unwrap_or(current.content);
    conn.execute("UPDATE project_drafts SET name = ?1, content = ?2, updated_at = ?3 WHERE id = ?4", rusqlite::params![new_name, new_content, now, id]).context("updating project draft")?;
    get(pool, id)?.context("project draft not found after update")
}

pub fn delete(pool: &DbPool, id: i64) -> anyhow::Result<()> {
    let conn = pool.get()?;
    let n = conn.execute("DELETE FROM project_drafts WHERE id = ?1", rusqlite::params![id]).context("deleting project draft")?;
    if n == 0 { anyhow::bail!("project draft not found"); }
    Ok(())
}

pub fn delete_all_for_project(pool: &DbPool, project_id: i64) -> anyhow::Result<()> {
    let conn = pool.get()?;
    conn.execute("DELETE FROM project_drafts WHERE project_id = ?1", rusqlite::params![project_id]).context("deleting project drafts for project")?;
    Ok(())
}
