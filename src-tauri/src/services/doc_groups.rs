use crate::models::{DocGroup, DocSnapshot, ProjectFile};
use anyhow::Result;

pub fn list_doc_groups(data: &ProjectFile, _project_id: i64) -> Vec<DocGroup> {
    data.groups.clone()
}

pub fn create_doc_group(
    data: &mut ProjectFile,
    project_id: i64,
    name: &str,
    parent_id: Option<i64>,
) -> DocGroup {
    let max_so = data.groups.iter()
        .filter(|g| g.parent_id == parent_id)
        .filter_map(|g| g.sort_order)
        .max()
        .unwrap_or(-1);
    let id = data.next_ids.doc_group;
    data.next_ids.doc_group += 1;
    let group = DocGroup {
        id, project_id, name: name.to_string(),
        parent_id, sort_order: Some(max_so + 1), notes: None,
    };
    data.groups.push(group.clone());
    group
}

pub fn create_doc_group_after(
    data: &mut ProjectFile,
    project_id: i64,
    name: &str,
    parent_id: Option<i64>,
    after_sort_order: i64,
) -> DocGroup {
    for g in data.groups.iter_mut() {
        if g.parent_id == parent_id {
            if let Some(so) = g.sort_order {
                if so > after_sort_order {
                    g.sort_order = Some(so + 1);
                }
            }
        }
    }
    let id = data.next_ids.doc_group;
    data.next_ids.doc_group += 1;
    let group = DocGroup {
        id, project_id, name: name.to_string(),
        parent_id, sort_order: Some(after_sort_order + 1), notes: None,
    };
    data.groups.push(group.clone());
    group
}

fn collect_descendant_ids(data: &ProjectFile, root_id: i64) -> Vec<i64> {
    let mut ids = vec![root_id];
    let mut i = 0;
    while i < ids.len() {
        let parent = ids[i];
        let children: Vec<i64> = data.groups.iter()
            .filter(|g| g.parent_id == Some(parent))
            .map(|g| g.id)
            .collect();
        ids.extend(children);
        i += 1;
    }
    ids
}

pub fn delete_doc_group(data: &mut ProjectFile, id: i64) -> Result<()> {
    let to_delete = collect_descendant_ids(data, id);

    let doc_ids: Vec<i64> = data.docs.iter()
        .filter(|d| d.doc_group_id.map_or(false, |gid| to_delete.contains(&gid)))
        .map(|d| d.id)
        .collect();

    for did in &doc_ids {
        data.drafts.retain(|dr| dr.doc_id != *did);
        data.doc_characters.retain(|dc| dc.doc_id != *did);
        data.doc_events.retain(|de| de.doc_id != *did);
        data.doc_places.retain(|dp| dp.doc_id != *did);
    }
    data.docs.retain(|d| d.doc_group_id.map_or(true, |gid| !to_delete.contains(&gid)));
    data.folder_drafts.retain(|fd| !to_delete.contains(&fd.doc_group_id));
    data.doc_group_characters.retain(|dgc| !to_delete.contains(&dgc.doc_group_id));
    data.doc_group_events.retain(|dge| !to_delete.contains(&dge.doc_group_id));
    data.doc_group_places.retain(|dgp| !to_delete.contains(&dgp.doc_group_id));
    data.groups.retain(|g| !to_delete.contains(&g.id));
    Ok(())
}

pub fn reorder_doc_group(data: &mut ProjectFile, id: i64, direction: &str) -> Result<()> {
    let group = data.groups.iter().find(|g| g.id == id)
        .ok_or_else(|| anyhow::anyhow!("DocGroup {} not found", id))?;
    let parent_id = group.parent_id;
    let current_so = group.sort_order.unwrap_or(0);

    let sibling = match direction {
        "up" => data.groups.iter()
            .filter(|g| g.parent_id == parent_id && g.id != id)
            .filter(|g| g.sort_order.unwrap_or(0) < current_so)
            .max_by_key(|g| g.sort_order.unwrap_or(0))
            .map(|g| (g.id, g.sort_order.unwrap_or(0))),
        "down" => data.groups.iter()
            .filter(|g| g.parent_id == parent_id && g.id != id)
            .filter(|g| g.sort_order.unwrap_or(0) > current_so)
            .min_by_key(|g| g.sort_order.unwrap_or(0))
            .map(|g| (g.id, g.sort_order.unwrap_or(0))),
        _ => return Err(anyhow::anyhow!("Invalid direction: {}", direction)),
    };

    if let Some((sib_id, sib_so)) = sibling {
        for g in data.groups.iter_mut() {
            if g.id == id { g.sort_order = Some(sib_so); }
            else if g.id == sib_id { g.sort_order = Some(current_so); }
        }
    }
    Ok(())
}

pub fn rename_doc_group(data: &mut ProjectFile, id: i64, new_name: &str) -> Result<()> {
    let group = data.groups.iter_mut().find(|g| g.id == id)
        .ok_or_else(|| anyhow::anyhow!("DocGroup {} not found", id))?;
    group.name = new_name.to_string();
    Ok(())
}

pub fn update_doc_group_notes(data: &mut ProjectFile, id: i64, notes: &str) -> Result<()> {
    let group = data.groups.iter_mut().find(|g| g.id == id)
        .ok_or_else(|| anyhow::anyhow!("DocGroup {} not found", id))?;
    group.notes = Some(notes.to_string());
    Ok(())
}

pub fn restore_doc_group(
    data: &mut ProjectFile,
    project_id: i64,
    parent_id: Option<i64>,
    name: &str,
    sort_order: i64,
    notes: &str,
    docs: Vec<DocSnapshot>,
) -> DocGroup {
    for g in data.groups.iter_mut() {
        if g.parent_id == parent_id {
            if let Some(so) = g.sort_order {
                if so >= sort_order {
                    g.sort_order = Some(so + 1);
                }
            }
        }
    }
    let gid = data.next_ids.doc_group;
    data.next_ids.doc_group += 1;
    let group = DocGroup {
        id: gid, project_id, name: name.to_string(),
        parent_id, sort_order: Some(sort_order),
        notes: if notes.is_empty() { None } else { Some(notes.to_string()) },
    };
    data.groups.push(group.clone());

    for snap in docs {
        let did = data.next_ids.doc;
        data.next_ids.doc += 1;
        data.docs.push(crate::models::Doc {
            id: did, project_id, path: String::new(),
            name: Some(snap.name), timeline_id: None,
            text: Some(snap.text),
            notes: Some(snap.notes),
            doc_group_id: Some(gid), sort_order: Some(snap.sort_order),
        });
    }
    group
}
