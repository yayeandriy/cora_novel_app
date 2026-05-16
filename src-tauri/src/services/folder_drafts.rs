use crate::models::{FolderDraft, FolderDraftCreate, FolderDraftUpdate, ProjectFile};
use anyhow::Result;

pub fn list_folder_drafts(data: &ProjectFile, doc_group_id: i64) -> Vec<FolderDraft> {
    let mut drafts: Vec<FolderDraft> = data.folder_drafts.iter()
        .filter(|fd| fd.doc_group_id == doc_group_id)
        .cloned()
        .collect();
    drafts.sort_by_key(|fd| fd.sort_order.unwrap_or(i64::MAX));
    drafts
}

pub fn get_folder_draft(data: &ProjectFile, id: i64) -> Option<FolderDraft> {
    data.folder_drafts.iter().find(|fd| fd.id == id).cloned()
}

pub fn create_folder_draft(
    data: &mut ProjectFile,
    doc_group_id: i64,
    payload: FolderDraftCreate,
) -> FolderDraft {
    let now = chrono::Utc::now().to_rfc3339();
    let sort_order = if let Some(idx) = payload.insert_at_index {
        // Shift existing drafts at or beyond this index
        for fd in data.folder_drafts.iter_mut() {
            if fd.doc_group_id == doc_group_id {
                if let Some(so) = fd.sort_order {
                    if so >= idx as i64 {
                        fd.sort_order = Some(so + 1);
                    }
                }
            }
        }
        Some(idx as i64)
    } else {
        let max = data.folder_drafts.iter()
            .filter(|fd| fd.doc_group_id == doc_group_id)
            .filter_map(|fd| fd.sort_order)
            .max()
            .unwrap_or(-1);
        Some(max + 1)
    };

    let id = data.next_ids.folder_draft;
    data.next_ids.folder_draft += 1;
    let fd = FolderDraft {
        id, doc_group_id,
        name: payload.name,
        content: payload.content,
        sort_order,
        created_at: now.clone(),
        updated_at: now,
    };
    data.folder_drafts.push(fd.clone());
    fd
}

pub fn update_folder_draft(
    data: &mut ProjectFile,
    id: i64,
    payload: FolderDraftUpdate,
) -> Result<FolderDraft> {
    let now = chrono::Utc::now().to_rfc3339();
    let fd = data.folder_drafts.iter_mut().find(|fd| fd.id == id)
        .ok_or_else(|| anyhow::anyhow!("FolderDraft {} not found", id))?;
    if let Some(name) = payload.name { fd.name = name; }
    if let Some(content) = payload.content { fd.content = content; }
    fd.updated_at = now;
    Ok(fd.clone())
}

pub fn delete_folder_draft(data: &mut ProjectFile, id: i64) -> Result<()> {
    data.folder_drafts.iter().position(|fd| fd.id == id)
        .ok_or_else(|| anyhow::anyhow!("FolderDraft {} not found", id))?;
    data.folder_drafts.retain(|fd| fd.id != id);
    Ok(())
}

/// Move a folder draft to a different doc group.
pub fn move_folder_draft(data: &mut ProjectFile, id: i64, doc_group_id: i64) -> Result<FolderDraft> {
    let max_so = data.folder_drafts.iter()
        .filter(|fd| fd.doc_group_id == doc_group_id && fd.id != id)
        .filter_map(|fd| fd.sort_order)
        .max()
        .unwrap_or(-1);
    let fd = data.folder_drafts.iter_mut().find(|fd| fd.id == id)
        .ok_or_else(|| anyhow::anyhow!("FolderDraft {} not found", id))?;
    fd.doc_group_id = doc_group_id;
    fd.sort_order = Some(max_so + 1);
    fd.updated_at = chrono::Utc::now().to_rfc3339();
    Ok(fd.clone())
}

pub fn delete_all_for_group(data: &mut ProjectFile, doc_group_id: i64) {
    data.folder_drafts.retain(|fd| fd.doc_group_id != doc_group_id);
}

pub fn reorder(data: &mut ProjectFile, id: i64, direction: &str) -> Result<()> {
    let fd = data.folder_drafts.iter().find(|fd| fd.id == id)
        .ok_or_else(|| anyhow::anyhow!("FolderDraft {} not found", id))?;
    let group_id = fd.doc_group_id;
    let current_so = fd.sort_order.unwrap_or(0);

    let mut siblings: Vec<i64> = data.folder_drafts.iter()
        .filter(|fd| fd.doc_group_id == group_id)
        .filter_map(|fd| fd.sort_order)
        .collect();
    siblings.sort_unstable();

    let target_so = if direction == "up" {
        siblings.iter().rev().find(|&&so| so < current_so).copied()
    } else {
        siblings.iter().find(|&&so| so > current_so).copied()
    };

    if let Some(swap_so) = target_so {
        if let Some(other) = data.folder_drafts.iter_mut().find(|fd| fd.doc_group_id == group_id && fd.sort_order == Some(swap_so) && fd.id != id) {
            other.sort_order = Some(current_so);
        }
        if let Some(me) = data.folder_drafts.iter_mut().find(|fd| fd.id == id) {
            me.sort_order = Some(swap_so);
        }
    }
    Ok(())
}
