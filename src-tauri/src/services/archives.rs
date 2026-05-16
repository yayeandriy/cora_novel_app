use crate::models::{Archive, ArchiveCreate, ArchiveUpdate, ProjectFile};
use anyhow::Result;

pub fn list(data: &ProjectFile, project_id: i64) -> Vec<Archive> {
    data.archives.iter().filter(|a| a.project_id == project_id).cloned().collect()
}

pub fn get(data: &ProjectFile, id: i64) -> Option<Archive> {
    data.archives.iter().find(|a| a.id == id).cloned()
}

pub fn create(data: &mut ProjectFile, project_id: i64, payload: ArchiveCreate) -> Archive {
    let id = data.next_ids.archive;
    data.next_ids.archive += 1;
    let a = Archive {
        id,
        project_id,
        name: payload.name,
        desc: payload.desc,
        created_at: chrono::Utc::now().to_rfc3339(),
        archived_at: payload.archived_at,
    };
    data.archives.push(a.clone());
    a
}

pub fn update(data: &mut ProjectFile, id: i64, payload: ArchiveUpdate) -> Result<Archive> {
    let a = data.archives.iter_mut().find(|a| a.id == id)
        .ok_or_else(|| anyhow::anyhow!("Archive {} not found", id))?;
    if let Some(name) = payload.name { a.name = name; }
    if payload.desc.is_some() { a.desc = payload.desc; }
    if payload.archived_at.is_some() { a.archived_at = payload.archived_at; }
    Ok(a.clone())
}

pub fn delete_(data: &mut ProjectFile, id: i64) -> Result<()> {
    data.archives.iter().position(|a| a.id == id)
        .ok_or_else(|| anyhow::anyhow!("Archive {} not found", id))?;
    data.archives.retain(|a| a.id != id);
    Ok(())
}
