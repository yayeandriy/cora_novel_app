use crate::models::{Project, ProjectFile};
use anyhow::Result;

pub fn get(data: &ProjectFile) -> Project {
    data.project.clone()
}

pub fn update(
    data: &mut ProjectFile,
    name: Option<String>,
    desc: Option<String>,
    path: Option<String>,
    notes: Option<String>,
) -> Result<Project> {
    if let Some(n) = name {
        if n.trim().is_empty() {
            return Err(anyhow::anyhow!("name cannot be empty"));
        }
        data.project.name = n;
    }
    if let Some(d) = desc { data.project.desc = Some(d); }
    if let Some(p) = path { data.project.path = Some(p); }
    if let Some(n) = notes { data.project.notes = Some(n); }
    Ok(data.project.clone())
}

pub fn update_timeline(
    data: &mut ProjectFile,
    timeline_start: Option<String>,
    timeline_end: Option<String>,
) -> Result<Project> {
    data.project.timeline_start = timeline_start;
    data.project.timeline_end = timeline_end;
    Ok(data.project.clone())
}

pub fn clear_project_content(data: &mut ProjectFile) {
    data.groups.clear();
    data.docs.clear();
    data.characters.clear();
    data.events.clear();
    data.places.clear();
    data.doc_characters.clear();
    data.doc_events.clear();
    data.doc_places.clear();
    data.doc_group_characters.clear();
    data.doc_group_events.clear();
    data.doc_group_places.clear();
    data.drafts.clear();
    data.folder_drafts.clear();
    data.project_drafts.clear();
    data.timelines.clear();
    data.archives.clear();
    data.next_ids = Default::default();
}
