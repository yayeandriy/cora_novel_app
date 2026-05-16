use crate::models::{DocGroupPlace, DocPlace, Place, ProjectFile};
use anyhow::Result;

pub fn create(data: &mut ProjectFile, project_id: i64, name: &str, desc: Option<String>) -> Place {
    let id = data.next_ids.place;
    data.next_ids.place += 1;
    let p = Place { id, project_id, name: name.to_string(), desc };
    data.places.push(p.clone());
    p
}

pub fn list(data: &ProjectFile, _project_id: i64) -> Vec<Place> {
    data.places.clone()
}

pub fn update(data: &mut ProjectFile, id: i64, name: Option<String>, desc: Option<String>) -> Result<Place> {
    let p = data.places.iter_mut().find(|p| p.id == id)
        .ok_or_else(|| anyhow::anyhow!("Place {} not found", id))?;
    if let Some(n) = name { p.name = n; }
    if desc.is_some() { p.desc = desc; }
    Ok(p.clone())
}

pub fn delete_(data: &mut ProjectFile, id: i64) -> Result<()> {
    data.places.retain(|p| p.id != id);
    data.doc_places.retain(|dp| dp.place_id != id);
    data.doc_group_places.retain(|dgp| dgp.place_id != id);
    Ok(())
}

pub fn list_for_doc(data: &ProjectFile, doc_id: i64) -> Vec<i64> {
    data.doc_places.iter()
        .filter(|dp| dp.doc_id == doc_id)
        .map(|dp| dp.place_id)
        .collect()
}

pub fn attach_to_doc(data: &mut ProjectFile, doc_id: i64, place_id: i64) -> Result<()> {
    if !data.doc_places.iter().any(|dp| dp.doc_id == doc_id && dp.place_id == place_id) {
        data.doc_places.push(DocPlace { doc_id, place_id });
    }
    Ok(())
}

pub fn detach_from_doc(data: &mut ProjectFile, doc_id: i64, place_id: i64) -> Result<()> {
    data.doc_places.retain(|dp| !(dp.doc_id == doc_id && dp.place_id == place_id));
    Ok(())
}

pub fn list_for_doc_group(data: &ProjectFile, group_id: i64) -> Vec<i64> {
    data.doc_group_places.iter()
        .filter(|dgp| dgp.doc_group_id == group_id)
        .map(|dgp| dgp.place_id)
        .collect()
}

pub fn list_from_docs_in_group(data: &ProjectFile, group_id: i64) -> Vec<i64> {
    let doc_ids: Vec<i64> = data.docs.iter()
        .filter(|d| d.doc_group_id == Some(group_id))
        .map(|d| d.id)
        .collect();
    let mut ids: Vec<i64> = data.doc_places.iter()
        .filter(|dp| doc_ids.contains(&dp.doc_id))
        .map(|dp| dp.place_id)
        .collect();
    ids.sort_unstable();
    ids.dedup();
    ids
}

pub fn attach_to_doc_group(data: &mut ProjectFile, group_id: i64, place_id: i64) -> Result<()> {
    if !data.doc_group_places.iter().any(|dgp| dgp.doc_group_id == group_id && dgp.place_id == place_id) {
        data.doc_group_places.push(DocGroupPlace { doc_group_id: group_id, place_id });
    }
    Ok(())
}

pub fn detach_from_doc_group(data: &mut ProjectFile, group_id: i64, place_id: i64) -> Result<()> {
    data.doc_group_places.retain(|dgp| !(dgp.doc_group_id == group_id && dgp.place_id == place_id));
    Ok(())
}
