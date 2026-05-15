/// Legacy `.cora` migration helpers.
///
/// Before version 0.12 Cora stored projects as ZIP archives containing a
/// `metadata.json` file.  The current format is a plain SQLite database
/// (`journal_mode=DELETE`) — one file, no sidecars, iCloud-friendly.
///
/// `migrate_if_legacy` detects the old format and — if found — converts the
/// file **in-place** (the original ZIP is renamed to `<name>.cora.bak` before
/// the new SQLite file is written).

use std::collections::HashMap;
use std::io::Read;
use std::path::Path;
use anyhow::{Context, anyhow};

// ─── Detection ───────────────────────────────────────────────────────────────

/// Returns true if `path` begins with the PK ZIP magic bytes and therefore
/// is a legacy ZIP-based `.cora` file rather than a SQLite database.
pub fn is_legacy_zip(path: &Path) -> bool {
    let mut f = match std::fs::File::open(path) {
        Ok(f) => f,
        Err(_) => return false,
    };
    let mut magic = [0u8; 4];
    matches!(f.read_exact(&mut magic), Ok(())) && &magic == b"PK\x03\x04"
}

// ─── Migration ───────────────────────────────────────────────────────────────

/// If `path` is a legacy ZIP-based `.cora` file, migrate it to SQLite in-place
/// and return the open `DbPool` ready for use.  Returns `None` if the file is
/// already in the current SQLite format — the caller should open the pool itself.
/// The original ZIP is kept as `<path>.bak` so the user can recover it.
pub fn migrate_if_legacy(path: &Path) -> anyhow::Result<Option<crate::db::DbPool>> {
    if !is_legacy_zip(path) {
        return Ok(None);
    }
    let pool = do_migrate(path)?;
    Ok(Some(pool))
}

fn do_migrate(zip_path: &Path) -> anyhow::Result<crate::db::DbPool> {
    // ── 1. Read ZIP bytes into memory (keeps them for recovery) ──────────
    let zip_bytes = std::fs::read(zip_path).context("reading legacy .cora ZIP")?;
    let cursor = std::io::Cursor::new(&zip_bytes);
    let mut archive = zip::ZipArchive::new(cursor).context("opening ZIP archive")?;

    let tmp_dir = tempfile::tempdir().context("creating temp dir for ZIP extraction")?;
    archive.extract(tmp_dir.path()).context("extracting ZIP")?;

    // ── 2. Find and parse metadata.json ──────────────────────────────────
    let meta_path = find_metadata_json(tmp_dir.path())
        .ok_or_else(|| anyhow!("metadata.json not found in legacy .cora archive"))?;

    let raw = std::fs::read_to_string(&meta_path).context("reading metadata.json")?;
    let payload: LegacyExport = serde_json::from_str(&raw).context("parsing metadata.json")?;

    // ── 3. Save a .bak copy of the original ZIP (best-effort, never fatal)
    let orig_name = zip_path.file_name().and_then(|n| n.to_str()).unwrap_or("project.cora");
    let mut bak_path = zip_path.to_path_buf();
    bak_path.set_file_name(format!("{orig_name}.bak"));
    let _ = std::fs::remove_file(&bak_path);
    let _ = std::fs::write(&bak_path, &zip_bytes);

    // ── 4. Delete the ZIP so SQLite can create a fresh file at the same path.
    // Writing SQLite directly to zip_path (rather than temp + copy) avoids
    // the cross-filesystem copy that causes iCloud Drive to briefly mark the
    // file read-only during upload, breaking subsequent writes.
    std::fs::remove_file(zip_path)
        .context("removing legacy ZIP before writing SQLite")?;

    // ── 5. Write new SQLite directly to zip_path and return the open pool ──
    // Returning the pool avoids a second open() call immediately after file
    // creation, which races with iCloud Drive locking the file for upload.
    match write_sqlite(zip_path, &payload).context("writing new SQLite database") {
        Ok(pool) => Ok(pool),
        Err(e) => {
            // Restore the original ZIP from memory so the user isn't left with nothing.
            let _ = std::fs::write(zip_path, &zip_bytes);
            Err(e)
        }
    }
}

fn write_sqlite(path: &Path, payload: &LegacyExport) -> anyhow::Result<crate::db::DbPool> {
    let pool = crate::db::open_project_pool(path).context("creating new SQLite project")?;
    let conn = crate::db::get_conn(&pool).context("getting DB connection")?;
    let now = chrono::Utc::now().to_rfc3339();

    conn.execute_batch("BEGIN EXCLUSIVE").context("begin transaction")?;
    let result = (|| -> anyhow::Result<()> {
        // Project (id=1) — created_at/updated_at are nullable (added by migration 016)
        conn.execute(
            "INSERT OR IGNORE INTO projects (id, name, desc, notes) VALUES (1, ?1, ?2, ?3)",
            rusqlite::params![payload.project.name, payload.project.desc, payload.project.notes],
        ).context("inserting project")?;

        // Doc groups — no created_at/updated_at columns on this table
        let mut group_id_map: HashMap<i64, i64> = HashMap::new();
        insert_groups(&conn, &payload.groups, &mut group_id_map)?;

        // Docs — requires path (NOT NULL), no created_at/updated_at
        let mut docs_sorted = payload.docs.clone();
        docs_sorted.sort_by_key(|d| (d.doc_group_id.unwrap_or(-1), d.sort_order.unwrap_or(0)));
        let mut doc_id_map: HashMap<i64, i64> = HashMap::new();
        for d in &docs_sorted {
            let name = d.name.clone().unwrap_or_else(|| "Untitled".into());
            let new_group = d.doc_group_id.and_then(|old| group_id_map.get(&old).copied());
            let new_id = insert_doc(&conn, 1, &name, new_group, &d.text, &d.notes, d.sort_order)?;
            doc_id_map.insert(d.id, new_id);
        }

        // Drafts — has created_at/updated_at; content NOT NULL
        for (old_doc_id_str, drafts) in &payload.drafts_by_doc {
            let old_doc_id: i64 = old_doc_id_str.parse().unwrap_or(-1);
            if let Some(&new_doc_id) = doc_id_map.get(&old_doc_id) {
                for dr in drafts {
                    let content = dr.content.clone().unwrap_or_default();
                    conn.execute(
                        "INSERT OR IGNORE INTO drafts (doc_id, name, content, created_at, updated_at) \
                         VALUES (?1, ?2, ?3, ?4, ?4)",
                        rusqlite::params![new_doc_id, dr.name, content, now],
                    ).context("inserting draft")?;
                }
            }
        }

        // Folder drafts — has created_at/updated_at; content NOT NULL
        for (old_group_id_str, fds) in &payload.folder_drafts_by_group {
            let old_group_id: i64 = old_group_id_str.parse().unwrap_or(-1);
            if let Some(&new_group_id) = group_id_map.get(&old_group_id) {
                for fd in fds {
                    let content = fd.content.clone().unwrap_or_default();
                    conn.execute(
                        "INSERT OR IGNORE INTO folder_drafts (doc_group_id, name, content, created_at, updated_at) \
                         VALUES (?1, ?2, ?3, ?4, ?4)",
                        rusqlite::params![new_group_id, fd.name, content, now],
                    ).context("inserting folder draft")?;
                }
            }
        }

        // Characters — no created_at/updated_at
        let mut char_id_map: HashMap<i64, i64> = HashMap::new();
        for c in &payload.characters {
            conn.execute(
                "INSERT INTO characters (project_id, name, desc) VALUES (1, ?1, ?2)",
                rusqlite::params![c.name, c.desc],
            ).context("inserting character")?;
            char_id_map.insert(c.id, conn.last_insert_rowid());
        }

        // Events — no created_at/updated_at
        let mut event_id_map: HashMap<i64, i64> = HashMap::new();
        for e in &payload.events {
            conn.execute(
                "INSERT INTO events (project_id, name, desc, date, start_date, end_date) \
                 VALUES (1, ?1, ?2, ?3, ?4, ?5)",
                rusqlite::params![e.name, e.desc, e.date, e.start_date, e.end_date],
            ).context("inserting event")?;
            event_id_map.insert(e.id, conn.last_insert_rowid());
        }

        // Places — no created_at/updated_at
        let mut place_id_map: HashMap<i64, i64> = HashMap::new();
        for p in &payload.places {
            conn.execute(
                "INSERT INTO places (project_id, name, desc) VALUES (1, ?1, ?2)",
                rusqlite::params![p.name, p.desc],
            ).context("inserting place")?;
            place_id_map.insert(p.id, conn.last_insert_rowid());
        }

        // Junction tables
        for (old_doc_id_str, old_char_ids) in &payload.doc_characters {
            let old_doc_id: i64 = old_doc_id_str.parse().unwrap_or(-1);
            if let Some(&new_doc_id) = doc_id_map.get(&old_doc_id) {
                for old_ch in old_char_ids {
                    if let Some(&new_ch) = char_id_map.get(old_ch) {
                        let _ = conn.execute(
                            "INSERT OR IGNORE INTO doc_characters (doc_id, character_id) VALUES (?1, ?2)",
                            rusqlite::params![new_doc_id, new_ch],
                        );
                    }
                }
            }
        }
        for (old_doc_id_str, old_ev_ids) in &payload.doc_events {
            let old_doc_id: i64 = old_doc_id_str.parse().unwrap_or(-1);
            if let Some(&new_doc_id) = doc_id_map.get(&old_doc_id) {
                for old_ev in old_ev_ids {
                    if let Some(&new_ev) = event_id_map.get(old_ev) {
                        let _ = conn.execute(
                            "INSERT OR IGNORE INTO doc_events (doc_id, event_id) VALUES (?1, ?2)",
                            rusqlite::params![new_doc_id, new_ev],
                        );
                    }
                }
            }
        }
        for (old_doc_id_str, old_pl_ids) in &payload.doc_places {
            let old_doc_id: i64 = old_doc_id_str.parse().unwrap_or(-1);
            if let Some(&new_doc_id) = doc_id_map.get(&old_doc_id) {
                for old_pl in old_pl_ids {
                    if let Some(&new_pl) = place_id_map.get(old_pl) {
                        let _ = conn.execute(
                            "INSERT OR IGNORE INTO doc_places (doc_id, place_id) VALUES (?1, ?2)",
                            rusqlite::params![new_doc_id, new_pl],
                        );
                    }
                }
            }
        }

        // Timelines
        if let Some(tl) = &payload.project_timeline {
            let _ = conn.execute(
                "INSERT OR IGNORE INTO timelines (entity_type, entity_id, start_date, end_date) \
                 VALUES ('project', 1, ?1, ?2)",
                rusqlite::params![tl.start_date, tl.end_date],
            );
        }
        for (old_doc_id_str, maybe_tl) in &payload.doc_timelines {
            let old_doc_id: i64 = old_doc_id_str.parse().unwrap_or(-1);
            if let Some(&new_doc_id) = doc_id_map.get(&old_doc_id) {
                if let Some(tl) = maybe_tl {
                    let _ = conn.execute(
                        "INSERT OR IGNORE INTO timelines (entity_type, entity_id, start_date, end_date) \
                         VALUES ('doc', ?1, ?2, ?3)",
                        rusqlite::params![new_doc_id, tl.start_date, tl.end_date],
                    );
                }
            }
        }

        Ok(())
    })();

    match result {
        Ok(()) => { conn.execute_batch("COMMIT").context("commit")?; Ok(pool) }
        Err(e) => { let _ = conn.execute_batch("ROLLBACK"); Err(e) }
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

fn find_metadata_json(root: &Path) -> Option<std::path::PathBuf> {
    let direct = root.join("metadata.json");
    if direct.exists() { return Some(direct); }
    // One level down
    if let Ok(entries) = std::fs::read_dir(root) {
        for entry in entries.flatten() {
            let p = entry.path();
            if p.is_dir() {
                let candidate = p.join("metadata.json");
                if candidate.exists() { return Some(candidate); }
            }
        }
    }
    None
}

/// Recursively insert doc groups, building the old→new id map.
fn insert_groups(
    conn: &rusqlite::Connection,
    groups: &[LegacyGroup],
    id_map: &mut HashMap<i64, i64>,
) -> anyhow::Result<()> {
    // Topological insert: parents before children.
    let mut by_parent: HashMap<Option<i64>, Vec<&LegacyGroup>> = HashMap::new();
    for g in groups {
        by_parent.entry(g.parent_id).or_default().push(g);
    }
    for v in by_parent.values_mut() {
        v.sort_by_key(|g| g.sort_order.unwrap_or(0));
    }
    // BFS from roots
    let mut queue: std::collections::VecDeque<(Option<i64>, Option<i64>)> = std::collections::VecDeque::new();
    queue.push_back((None, None)); // (old_parent_id, new_parent_id)
    while let Some((old_parent_id, new_parent_id)) = queue.pop_front() {
        if let Some(children) = by_parent.get(&old_parent_id) {
            for g in children {
                conn.execute(
                    "INSERT INTO doc_groups (project_id, name, parent_id, sort_order, notes) \
                     VALUES (1, ?1, ?2, ?3, ?4)",
                    rusqlite::params![g.name, new_parent_id, g.sort_order.unwrap_or(0), g.notes],
                ).context("inserting doc_group")?;
                let new_id = conn.last_insert_rowid();
                id_map.insert(g.id, new_id);
                queue.push_back((Some(g.id), Some(new_id)));
            }
        }
    }
    Ok(())
}

fn insert_doc(
    conn: &rusqlite::Connection,
    project_id: i64,
    name: &str,
    group_id: Option<i64>,
    text: &Option<String>,
    notes: &Option<String>,
    sort_order: Option<i64>,
) -> anyhow::Result<i64> {
    // path is NOT NULL in the schema; use empty string (same as create_doc service).
    conn.execute(
        "INSERT INTO docs (project_id, doc_group_id, name, path, text, notes, sort_order) \
         VALUES (?1, ?2, ?3, '', ?4, ?5, ?6)",
        rusqlite::params![project_id, group_id, name, text.as_deref().unwrap_or(""), notes, sort_order.unwrap_or(0)],
    ).context("inserting doc")?;
    Ok(conn.last_insert_rowid())
}

// ─── Deserialization types for metadata.json ─────────────────────────────────

#[derive(serde::Deserialize, Clone)]
struct LegacyProject {
    name: String,
    desc: Option<String>,
    notes: Option<String>,
}

#[derive(serde::Deserialize, Clone)]
struct LegacyGroup {
    id: i64,
    name: String,
    parent_id: Option<i64>,
    sort_order: Option<i64>,
    notes: Option<String>,
}

#[derive(serde::Deserialize, Clone)]
struct LegacyDoc {
    id: i64,
    name: Option<String>,
    doc_group_id: Option<i64>,
    sort_order: Option<i64>,
    text: Option<String>,
    notes: Option<String>,
}

#[derive(serde::Deserialize, Clone)]
struct LegacyDraft {
    name: String,
    content: Option<String>,
}

#[derive(serde::Deserialize, Clone)]
struct LegacyFolderDraft {
    name: String,
    content: Option<String>,
}

#[derive(serde::Deserialize, Clone)]
struct LegacyCharacter {
    id: i64,
    name: String,
    desc: Option<String>,
}

#[derive(serde::Deserialize, Clone)]
struct LegacyEvent {
    id: i64,
    name: String,
    desc: Option<String>,
    date: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
}

#[derive(serde::Deserialize, Clone)]
struct LegacyPlace {
    id: i64,
    name: String,
    desc: Option<String>,
}

#[derive(serde::Deserialize, Clone)]
struct LegacyTimeline {
    start_date: Option<String>,
    end_date: Option<String>,
}

#[derive(serde::Deserialize)]
struct LegacyExport {
    project: LegacyProject,
    #[serde(default)]
    groups: Vec<LegacyGroup>,
    #[serde(default)]
    docs: Vec<LegacyDoc>,
    #[serde(default)]
    characters: Vec<LegacyCharacter>,
    #[serde(default)]
    events: Vec<LegacyEvent>,
    #[serde(default)]
    places: Vec<LegacyPlace>,
    #[serde(default)]
    doc_characters: HashMap<String, Vec<i64>>,
    #[serde(default)]
    doc_events: HashMap<String, Vec<i64>>,
    #[serde(default)]
    doc_places: HashMap<String, Vec<i64>>,
    project_timeline: Option<LegacyTimeline>,
    #[serde(default)]
    doc_timelines: HashMap<String, Option<LegacyTimeline>>,
    #[serde(default)]
    drafts_by_doc: HashMap<String, Vec<LegacyDraft>>,
    #[serde(default)]
    folder_drafts_by_group: HashMap<String, Vec<LegacyFolderDraft>>,
}
