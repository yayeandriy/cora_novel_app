use crate::models::{Draft, DraftCreate, DraftUpdate, ProjectFile};
use anyhow::Result;

pub fn list_drafts(data: &ProjectFile, doc_id: i64) -> Vec<Draft> {
    data.drafts.iter().filter(|d| d.doc_id == doc_id).cloned().collect()
}

pub fn get_draft(data: &ProjectFile, id: i64) -> Option<Draft> {
    data.drafts.iter().find(|d| d.id == id).cloned()
}

pub fn create_draft(data: &mut ProjectFile, doc_id: i64, payload: DraftCreate) -> Draft {
    let id = data.next_ids.draft;
    data.next_ids.draft += 1;
    let draft = Draft {
        id,
        doc_id,
        name: payload.name,
        content: payload.content,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };
    data.drafts.push(draft.clone());
    draft
}

pub fn update_draft(data: &mut ProjectFile, id: i64, payload: DraftUpdate) -> Result<Draft> {
    let draft = data.drafts.iter_mut().find(|d| d.id == id)
        .ok_or_else(|| anyhow::anyhow!("Draft {} not found", id))?;
    if let Some(name) = payload.name { draft.name = name; }
    if let Some(content) = payload.content { draft.content = content; }
    Ok(draft.clone())
}

pub fn delete_draft(data: &mut ProjectFile, id: i64) -> Result<()> {
    data.drafts.iter().position(|d| d.id == id)
        .ok_or_else(|| anyhow::anyhow!("Draft {} not found", id))?;
    data.drafts.retain(|d| d.id != id);
    Ok(())
}

/// Restore a draft — creates a new draft with the given payload (same as create).
pub fn restore_draft(data: &mut ProjectFile, doc_id: i64, payload: DraftCreate) -> Draft {
    create_draft(data, doc_id, payload)
}

pub fn delete_all_for_doc(data: &mut ProjectFile, doc_id: i64) {
    data.drafts.retain(|d| d.doc_id != doc_id);
}
