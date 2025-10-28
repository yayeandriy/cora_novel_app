use crate::db::{DbPool, get_conn};
use crate::models::{DocGroup};
use anyhow::Result;

pub fn list_doc_groups(pool: &DbPool, project_id: i64) -> Result<Vec<DocGroup>> {
    let conn = get_conn(pool)?;
    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, parent_id, sort_order 
         FROM doc_groups 
         WHERE project_id = ?1 
         ORDER BY COALESCE(parent_id, 0), sort_order"
    )?;
    
    let groups = stmt.query_map([project_id], |row| {
        Ok(DocGroup {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            parent_id: row.get(3)?,
            sort_order: row.get(4)?,
        })
    })?
    .collect::<std::result::Result<Vec<_>, _>>()?;
    
    Ok(groups)
}

pub fn create_doc_group(pool: &DbPool, project_id: i64, name: &str, parent_id: Option<i64>) -> Result<DocGroup> {
    let conn = get_conn(pool)?;
    
    // Get the next sort_order for this parent
    let next_order: i64 = conn.query_row(
        "SELECT COALESCE(MAX(sort_order), -1) + 1 FROM doc_groups WHERE project_id = ?1 AND parent_id IS ?2",
        rusqlite::params![project_id, parent_id],
        |row| row.get(0)
    )?;
    
    conn.execute(
        "INSERT INTO doc_groups (project_id, name, parent_id, sort_order) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![project_id, name, parent_id, next_order]
    )?;
    
    let id = conn.last_insert_rowid();
    
    Ok(DocGroup {
        id,
        project_id,
        name: name.to_string(),
        parent_id,
        sort_order: Some(next_order),
    })
}

pub fn create_doc_group_after(pool: &DbPool, project_id: i64, name: &str, parent_id: Option<i64>, after_sort_order: i64) -> Result<DocGroup> {
    let conn = get_conn(pool)?;
    
    // Insert after the specified position
    // First, increment all items with sort_order > after
    conn.execute(
        "UPDATE doc_groups SET sort_order = sort_order + 1 
         WHERE project_id = ?1 AND parent_id IS ?2 AND sort_order > ?3",
        rusqlite::params![project_id, parent_id, after_sort_order]
    )?;
    
    let next_order = after_sort_order + 1;
    
    conn.execute(
        "INSERT INTO doc_groups (project_id, name, parent_id, sort_order) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![project_id, name, parent_id, next_order]
    )?;
    
    let id = conn.last_insert_rowid();
    
    Ok(DocGroup {
        id,
        project_id,
        name: name.to_string(),
        parent_id,
        sort_order: Some(next_order),
    })
}

pub fn delete_doc_group(pool: &DbPool, id: i64) -> Result<()> {
    let conn = get_conn(pool)?;
    
    // First, get the sort_order and parent_id of the group being deleted
    let (sort_order, parent_id, project_id): (i64, Option<i64>, i64) = conn.query_row(
        "SELECT sort_order, parent_id, project_id FROM doc_groups WHERE id = ?1",
        [id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    )?;
    
    // Delete the group (CASCADE will handle children)
    conn.execute("DELETE FROM doc_groups WHERE id = ?1", [id])?;
    
    // Reorder remaining groups in the same parent
    conn.execute(
        "UPDATE doc_groups SET sort_order = sort_order - 1 
         WHERE project_id = ?1 AND parent_id IS ?2 AND sort_order > ?3",
        rusqlite::params![project_id, parent_id, sort_order]
    )?;
    
    Ok(())
}

pub fn reorder_doc_group(pool: &DbPool, id: i64, direction: &str) -> Result<()> {
    let conn = get_conn(pool)?;
    
    // Get current group info
    let (current_order, parent_id, project_id): (i64, Option<i64>, i64) = conn.query_row(
        "SELECT sort_order, parent_id, project_id FROM doc_groups WHERE id = ?1",
        [id],
        |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?))
    )?;
    
    let new_order = match direction {
        "up" if current_order > 0 => current_order - 1,
        "down" => current_order + 1,
        _ => return Ok(()), // No change
    };
    
    // Swap with the sibling at new_order
    conn.execute(
        "UPDATE doc_groups SET sort_order = ?1 WHERE project_id = ?2 AND parent_id IS ?3 AND sort_order = ?4",
        rusqlite::params![current_order, project_id, parent_id, new_order]
    )?;
    
    conn.execute(
        "UPDATE doc_groups SET sort_order = ?1 WHERE id = ?2",
        rusqlite::params![new_order, id]
    )?;
    
    Ok(())
}

pub fn rename_doc_group(pool: &DbPool, id: i64, new_name: &str) -> Result<()> {
    let conn = get_conn(pool)?;
    conn.execute("UPDATE doc_groups SET name = ?1 WHERE id = ?2", rusqlite::params![new_name, id])?;
    Ok(())
}
