use crate::db::{DbPool, get_conn};
use crate::models::{Project, ProjectCreate};
use rusqlite::OptionalExtension;
use anyhow::Context;

pub fn create(pool: &DbPool, payload: ProjectCreate) -> anyhow::Result<Project> {
    let conn = get_conn(pool)?;
    conn.execute(
        "INSERT INTO projects (name, desc, path, notes, grid_order) VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![payload.name, payload.desc, payload.path, payload.notes, payload.grid_order],
    )
    .context("inserting project")?;

    let id = conn.last_insert_rowid();
    let mut stmt = conn.prepare("SELECT id, name, desc, path, notes, timeline_start, timeline_end, grid_order, created_at, updated_at FROM projects WHERE id = ?1")?;
    let project = stmt
        .query_row(rusqlite::params![id], |row| {
            Ok(Project {
                id: row.get(0)?,
                name: row.get(1)?,
                desc: row.get(2)?,
                path: row.get(3)?,
                notes: row.get(4)?,
                timeline_start: row.get(5)?,
                timeline_end: row.get(6)?,
                grid_order: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .context("querying created project")?;

    Ok(project)
}

pub fn get(pool: &DbPool, id: i64) -> anyhow::Result<Option<Project>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT id, name, desc, path, notes, timeline_start, timeline_end, grid_order, created_at, updated_at FROM projects WHERE id = ?1")?;
    let res = stmt.query_row(rusqlite::params![id], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            desc: row.get(2)?,
            path: row.get(3)?,
            notes: row.get(4)?,
            timeline_start: row.get(5)?,
            timeline_end: row.get(6)?,
            grid_order: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    }).optional()?;

    Ok(res)
}

pub fn list(pool: &DbPool) -> anyhow::Result<Vec<Project>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare("SELECT id, name, desc, path, notes, timeline_start, timeline_end, grid_order, created_at, updated_at FROM projects ORDER BY grid_order, id")?;
    let rows = stmt.query_map([], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            desc: row.get(2)?,
            path: row.get(3)?,
            notes: row.get(4)?,
            timeline_start: row.get(5)?,
            timeline_end: row.get(6)?,
            grid_order: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    })?;

    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

pub fn update(pool: &DbPool, id: i64, name: Option<String>, desc: Option<String>, path: Option<String>, notes: Option<String>) -> anyhow::Result<Project> {
    // Ensure project exists
    let existing = get(pool, id)?;
    let existing = existing.ok_or_else(|| anyhow::anyhow!("project not found"))?;

    let mut conn = get_conn(pool)?;
    let tx = conn.transaction()?;

    // Prepare updates; use current values as fallback
    let new_name = name.unwrap_or(existing.name);
    if new_name.trim().is_empty() {
        return Err(anyhow::anyhow!("name cannot be empty"));
    }
    let new_desc = desc.or(existing.desc);
    let new_path = path.or(existing.path);
    let new_notes = notes.or(existing.notes);

    tx.execute(
        "UPDATE projects SET name = ?1, desc = ?2, path = ?3, notes = ?4, updated_at = datetime('now') WHERE id = ?5",
        rusqlite::params![new_name, new_desc, new_path, new_notes, id],
    )?;

    tx.commit()?;
    // Return updated
    get(pool, id).and_then(|opt| opt.ok_or_else(|| anyhow::anyhow!("not found after update")))
}

pub fn delete(pool: &DbPool, id: i64) -> anyhow::Result<bool> {
    let mut conn = get_conn(pool)?;
    let tx = conn.transaction()?;
    // ensure exists
    let exists = tx.query_row::<i64, _, _>("SELECT id FROM projects WHERE id = ?1", rusqlite::params![id], |r| r.get(0)).optional()?;
    if exists.is_none() {
        return Ok(false);
    }
    let affected = tx.execute("DELETE FROM projects WHERE id = ?1", rusqlite::params![id])?;
    tx.commit()?;
    Ok(affected > 0)
}

/// Clears all content from a project without deleting the project itself.
/// This is used by sync to replace project content from an external file.
/// Deletes: doc_groups (and their docs via cascade), characters, events, places, 
/// project_drafts, and timelines associated with this project.
pub fn clear_project_content(pool: &DbPool, project_id: i64) -> anyhow::Result<()> {
    let mut conn = get_conn(pool)?;
    let tx = conn.transaction()?;
    
    // Verify project exists
    let exists = tx.query_row::<i64, _, _>(
        "SELECT id FROM projects WHERE id = ?1", 
        rusqlite::params![project_id], 
        |r| r.get(0)
    ).optional()?;
    if exists.is_none() {
        return Err(anyhow::anyhow!("project not found"));
    }
    
    // Delete in order that respects foreign key constraints:
    // 1. First delete doc-related associations (CASCADE should handle this, but be explicit)
    //    - doc_characters, doc_events, doc_places are CASCADE from docs
    //    - drafts are CASCADE from docs
    
    // 2. Delete docs (they CASCADE from project, but doc_groups don't have CASCADE)
    tx.execute("DELETE FROM docs WHERE project_id = ?1", rusqlite::params![project_id])?;
    
    // 3. Delete folder_drafts (CASCADE from doc_groups)
    //    Need to do this before doc_groups since doc_groups may not CASCADE properly
    tx.execute(
        "DELETE FROM folder_drafts WHERE doc_group_id IN (SELECT id FROM doc_groups WHERE project_id = ?1)",
        rusqlite::params![project_id]
    )?;
    
    // 4. Delete doc_group associations
    tx.execute(
        "DELETE FROM doc_group_characters WHERE doc_group_id IN (SELECT id FROM doc_groups WHERE project_id = ?1)",
        rusqlite::params![project_id]
    )?;
    tx.execute(
        "DELETE FROM doc_group_events WHERE doc_group_id IN (SELECT id FROM doc_groups WHERE project_id = ?1)",
        rusqlite::params![project_id]
    )?;
    tx.execute(
        "DELETE FROM doc_group_places WHERE doc_group_id IN (SELECT id FROM doc_groups WHERE project_id = ?1)",
        rusqlite::params![project_id]
    )?;
    
    // 5. Delete doc_groups (no proper CASCADE from project_id)
    tx.execute("DELETE FROM doc_groups WHERE project_id = ?1", rusqlite::params![project_id])?;
    
    // 6. Delete characters (CASCADE from project)
    tx.execute("DELETE FROM characters WHERE project_id = ?1", rusqlite::params![project_id])?;
    
    // 7. Delete events (CASCADE from project)
    tx.execute("DELETE FROM events WHERE project_id = ?1", rusqlite::params![project_id])?;
    
    // 8. Delete places (CASCADE from project)
    tx.execute("DELETE FROM places WHERE project_id = ?1", rusqlite::params![project_id])?;
    
    // 9. Delete project_drafts (CASCADE from project)
    tx.execute("DELETE FROM project_drafts WHERE project_id = ?1", rusqlite::params![project_id])?;
    
    // 10. Delete timelines for this project (entity_type = 'project' and entity_id = project_id)
    //     Also delete doc timelines (entity_type = 'doc') that belonged to docs in this project
    //     Since docs are already deleted, we just delete the project timeline
    tx.execute(
        "DELETE FROM timelines WHERE entity_type = 'project' AND entity_id = ?1",
        rusqlite::params![project_id]
    )?;
    
    // NOTE: We intentionally do NOT delete sync records here.
    // The sync record tracks the relationship between this project and its sync file,
    // and should persist even when project content is replaced via "use file" sync.
    
    tx.commit()?;
    Ok(())
}
