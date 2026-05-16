use crate::models::{ProjectDraft, ProjectDraftCreate, ProjectDraftUpdate, ProjectFile};
use anyhow::Result;

pub fn list(data: &ProjectFile, _project_id: i64) -> Vec<ProjectDraft> {
    data.project_drafts.clone()
}

pub fn get(data: &ProjectFile, id: i64) -> Option<ProjectDraft> {
    data.project_drafts.iter().find(|pd| pd.id == id).cloned()
}

pub fn create(data: &mut ProjectFile, project_id: i64, payload: ProjectDraftCreate) -> ProjectDraft {
    let id = data.next_ids.project_draft;
    data.next_ids.project_draft += 1;
    let pd = ProjectDraft {
        id,
        project_id,
        name: payload.name,
        content: payload.content,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    data.project_drafts.push(pd.clone());
    pd
}

pub fn update(data: &mut ProjectFile, id: i64, payload: ProjectDraftUpdate) -> Result<ProjectDraft> {
    let pd = data.project_drafts.iter_mut().find(|pd| pd.id == id)
        .ok_or_else(|| anyhow::anyhow!("ProjectDraft {} not found", id))?;
    if let Some(name) = payload.name { pd.name = name; }
    if let Some(content) = payload.content { pd.content = content; }
    Ok(pd.clone())
}

pub fn delete_(data: &mut ProjectFile, id: i64) -> Result<()> {
    data.project_drafts.iter().position(|pd| pd.id == id)
        .ok_or_else(|| anyhow::anyhow!("ProjectDraft {} not found", id))?;
    data.project_drafts.retain(|pd| pd.id != id);
    Ok(())
}

pub fn delete_all_for_project(data: &mut ProjectFile, _project_id: i64) {
    data.project_drafts.clear();
}
