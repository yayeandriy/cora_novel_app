use crate::models::{ProjectFile, Timeline, TimelineCreate, TimelineUpdate};
use anyhow::Result;

pub fn list_timelines(data: &ProjectFile, _project_id: i64) -> Vec<Timeline> {
    data.timelines.clone()
}

pub fn get_timeline(data: &ProjectFile, id: i64) -> Option<Timeline> {
    data.timelines.iter().find(|t| t.id == id).cloned()
}

pub fn get_timeline_by_entity(data: &ProjectFile, entity_type: &str, entity_id: i64) -> Option<Timeline> {
    data.timelines.iter()
        .find(|t| t.entity_type == entity_type && t.entity_id == entity_id)
        .cloned()
}

pub fn create_timeline(data: &mut ProjectFile, payload: TimelineCreate) -> Timeline {
    // Upsert: if an entry already exists for this entity, update it.
    if let Some(existing) = data.timelines.iter_mut()
        .find(|t| t.entity_type == payload.entity_type && t.entity_id == payload.entity_id)
    {
        existing.start_date = payload.start_date;
        existing.end_date = payload.end_date;
        return existing.clone();
    }
    let id = data.next_ids.timeline;
    data.next_ids.timeline += 1;
    let t = Timeline {
        id,
        entity_type: payload.entity_type,
        entity_id: payload.entity_id,
        start_date: payload.start_date,
        end_date: payload.end_date,
    };
    data.timelines.push(t.clone());
    t
}

pub fn update_timeline(data: &mut ProjectFile, id: i64, payload: TimelineUpdate) -> Result<Timeline> {
    let t = data.timelines.iter_mut().find(|t| t.id == id)
        .ok_or_else(|| anyhow::anyhow!("Timeline {} not found", id))?;
    if payload.start_date.is_some() { t.start_date = payload.start_date; }
    if payload.end_date.is_some() { t.end_date = payload.end_date; }
    Ok(t.clone())
}

pub fn delete_timeline(data: &mut ProjectFile, id: i64) -> Result<()> {
    data.timelines.iter().position(|t| t.id == id)
        .ok_or_else(|| anyhow::anyhow!("Timeline {} not found", id))?;
    data.timelines.retain(|t| t.id != id);
    Ok(())
}

pub fn delete_timeline_by_entity(data: &mut ProjectFile, entity_type: &str, entity_id: i64) -> Result<()> {
    data.timelines.retain(|t| !(t.entity_type == entity_type && t.entity_id == entity_id));
    Ok(())
}
