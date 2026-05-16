use crate::models::{DocEvent, DocGroupEvent, Event, ProjectFile};
use anyhow::Result;

pub fn create(data: &mut ProjectFile, project_id: i64, name: &str, desc: Option<String>) -> Event {
    let id = data.next_ids.event;
    data.next_ids.event += 1;
    let e = Event { id, project_id, name: name.to_string(), desc, date: None, start_date: None, end_date: None };
    data.events.push(e.clone());
    e
}

pub fn list(data: &ProjectFile, _project_id: i64) -> Vec<Event> {
    data.events.clone()
}

pub fn update(data: &mut ProjectFile, id: i64, name: Option<String>, desc: Option<String>) -> Result<Event> {
    let e = data.events.iter_mut().find(|e| e.id == id)
        .ok_or_else(|| anyhow::anyhow!("Event {} not found", id))?;
    if let Some(n) = name { e.name = n; }
    if desc.is_some() { e.desc = desc; }
    Ok(e.clone())
}

pub fn delete_(data: &mut ProjectFile, id: i64) -> Result<()> {
    data.events.retain(|e| e.id != id);
    data.doc_events.retain(|de| de.event_id != id);
    data.doc_group_events.retain(|dge| dge.event_id != id);
    Ok(())
}

pub fn list_for_doc(data: &ProjectFile, doc_id: i64) -> Vec<i64> {
    data.doc_events.iter()
        .filter(|de| de.doc_id == doc_id)
        .map(|de| de.event_id)
        .collect()
}

pub fn attach_to_doc(data: &mut ProjectFile, doc_id: i64, event_id: i64) -> Result<()> {
    if !data.doc_events.iter().any(|de| de.doc_id == doc_id && de.event_id == event_id) {
        data.doc_events.push(DocEvent { doc_id, event_id });
    }
    Ok(())
}

pub fn detach_from_doc(data: &mut ProjectFile, doc_id: i64, event_id: i64) -> Result<()> {
    data.doc_events.retain(|de| !(de.doc_id == doc_id && de.event_id == event_id));
    Ok(())
}

pub fn list_for_doc_group(data: &ProjectFile, group_id: i64) -> Vec<i64> {
    data.doc_group_events.iter()
        .filter(|dge| dge.doc_group_id == group_id)
        .map(|dge| dge.event_id)
        .collect()
}

pub fn list_from_docs_in_group(data: &ProjectFile, group_id: i64) -> Vec<i64> {
    let doc_ids: Vec<i64> = data.docs.iter()
        .filter(|d| d.doc_group_id == Some(group_id))
        .map(|d| d.id)
        .collect();
    let mut ids: Vec<i64> = data.doc_events.iter()
        .filter(|de| doc_ids.contains(&de.doc_id))
        .map(|de| de.event_id)
        .collect();
    ids.sort_unstable();
    ids.dedup();
    ids
}

pub fn attach_to_doc_group(data: &mut ProjectFile, group_id: i64, event_id: i64) -> Result<()> {
    if !data.doc_group_events.iter().any(|dge| dge.doc_group_id == group_id && dge.event_id == event_id) {
        data.doc_group_events.push(DocGroupEvent { doc_group_id: group_id, event_id });
    }
    Ok(())
}

pub fn detach_from_doc_group(data: &mut ProjectFile, group_id: i64, event_id: i64) -> Result<()> {
    data.doc_group_events.retain(|dge| !(dge.doc_group_id == group_id && dge.event_id == event_id));
    Ok(())
}
