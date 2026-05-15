//! Recent files list stored in `recents.db`.
//!
//! On macOS with App Sandbox enabled, direct file access is restricted to
//! user-selected files. Security-scoped bookmarks persist that access across
//! restarts. We create a bookmark whenever a file is added to recents and
//! resolve it before opening the file from a stored path.

use crate::db::DbPool;
use crate::models::RecentFile;
use anyhow::Result;
use std::path::Path;

// ─── Security-scoped bookmark helpers (macOS only) ──────────────────────────

/// Create a security-scoped bookmark for `path` and return the raw bytes.
/// Returns `None` on non-macOS or if the API fails (not fatal — we fall back
/// to direct path access which still works outside App Sandbox).
#[cfg(target_os = "macos")]
fn create_bookmark(path: &Path) -> Option<Vec<u8>> {
    use objc2_foundation::{NSString, NSURLBookmarkCreationOptions, NSURL};
    // NSURLBookmarkCreationWithSecurityScope = 1 << 11 = 2048
    const WITH_SECURITY_SCOPE: NSURLBookmarkCreationOptions =
        NSURLBookmarkCreationOptions(1 << 11);
    unsafe {
        let ns_str = NSString::from_str(&path.to_string_lossy());
        let url = NSURL::fileURLWithPath(&ns_str);
        let result = url.bookmarkDataWithOptions_includingResourceValuesForKeys_relativeToURL_error(
            WITH_SECURITY_SCOPE,
            None,
            None,
        );
        match result {
            Ok(data) => {
                let len = data.length() as usize;
                let mut buf = vec![0u8; len];
                if len > 0 {
                    use std::ptr::NonNull;
                    data.getBytes_length(NonNull::new(buf.as_mut_ptr() as *mut _).unwrap(), len as _);
                }
                Some(buf)
            }
            Err(_) => None,
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn create_bookmark(_path: &Path) -> Option<Vec<u8>> { None }

/// Resolve a stored security-scoped bookmark and start accessing it.
/// Returns the canonical path from the bookmark (may differ if file was moved).
/// The caller MUST call `stop_bookmark_access` with the returned URL when done.
/// Returns `None` if bookmark resolution fails — caller should try direct path.
#[cfg(target_os = "macos")]
pub fn start_bookmark_access(bookmark_bytes: &[u8]) -> Option<objc2::rc::Retained<objc2_foundation::NSURL>> {
    use objc2::runtime::Bool;
    use objc2_foundation::{NSData, NSURLBookmarkResolutionOptions, NSURL};
    // NSURLBookmarkResolutionWithSecurityScope = 1 << 10 = 1024
    const WITH_SECURITY_SCOPE: NSURLBookmarkResolutionOptions =
        NSURLBookmarkResolutionOptions(1 << 10);
    unsafe {
        let data = NSData::dataWithBytes_length(
            bookmark_bytes.as_ptr() as *mut _,
            bookmark_bytes.len() as _,
        );
        let mut stale = Bool::NO;
        let result = NSURL::URLByResolvingBookmarkData_options_relativeToURL_bookmarkDataIsStale_error(
            &data,
            WITH_SECURITY_SCOPE,
            None,
            &mut stale,
        );
        match result {
            Ok(url) => {
                url.startAccessingSecurityScopedResource();
                Some(url)
            }
            Err(_) => None,
        }
    }
}

#[cfg(not(target_os = "macos"))]
pub fn start_bookmark_access(_bookmark_bytes: &[u8]) -> Option<()> { None }

/// Stop accessing a security-scoped resource URL obtained from `start_bookmark_access`.
#[cfg(target_os = "macos")]
pub fn stop_bookmark_access(url: &objc2_foundation::NSURL) {
    unsafe { url.stopAccessingSecurityScopedResource(); }
}

#[cfg(not(target_os = "macos"))]
pub fn stop_bookmark_access(_url: &()) {}

// ─── CRUD ────────────────────────────────────────────────────────────────────

/// Add or refresh a recent file entry (upsert on path).
/// Also creates and stores a security-scoped bookmark for sandbox access.
pub fn touch(pool: &DbPool, path: &str, name: &str) -> Result<()> {
    let conn = crate::db::get_conn(pool)?;
    let now = chrono::Utc::now().to_rfc3339();
    let bookmark = create_bookmark(Path::new(path));
    conn.execute(
        "INSERT INTO recent_files (path, name, last_opened, bookmark) VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(path) DO UPDATE SET
             name=excluded.name,
             last_opened=excluded.last_opened,
             bookmark=COALESCE(excluded.bookmark, bookmark)",
        rusqlite::params![path, name, now, bookmark],
    )?;
    Ok(())
}

/// Return recent files ordered by most-recently opened first, max 20.
pub fn list(pool: &DbPool) -> Result<Vec<RecentFile>> {
    let conn = crate::db::get_conn(pool)?;
    let mut stmt = conn.prepare(
        "SELECT path, name, last_opened FROM recent_files ORDER BY last_opened DESC LIMIT 20",
    )?;
    let rows = stmt.query_map([], |r| {
        Ok(RecentFile {
            path: r.get(0)?,
            name: r.get(1)?,
            last_opened: r.get(2)?,
        })
    })?;
    Ok(rows.collect::<Result<_, _>>()?)
}

/// Retrieve the stored security-scoped bookmark bytes for a path, if any.
pub fn get_bookmark(pool: &DbPool, path: &str) -> Result<Option<Vec<u8>>> {
    let conn = crate::db::get_conn(pool)?;
    let result: rusqlite::Result<Option<Vec<u8>>> = conn.query_row(
        "SELECT bookmark FROM recent_files WHERE path = ?1",
        [path],
        |r| r.get(0),
    );
    Ok(result.unwrap_or(None))
}

/// Remove a recent file entry (e.g. when the file no longer exists).
pub fn remove(pool: &DbPool, path: &str) -> Result<()> {
    let conn = crate::db::get_conn(pool)?;
    conn.execute("DELETE FROM recent_files WHERE path = ?1", [path])?;
    Ok(())
}
