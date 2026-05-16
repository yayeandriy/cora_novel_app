use crate::models::{Character, DocCharacter, DocGroupCharacter, ProjectFile};
use anyhow::Result;

pub fn create(data: &mut ProjectFile, project_id: i64, name: &str, desc: Option<String>) -> Character {
    let id = data.next_ids.character;
    data.next_ids.character += 1;
    let c = Character { id, project_id, name: name.to_string(), desc };
    data.characters.push(c.clone());
    c
}

pub fn list(data: &ProjectFile, _project_id: i64) -> Vec<Character> {
    data.characters.clone()
}

pub fn update(data: &mut ProjectFile, id: i64, name: Option<String>, desc: Option<String>) -> Result<Character> {
    let c = data.characters.iter_mut().find(|c| c.id == id)
        .ok_or_else(|| anyhow::anyhow!("Character {} not found", id))?;
    if let Some(n) = name { c.name = n; }
    if desc.is_some() { c.desc = desc; }
    Ok(c.clone())
}

pub fn delete_(data: &mut ProjectFile, id: i64) -> Result<()> {
    data.characters.retain(|c| c.id != id);
    data.doc_characters.retain(|dc| dc.character_id != id);
    data.doc_group_characters.retain(|dgc| dgc.character_id != id);
    Ok(())
}

pub fn list_for_doc(data: &ProjectFile, doc_id: i64) -> Vec<i64> {
    data.doc_characters.iter()
        .filter(|dc| dc.doc_id == doc_id)
        .map(|dc| dc.character_id)
        .collect()
}

pub fn attach_to_doc(data: &mut ProjectFile, doc_id: i64, character_id: i64) -> Result<()> {
    if !data.doc_characters.iter().any(|dc| dc.doc_id == doc_id && dc.character_id == character_id) {
        data.doc_characters.push(DocCharacter { doc_id, character_id });
    }
    Ok(())
}

pub fn detach_from_doc(data: &mut ProjectFile, doc_id: i64, character_id: i64) -> Result<()> {
    data.doc_characters.retain(|dc| !(dc.doc_id == doc_id && dc.character_id == character_id));
    Ok(())
}

pub fn list_for_doc_group(data: &ProjectFile, group_id: i64) -> Vec<i64> {
    data.doc_group_characters.iter()
        .filter(|dgc| dgc.doc_group_id == group_id)
        .map(|dgc| dgc.character_id)
        .collect()
}

pub fn list_from_docs_in_group(data: &ProjectFile, group_id: i64) -> Vec<i64> {
    let doc_ids: Vec<i64> = data.docs.iter()
        .filter(|d| d.doc_group_id == Some(group_id))
        .map(|d| d.id)
        .collect();
    let mut ids: Vec<i64> = data.doc_characters.iter()
        .filter(|dc| doc_ids.contains(&dc.doc_id))
        .map(|dc| dc.character_id)
        .collect();
    ids.sort_unstable();
    ids.dedup();
    ids
}

pub fn attach_to_doc_group(data: &mut ProjectFile, group_id: i64, character_id: i64) -> Result<()> {
    if !data.doc_group_characters.iter().any(|dgc| dgc.doc_group_id == group_id && dgc.character_id == character_id) {
        data.doc_group_characters.push(DocGroupCharacter { doc_group_id: group_id, character_id });
    }
    Ok(())
}

pub fn detach_from_doc_group(data: &mut ProjectFile, group_id: i64, character_id: i64) -> Result<()> {
    data.doc_group_characters.retain(|dgc| !(dgc.doc_group_id == group_id && dgc.character_id == character_id));
    Ok(())
}
