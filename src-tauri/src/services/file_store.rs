//! Persistence layer for the JSON-based `.cora` project format.
//!
//! A `.cora` file is simply a JSON file (`ProjectFile` serialised with serde_json).
//! Old formats (ZIP and SQLite) are migrated on first open.

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

use crate::models::{
    Archive, Character, Doc, DocCharacter, DocEvent, DocGroup, DocGroupCharacter,
    DocGroupEvent, DocGroupPlace, DocPlace, Draft, DraftCreate, Event, FolderDraft,
    NextIds, Place, Project, ProjectDraft, ProjectFile, Timeline,
};

// ─── Save / load ─────────────────────────────────────────────────────────────

pub fn save_project(path: &Path, data: &ProjectFile) -> Result<()> {
    let json = serde_json::to_string_pretty(data).context("serialising project")?;
    std::fs::write(path, json).context("writing project file")?;
    Ok(())
}

pub fn load_project(path: &Path) -> Result<ProjectFile> {
    let json = std::fs::read_to_string(path).context("reading project file")?;
    let data: ProjectFile = serde_json::from_str(&json).context("deserialising project")?;
    Ok(data)
}

// ─── Format detection ─────────────────────────────────────────────────────────

pub fn is_zip_file(path: &Path) -> bool {
    if let Ok(mut f) = std::fs::File::open(path) {
        use std::io::Read;
        let mut magic = [0u8; 4];
        return f.read_exact(&mut magic).is_ok() && &magic == b"PK\x03\x04";
    }
    false
}

pub fn is_sqlite_file(path: &Path) -> bool {
    if let Ok(mut f) = std::fs::File::open(path) {
        use std::io::Read;
        let mut magic = [0u8; 16];
        return f.read_exact(&mut magic).is_ok()
            && magic.starts_with(b"SQLite format 3\0");
    }
    false
}

// ─── Migrations ───────────────────────────────────────────────────────────────

/// Migrate a legacy ZIP `.cora` file (old export format) to the new JSON format.
/// The zip contained a `metadata.json` at its root; the rest was doc content.
pub fn migrate_zip_to_json(zip_path: &Path) -> Result<ProjectFile> {
    use std::io::Read;
    let file = std::fs::File::open(zip_path).context("opening zip")?;
    let mut archive = zip::ZipArchive::new(file).context("reading zip")?;

    // Try to read metadata.json from the zip
    let metadata: serde_json::Value = {
        let mut entry = archive
            .by_name("metadata.json")
            .context("metadata.json not found in zip")?;
        let mut buf = String::new();
        entry.read_to_string(&mut buf)?;
        serde_json::from_str(&buf).context("parsing metadata.json")?
    };

    // Build a minimal ProjectFile from the metadata
    let project_name = metadata["project"]["name"]
        .as_str()
        .unwrap_or("Imported Project")
        .to_string();

    let project = Project {
        id: 1,
        name: project_name,
        desc: metadata["project"]["desc"].as_str().map(String::from),
        path: Some(zip_path.to_string_lossy().into_owned()),
        notes: metadata["project"]["notes"].as_str().map(String::from),
        timeline_start: None,
        timeline_end: None,
        grid_order: None,
        created_at: None,
        updated_at: None,
    };

    let mut data = ProjectFile {
        project,
        groups: vec![],
        docs: vec![],
        characters: vec![],
        events: vec![],
        places: vec![],
        doc_characters: vec![],
        doc_events: vec![],
        doc_places: vec![],
        doc_group_characters: vec![],
        doc_group_events: vec![],
        doc_group_places: vec![],
        drafts: vec![],
        folder_drafts: vec![],
        project_drafts: vec![],
        timelines: vec![],
        archives: vec![],
        next_ids: NextIds::default(),
    };

    // Populate groups
    if let Some(groups) = metadata["groups"].as_array() {
        for g in groups {
            let id = g["id"].as_i64().unwrap_or(0);
            data.groups.push(DocGroup {
                id,
                project_id: 1,
                name: g["name"].as_str().unwrap_or("").to_string(),
                parent_id: g["parentId"].as_i64(),
                sort_order: g["sortOrder"].as_i64(),
                notes: g["notes"].as_str().map(String::from),
            });
            if id >= data.next_ids.doc_group {
                data.next_ids.doc_group = id + 1;
            }
        }
    }

    // Populate docs
    if let Some(docs) = metadata["docs"].as_array() {
        for d in docs {
            let id = d["id"].as_i64().unwrap_or(0);
            // Try to read doc content from zip
            let text = archive
                .by_name(&format!("docs/{}.txt", id))
                .ok()
                .and_then(|mut e| {
                    let mut buf = String::new();
                    e.read_to_string(&mut buf).ok().map(|_| buf)
                });
            data.docs.push(Doc {
                id,
                project_id: 1,
                path: String::new(),
                name: d["name"].as_str().map(String::from),
                timeline_id: d["timelineId"].as_i64(),
                text,
                notes: d["notes"].as_str().map(String::from),
                doc_group_id: d["docGroupId"].as_i64(),
                sort_order: d["sortOrder"].as_i64(),
            });
            if id >= data.next_ids.doc {
                data.next_ids.doc = id + 1;
            }
        }
    }

    Ok(data)
}

/// Migrate a legacy SQLite `.cora` file to the new JSON format.
pub fn migrate_sqlite_to_json(sqlite_path: &Path) -> Result<ProjectFile> {
    use rusqlite::Connection;

    let conn = Connection::open(sqlite_path).context("opening sqlite db")?;

    // Project
    let project = conn
        .query_row(
            "SELECT id, name, desc, path, notes, timeline_start, timeline_end, grid_order, created_at, updated_at FROM projects LIMIT 1",
            [],
            |row| {
                Ok(Project {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    desc: row.get(2)?,
                    path: row.get(3)?,
                    notes: row.get(4)?,
                    timeline_start: row.get(5)?,
                    timeline_end: row.get(6)?,
                    grid_order: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            },
        )
        .context("reading project row")?;

    let project_id = project.id;
    let mut next_ids = NextIds::default();

    // DocGroups
    let mut stmt = conn.prepare(
        "SELECT id, project_id, name, parent_id, sort_order, notes FROM doc_groups WHERE project_id = ?1",
    )?;
    let groups: Vec<DocGroup> = stmt
        .query_map([project_id], |row| {
            Ok(DocGroup {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                parent_id: row.get(3)?,
                sort_order: row.get(4)?,
                notes: row.get(5)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    if let Some(max_id) = groups.iter().map(|g| g.id).max() {
        next_ids.doc_group = max_id + 1;
    }

    // Docs
    let mut stmt = conn.prepare(
        "SELECT id, project_id, path, name, timeline_id, text, notes, doc_group_id, sort_order FROM docs WHERE project_id = ?1",
    )?;
    let docs: Vec<Doc> = stmt
        .query_map([project_id], |row| {
            Ok(Doc {
                id: row.get(0)?,
                project_id: row.get(1)?,
                path: row.get(2)?,
                name: row.get(3)?,
                timeline_id: row.get(4)?,
                text: row.get(5)?,
                notes: row.get(6)?,
                doc_group_id: row.get(7)?,
                sort_order: row.get(8)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    if let Some(max_id) = docs.iter().map(|d| d.id).max() {
        next_ids.doc = max_id + 1;
    }

    // Characters
    let mut stmt =
        conn.prepare("SELECT id, project_id, name, desc FROM characters WHERE project_id = ?1")?;
    let characters: Vec<Character> = stmt
        .query_map([project_id], |row| {
            Ok(Character {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                desc: row.get(3)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    if let Some(max_id) = characters.iter().map(|c| c.id).max() {
        next_ids.character = max_id + 1;
    }

    // Events
    let mut stmt = conn
        .prepare("SELECT id, project_id, name, desc FROM events WHERE project_id = ?1")?;
    let events: Vec<Event> = stmt
        .query_map([project_id], |row| {
            Ok(Event {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                desc: row.get(3)?,
                date: None,
                start_date: None,
                end_date: None,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    if let Some(max_id) = events.iter().map(|e| e.id).max() {
        next_ids.event = max_id + 1;
    }

    // Places
    let mut stmt = conn
        .prepare("SELECT id, project_id, name, desc FROM places WHERE project_id = ?1")?;
    let places: Vec<Place> = stmt
        .query_map([project_id], |row| {
            Ok(Place {
                id: row.get(0)?,
                project_id: row.get(1)?,
                name: row.get(2)?,
                desc: row.get(3)?,
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    if let Some(max_id) = places.iter().map(|p| p.id).max() {
        next_ids.place = max_id + 1;
    }

    // Doc–Character join
    let doc_characters: Vec<DocCharacter> = {
        let mut stmt = conn.prepare(
            "SELECT doc_id, character_id FROM doc_characters WHERE doc_id IN (SELECT id FROM docs WHERE project_id = ?1)",
        )?;
        let rows = stmt.query_map([project_id], |row| {
            Ok(DocCharacter { doc_id: row.get(0)?, character_id: row.get(1)? })
        })?;
        rows.collect::<rusqlite::Result<_>>()?
    };

    let doc_events: Vec<DocEvent> = {
        let mut stmt = conn.prepare(
            "SELECT doc_id, event_id FROM doc_events WHERE doc_id IN (SELECT id FROM docs WHERE project_id = ?1)",
        )?;
        let rows = stmt.query_map([project_id], |row| {
            Ok(DocEvent { doc_id: row.get(0)?, event_id: row.get(1)? })
        })?;
        rows.collect::<rusqlite::Result<_>>()?
    };

    let doc_places: Vec<DocPlace> = {
        let mut stmt = conn.prepare(
            "SELECT doc_id, place_id FROM doc_places WHERE doc_id IN (SELECT id FROM docs WHERE project_id = ?1)",
        )?;
        let rows = stmt.query_map([project_id], |row| {
            Ok(DocPlace { doc_id: row.get(0)?, place_id: row.get(1)? })
        })?;
        rows.collect::<rusqlite::Result<_>>()?
    };

    // DocGroup join tables (best-effort — old schema may not have these)
    let doc_group_characters: Vec<DocGroupCharacter> = conn
        .prepare("SELECT doc_group_id, character_id FROM doc_group_characters WHERE doc_group_id IN (SELECT id FROM doc_groups WHERE project_id = ?1)")
        .and_then(|mut stmt| {
            stmt.query_map([project_id], |row| {
                Ok(DocGroupCharacter { doc_group_id: row.get(0)?, character_id: row.get(1)? })
            })
            .and_then(|rows| rows.collect::<rusqlite::Result<Vec<_>>>())
        })
        .unwrap_or_default();

    let doc_group_events: Vec<DocGroupEvent> = conn
        .prepare("SELECT doc_group_id, event_id FROM doc_group_events WHERE doc_group_id IN (SELECT id FROM doc_groups WHERE project_id = ?1)")
        .and_then(|mut stmt| {
            stmt.query_map([project_id], |row| {
                Ok(DocGroupEvent { doc_group_id: row.get(0)?, event_id: row.get(1)? })
            })
            .and_then(|rows| rows.collect::<rusqlite::Result<Vec<_>>>())
        })
        .unwrap_or_default();

    let doc_group_places: Vec<DocGroupPlace> = conn
        .prepare("SELECT doc_group_id, place_id FROM doc_group_places WHERE doc_group_id IN (SELECT id FROM doc_groups WHERE project_id = ?1)")
        .and_then(|mut stmt| {
            stmt.query_map([project_id], |row| {
                Ok(DocGroupPlace { doc_group_id: row.get(0)?, place_id: row.get(1)? })
            })
            .and_then(|rows| rows.collect::<rusqlite::Result<Vec<_>>>())
        })
        .unwrap_or_default();

    // Drafts
    let mut stmt = conn.prepare(
        "SELECT id, doc_id, name, content, created_at FROM drafts WHERE doc_id IN (SELECT id FROM docs WHERE project_id = ?1)",
    )?;
    let drafts: Vec<Draft> = stmt
        .query_map([project_id], |row| {
            Ok(Draft {
                id: row.get(0)?,
                doc_id: row.get(1)?,
                name: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
                updated_at: String::new(),
            })
        })?
        .collect::<rusqlite::Result<_>>()?;
    if let Some(max_id) = drafts.iter().map(|d| d.id).max() {
        next_ids.draft = max_id + 1;
    }

    // FolderDrafts
    let folder_drafts: Vec<FolderDraft> = conn
        .prepare("SELECT id, doc_group_id, name, content, sort_order, created_at, updated_at FROM folder_drafts WHERE doc_group_id IN (SELECT id FROM doc_groups WHERE project_id = ?1)")
        .and_then(|mut stmt| {
            stmt.query_map([project_id], |row| {
                Ok(FolderDraft {
                    id: row.get(0)?,
                    doc_group_id: row.get(1)?,
                    name: row.get(2)?,
                    content: row.get(3)?,
                    sort_order: row.get(4)?,
                    created_at: row.get(5)?,
                    updated_at: row.get(6)?,
                })
            })
            .and_then(|rows| rows.collect::<rusqlite::Result<Vec<_>>>())
        })
        .unwrap_or_default();
    if let Some(max_id) = folder_drafts.iter().map(|fd| fd.id).max() {
        next_ids.folder_draft = max_id + 1;
    }

    // ProjectDrafts
    let project_drafts: Vec<ProjectDraft> = conn
        .prepare("SELECT id, project_id, name, content, created_at FROM project_drafts WHERE project_id = ?1")
        .and_then(|mut stmt| {
            stmt.query_map([project_id], |row| {
                Ok(ProjectDraft {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    content: row.get(3)?,
                    created_at: row.get(4)?,
                    updated_at: String::new(),
                })
            })
            .and_then(|rows| rows.collect::<rusqlite::Result<Vec<_>>>())
        })
        .unwrap_or_default();
    if let Some(max_id) = project_drafts.iter().map(|pd| pd.id).max() {
        next_ids.project_draft = max_id + 1;
    }

    // Timelines (no project_id column in schema — filter via doc entity_ids)
    let timelines: Vec<Timeline> = conn
        .prepare("SELECT id, entity_type, entity_id, start_date, end_date FROM timelines")
        .and_then(|mut stmt| {
            stmt.query_map([], |row| {
                Ok(Timeline {
                    id: row.get(0)?,
                    entity_type: row.get(1)?,
                    entity_id: row.get(2)?,
                    start_date: row.get(3)?,
                    end_date: row.get(4)?,
                })
            })
            .and_then(|rows| rows.collect::<rusqlite::Result<Vec<_>>>())
        })
        .unwrap_or_default();
    if let Some(max_id) = timelines.iter().map(|t| t.id).max() {
        next_ids.timeline = max_id + 1;
    }

    // Archives
    let archives: Vec<Archive> = conn
        .prepare("SELECT id, project_id, name, desc, created_at, archived_at FROM archives WHERE project_id = ?1")
        .and_then(|mut stmt| {
            stmt.query_map([project_id], |row| {
                Ok(Archive {
                    id: row.get(0)?,
                    project_id: row.get(1)?,
                    name: row.get(2)?,
                    desc: row.get(3)?,
                    created_at: row.get(4)?,
                    archived_at: row.get(5)?,
                })
            })
            .and_then(|rows| rows.collect::<rusqlite::Result<Vec<_>>>())
        })
        .unwrap_or_default();
    if let Some(max_id) = archives.iter().map(|a| a.id).max() {
        next_ids.archive = max_id + 1;
    }

    Ok(ProjectFile {
        project,
        groups,
        docs,
        characters,
        events,
        places,
        doc_characters,
        doc_events,
        doc_places,
        doc_group_characters,
        doc_group_events,
        doc_group_places,
        drafts,
        folder_drafts,
        project_drafts,
        timelines,
        archives,
        next_ids,
    })
}

/// Create a blank `ProjectFile` for a brand-new project.
pub fn new_project_file(name: &str, path: &str) -> ProjectFile {
    ProjectFile {
        project: Project {
            id: 1,
            name: name.to_string(),
            desc: None,
            path: Some(path.to_string()),
            notes: None,
            timeline_start: None,
            timeline_end: None,
            grid_order: None,
            created_at: None,
            updated_at: None,
        },
        groups: vec![],
        docs: vec![],
        characters: vec![],
        events: vec![],
        places: vec![],
        doc_characters: vec![],
        doc_events: vec![],
        doc_places: vec![],
        doc_group_characters: vec![],
        doc_group_events: vec![],
        doc_group_places: vec![],
        drafts: vec![],
        folder_drafts: vec![],
        project_drafts: vec![],
        timelines: vec![],
        archives: vec![],
        next_ids: NextIds::default(),
    }
}
