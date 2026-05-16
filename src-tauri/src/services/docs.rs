use crate::models::{Doc, DocSnapshot, ProjectFile};
use anyhow::Result;

pub fn list_docs(data: &ProjectFile, _project_id: i64) -> Vec<Doc> {
    data.docs.clone()
}

pub fn get_doc(data: &ProjectFile, id: i64) -> Option<Doc> {
    data.docs.iter().find(|d| d.id == id).cloned()
}

pub fn create_doc(data: &mut ProjectFile, project_id: i64, name: &str, group_id: Option<i64>) -> Doc {
    let max_so = data.docs.iter()
        .filter(|d| d.doc_group_id == group_id)
        .filter_map(|d| d.sort_order)
        .max()
        .unwrap_or(-1);
    let id = data.next_ids.doc;
    data.next_ids.doc += 1;
    let doc = Doc {
        id, project_id, path: String::new(),
        name: Some(name.to_string()), timeline_id: None,
        text: None, notes: None,
        doc_group_id: group_id, sort_order: Some(max_so + 1),
    };
    data.docs.push(doc.clone());
    doc
}

pub fn create_doc_after(
    data: &mut ProjectFile,
    project_id: i64,
    name: &str,
    group_id: Option<i64>,
    after_sort_order: i64,
) -> Doc {
    for d in data.docs.iter_mut() {
        if d.doc_group_id == group_id {
            if let Some(so) = d.sort_order {
                if so > after_sort_order {
                    d.sort_order = Some(so + 1);
                }
            }
        }
    }
    let id = data.next_ids.doc;
    data.next_ids.doc += 1;
    let doc = Doc {
        id, project_id, path: String::new(),
        name: Some(name.to_string()), timeline_id: None,
        text: None, notes: None,
        doc_group_id: group_id, sort_order: Some(after_sort_order + 1),
    };
    data.docs.push(doc.clone());
    doc
}

/// Internal create used by import helpers — accepts full content.
pub fn create(
    data: &mut ProjectFile,
    project_id: i64,
    path: &str,
    name: Option<String>,
    group_id: Option<i64>,
    text: Option<String>,
) -> Doc {
    let max_so = data.docs.iter()
        .filter(|d| d.doc_group_id == group_id)
        .filter_map(|d| d.sort_order)
        .max()
        .unwrap_or(-1);
    let id = data.next_ids.doc;
    data.next_ids.doc += 1;
    let doc = Doc {
        id, project_id, path: path.to_string(),
        name, timeline_id: None,
        text, notes: None,
        doc_group_id: group_id, sort_order: Some(max_so + 1),
    };
    data.docs.push(doc.clone());
    doc
}

pub fn update_doc(data: &mut ProjectFile, id: i64, text: &str) -> Result<()> {
    let doc = data.docs.iter_mut().find(|d| d.id == id)
        .ok_or_else(|| anyhow::anyhow!("Doc {} not found", id))?;
    doc.text = Some(text.to_string());
    Ok(())
}

pub fn update_doc_notes(data: &mut ProjectFile, id: i64, notes: &str) -> Result<()> {
    let doc = data.docs.iter_mut().find(|d| d.id == id)
        .ok_or_else(|| anyhow::anyhow!("Doc {} not found", id))?;
    doc.notes = Some(notes.to_string());
    Ok(())
}

pub fn delete_doc(data: &mut ProjectFile, id: i64) -> Result<()> {
    data.docs.iter().position(|d| d.id == id)
        .ok_or_else(|| anyhow::anyhow!("Doc {} not found", id))?;
    data.docs.retain(|d| d.id != id);
    data.drafts.retain(|dr| dr.doc_id != id);
    data.doc_characters.retain(|dc| dc.doc_id != id);
    data.doc_events.retain(|de| de.doc_id != id);
    data.doc_places.retain(|dp| dp.doc_id != id);
    Ok(())
}

pub fn restore_doc(
    data: &mut ProjectFile,
    project_id: i64,
    group_id: Option<i64>,
    name: &str,
    sort_order: i64,
    text: &str,
    notes: &str,
) -> Doc {
    for d in data.docs.iter_mut() {
        if d.doc_group_id == group_id {
            if let Some(so) = d.sort_order {
                if so >= sort_order {
                    d.sort_order = Some(so + 1);
                }
            }
        }
    }
    let id = data.next_ids.doc;
    data.next_ids.doc += 1;
    let doc = Doc {
        id, project_id, path: String::new(),
        name: Some(name.to_string()), timeline_id: None,
        text: Some(text.to_string()),
        notes: Some(notes.to_string()),
        doc_group_id: group_id, sort_order: Some(sort_order),
    };
    data.docs.push(doc.clone());
    doc
}

pub fn reorder_doc(data: &mut ProjectFile, id: i64, direction: &str) -> Result<()> {
    let doc = data.docs.iter().find(|d| d.id == id)
        .ok_or_else(|| anyhow::anyhow!("Doc {} not found", id))?;
    let group_id = doc.doc_group_id;
    let current_so = doc.sort_order.unwrap_or(0);

    let sibling = match direction {
        "up" => data.docs.iter()
            .filter(|d| d.doc_group_id == group_id && d.id != id)
            .filter(|d| d.sort_order.unwrap_or(0) < current_so)
            .max_by_key(|d| d.sort_order.unwrap_or(0))
            .map(|d| (d.id, d.sort_order.unwrap_or(0))),
        "down" => data.docs.iter()
            .filter(|d| d.doc_group_id == group_id && d.id != id)
            .filter(|d| d.sort_order.unwrap_or(0) > current_so)
            .min_by_key(|d| d.sort_order.unwrap_or(0))
            .map(|d| (d.id, d.sort_order.unwrap_or(0))),
        _ => return Err(anyhow::anyhow!("Invalid direction: {}", direction)),
    };

    if let Some((sib_id, sib_so)) = sibling {
        for d in data.docs.iter_mut() {
            if d.id == id { d.sort_order = Some(sib_so); }
            else if d.id == sib_id { d.sort_order = Some(current_so); }
        }
    }
    Ok(())
}

pub fn move_doc_to_group(data: &mut ProjectFile, doc_id: i64, new_group_id: Option<i64>) -> Result<()> {
    let max_so = data.docs.iter()
        .filter(|d| d.doc_group_id == new_group_id && d.id != doc_id)
        .filter_map(|d| d.sort_order)
        .max()
        .unwrap_or(-1);
    let doc = data.docs.iter_mut().find(|d| d.id == doc_id)
        .ok_or_else(|| anyhow::anyhow!("Doc {} not found", doc_id))?;
    doc.doc_group_id = new_group_id;
    doc.sort_order = Some(max_so + 1);
    Ok(())
}

pub fn rename_doc(data: &mut ProjectFile, id: i64, new_name: &str) -> Result<()> {
    let doc = data.docs.iter_mut().find(|d| d.id == id)
        .ok_or_else(|| anyhow::anyhow!("Doc {} not found", id))?;
    doc.name = Some(new_name.to_string());
    Ok(())
}
