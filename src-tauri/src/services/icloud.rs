//! iCloud Drive integration for macOS.
//!
//! Provides:
//! - Container path resolution (no Apple entitlement calls needed — path is deterministic)
//! - File availability / placeholder detection (eviction check)
//! - NSFileManager-based download trigger for evicted files
//! - NSFileCoordinator-based coordinated reads and writes (Phase 2)
//!
//! All Objective-C API calls are behind `#[cfg(target_os = "macos")]` so the
//! crate still compiles on other platforms.

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// The iCloud container ID as it appears in the filesystem path.
/// Apple converts `com.pluton.cora` → `iCloud~com~pluton~cora`.
const ICLOUD_CONTAINER_FS_ID: &str = "iCloud~com~pluton~cora";

// ─────────────────────────────────────────────────────────────────────────────
// Path helpers (pure Rust — no ObjC required)
// ─────────────────────────────────────────────────────────────────────────────

/// Returns the path to the iCloud container's Documents folder if it exists.
///
/// macOS places ubiquity containers at:
///   `~/Library/Mobile Documents/<container>/Documents/`
pub fn get_container_documents_path() -> Option<PathBuf> {
    let path = dirs::home_dir()?
        .join("Library")
        .join("Mobile Documents")
        .join(ICLOUD_CONTAINER_FS_ID)
        .join("Documents");
    if path.exists() { Some(path) } else { None }
}

/// Returns `true` if the iCloud Drive container for Cora is available.
///
/// First tries `NSFileManager.URLForUbiquitousContainerIdentifier()` (the
/// authoritative API, requires a signed build with entitlements). If that
/// returns `nil` (dev mode, unsigned build, or iCloud API temporarily
/// unavailable), falls back to checking whether the well-known container
/// path exists on disk — this allows dev-mode use when the user has iCloud
/// Drive set up for a signed build of the app.
#[cfg(target_os = "macos")]
pub fn is_available() -> bool {
    resolve_container_url().is_some() || get_container_documents_path().is_some()
}

#[cfg(not(target_os = "macos"))]
pub fn is_available() -> bool {
    false
}

/// Calls `[NSFileManager.defaultManager
///   URLForUbiquitousContainerIdentifier:@"iCloud.com.pluton.cora"]`.
///
/// Returns `None` when:
/// - The app is not sandboxed / entitlements are not active (dev mode)
/// - The user is not signed into iCloud
/// - iCloud Drive is disabled in System Settings
#[cfg(target_os = "macos")]
fn resolve_container_url() -> Option<PathBuf> {
    use objc2_foundation::{NSFileManager, NSString};
    unsafe {
        let fm = NSFileManager::defaultManager();
        let container_id = NSString::from_str("iCloud.com.pluton.cora");
        let url = fm.URLForUbiquityContainerIdentifier(Some(&container_id))?;
        let path_ns = url.path()?;
        let path_str = path_ns.to_string();
        let mut path = PathBuf::from(path_str);
        path.push("Documents");
        // Create Documents subfolder if needed.
        let _ = std::fs::create_dir_all(&path);
        Some(path)
    }
}

/// Returns the Documents folder inside the iCloud container, creating it if
/// needed.
///
/// Resolution order on macOS:
/// 1. `URLForUbiquitousContainerIdentifier` (authoritative, signed builds)
/// 2. Well-known filesystem path `~/Library/Mobile Documents/<id>/Documents/`
///    — works in dev mode when the user has previously enabled iCloud sync
///    via a signed build.
///
/// Returns an error only when neither path resolves, which means iCloud Drive
/// is not set up for this app on this device at all.
pub fn ensure_container_documents_path() -> Result<PathBuf> {
    #[cfg(target_os = "macos")]
    {
        // Try authoritative ObjC API first.
        if let Some(path) = resolve_container_url() {
            return Ok(path);
        }
        // Fallback: check whether the container directory already exists on
        // disk. This happens in dev mode (no entitlements) when iCloud was
        // previously enabled via a signed build.
        get_container_documents_path()
            .map(|path| {
                let _ = std::fs::create_dir_all(&path);
                path
            })
            .ok_or_else(|| anyhow!(
                "iCloud Drive container folder not found on this device. \
                 Please sign in to iCloud and enable iCloud Drive, then \
                 enable iCloud sync from a signed build of Cora first."
            ))
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err(anyhow!("iCloud is only available on macOS"))
    }
}



/// Returns the canonical `.cora` path inside the iCloud container for a
/// given project name, creating the Documents folder if necessary.
pub fn project_icloud_path(project_name: &str) -> Result<PathBuf> {
    // Sanitise the project name so it is safe as a filename.
    let safe_name: String = project_name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
        .collect();
    let filename = format!("{}.cora", safe_name.trim());
    Ok(ensure_container_documents_path()?.join(filename))
}

/// Returns `true` if `path` is inside the Cora iCloud container.
pub fn is_icloud_path(path: &str) -> bool {
    path.contains("Mobile Documents") && path.contains(ICLOUD_CONTAINER_FS_ID)
}

// ─────────────────────────────────────────────────────────────────────────────
// File status
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ICloudFileStatus {
    /// The path that was checked.
    pub path: String,
    /// File is present on local disk.
    pub is_local: bool,
    /// iCloud has evicted the file; only a `.icloud` placeholder exists.
    pub is_placeholder: bool,
    /// Neither local file nor placeholder found.
    pub not_found: bool,
}

/// Checks whether a file in the iCloud container is available locally or
/// has been evicted (only a `.icloud` placeholder exists).
pub fn check_file_status(path: &Path) -> ICloudFileStatus {
    let path_str = path.to_string_lossy().into_owned();
    if path.exists() {
        return ICloudFileStatus {
            path: path_str,
            is_local: true,
            is_placeholder: false,
            not_found: false,
        };
    }
    // macOS marks evicted files with a hidden `.<name>.icloud` sibling.
    let is_placeholder = path
        .parent()
        .zip(path.file_name())
        .map(|(parent, name)| {
            parent
                .join(format!(".{}.icloud", name.to_string_lossy()))
                .exists()
        })
        .unwrap_or(false);

    ICloudFileStatus {
        path: path_str,
        is_local: false,
        is_placeholder,
        not_found: !is_placeholder,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Download trigger (macOS)
// ─────────────────────────────────────────────────────────────────────────────

/// Asks iCloud to download an evicted file back to local storage.
///
/// Uses `NSFileManager -startDownloadingUbiquitousItemAtURL:error:`, which is
/// the documented sandboxed API for triggering iCloud downloads.
#[cfg(target_os = "macos")]
pub fn trigger_download(path: &Path) -> Result<()> {
    use objc2_foundation::{NSFileManager, NSString, NSURL};
    unsafe {
        let ns_str = NSString::from_str(&path.to_string_lossy());
        let url = NSURL::fileURLWithPath(&ns_str);
        let fm = NSFileManager::defaultManager();
        // In objc2-foundation 0.2, startDownloadingUbiquitousItemAtURL:error: returns
        // Result<(), Retained<NSError>> — no out-error parameter needed.
        fm.startDownloadingUbiquitousItemAtURL_error(&url)
            .map_err(|e| anyhow!("iCloud download trigger failed: {}", e.localizedDescription()))
    }
}

#[cfg(not(target_os = "macos"))]
pub fn trigger_download(_path: &Path) -> Result<()> {
    Err(anyhow!("iCloud is only available on macOS"))
}

// ─────────────────────────────────────────────────────────────────────────────
// NSFileCoordinator — Phase 2
// ─────────────────────────────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
mod coordinator {
    use anyhow::{anyhow, Result};
    use block2::StackBlock;
    use objc2::{class, msg_send, msg_send_id, rc::{Allocated, Retained}, runtime::AnyObject};
    use objc2_foundation::{NSString, NSURL};
    use std::path::Path;
    use std::sync::{Arc, Mutex};

    /// Build a `Retained<NSURL>` from a filesystem path.
    unsafe fn path_to_nsurl(path: &Path) -> Retained<NSURL> {
        let s = NSString::from_str(&path.to_string_lossy());
        NSURL::fileURLWithPath(&s)
    }

    /// Extract the UTF-8 path string from a raw `NSURL *` passed by the
    /// coordinator into the accessor block.
    ///
    /// # Safety
    /// `raw` must be a valid, non-null Objective-C `NSURL *`.
    unsafe fn nsurl_raw_to_path(raw: *mut AnyObject) -> Result<String> {
        if raw.is_null() {
            return Err(anyhow!("Coordinator supplied a null URL"));
        }
        let path_obj: *mut AnyObject = msg_send![raw, path];
        if path_obj.is_null() {
            return Err(anyhow!("NSURL.path returned nil"));
        }
        let cstr: *const std::ffi::c_char = msg_send![path_obj, UTF8String];
        if cstr.is_null() {
            return Err(anyhow!("NSString.UTF8String returned null"));
        }
        Ok(std::ffi::CStr::from_ptr(cstr).to_string_lossy().into_owned())
    }

    /// Extract a human-readable error description from a raw `NSError *`.
    unsafe fn error_description(error: *mut AnyObject) -> String {
        if error.is_null() {
            return "unknown error".to_string();
        }
        let desc: *mut AnyObject = msg_send![error, localizedDescription];
        if desc.is_null() {
            return "no description".to_string();
        }
        let cstr: *const std::ffi::c_char = msg_send![desc, UTF8String];
        if cstr.is_null() {
            return "no description".to_string();
        }
        std::ffi::CStr::from_ptr(cstr).to_string_lossy().into_owned()
    }

    /// Create a `NSFileCoordinator` with no file presenter.
    ///
    /// We use `msg_send_id!` because objc2-foundation 0.2 does not expose
    /// `alloc` / `initWithFilePresenter:` as typed Rust methods — the class
    /// is accessed via the ObjC runtime directly.
    unsafe fn make_coordinator() -> Retained<AnyObject> {
        let alloc: Allocated<AnyObject> = msg_send_id![class!(NSFileCoordinator), alloc];
        msg_send_id![alloc, initWithFilePresenter: std::ptr::null::<AnyObject>()]
    }

    /// Perform a coordinated read of a file in the iCloud container.
    ///
    /// `NSFileCoordinator` serialises access with the iCloud daemon (`bird`),
    /// ensuring we never read a partially-downloaded or partially-written file.
    pub fn coordinated_read(path: &Path) -> Result<Vec<u8>> {
        let result: Arc<Mutex<Result<Vec<u8>>>> =
            Arc::new(Mutex::new(Err(anyhow!("read block never called"))));
        let result_clone = Arc::clone(&result);

        unsafe {
            let url = path_to_nsurl(path);
            let coordinator = make_coordinator();
            let mut error: *mut AnyObject = std::ptr::null_mut();

            // The accessor block receives the (possibly redirected) NSURL*.
            // The block argument is passed as a raw *mut AnyObject from ObjC.
            let block = StackBlock::new(move |coordinated_url: *mut AnyObject| {
                *result_clone.lock().unwrap() = nsurl_raw_to_path(coordinated_url)
                    .and_then(|p| std::fs::read(&p).map_err(Into::into));
            });

            // coordinateReadingItemAtURL:options:error:byAccessor:
            // options = 0 means NSFileCoordinatorReadingOptions (none)
            let _: () = msg_send![
                &*coordinator,
                coordinateReadingItemAtURL: &*url
                options: 0usize
                error: &mut error
                byAccessor: &block
            ];

            if !error.is_null() {
                return Err(anyhow!(
                    "NSFileCoordinator read error: {}",
                    error_description(error)
                ));
            }
        }

        Arc::try_unwrap(result).unwrap().into_inner().unwrap()
    }

    /// Perform a coordinated write of a file in the iCloud container.
    ///
    /// After the write completes `bird` picks up the change and syncs it
    /// to iCloud Drive automatically.
    pub fn coordinated_write(path: &Path, content: &[u8]) -> Result<()> {
        let content_owned = content.to_vec();
        let result: Arc<Mutex<Result<()>>> =
            Arc::new(Mutex::new(Err(anyhow!("write block never called"))));
        let result_clone = Arc::clone(&result);

        unsafe {
            let url = path_to_nsurl(path);
            let coordinator = make_coordinator();
            let mut error: *mut AnyObject = std::ptr::null_mut();

            let block = StackBlock::new(move |coordinated_url: *mut AnyObject| {
                *result_clone.lock().unwrap() = nsurl_raw_to_path(coordinated_url)
                    .and_then(|p| std::fs::write(&p, &content_owned).map_err(Into::into));
            });

            // coordinateWritingItemAtURL:options:error:byAccessor:
            // options = 0 means NSFileCoordinatorWritingOptions (none)
            let _: () = msg_send![
                &*coordinator,
                coordinateWritingItemAtURL: &*url
                options: 0usize
                error: &mut error
                byAccessor: &block
            ];

            if !error.is_null() {
                return Err(anyhow!(
                    "NSFileCoordinator write error: {}",
                    error_description(error)
                ));
            }
        }

        Arc::try_unwrap(result).unwrap().into_inner().unwrap()
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public read/write API (routes through NSFileCoordinator on macOS)
// ─────────────────────────────────────────────────────────────────────────────

/// Read a file, using `NSFileCoordinator` on macOS for safe iCloud access.
pub fn read_file(path: &Path) -> Result<Vec<u8>> {
    #[cfg(target_os = "macos")]
    {
        coordinator::coordinated_read(path)
    }
    #[cfg(not(target_os = "macos"))]
    {
        std::fs::read(path).map_err(Into::into)
    }
}

/// Write a file, using `NSFileCoordinator` on macOS for safe iCloud access.
pub fn write_file(path: &Path, content: &[u8]) -> Result<()> {
    #[cfg(target_os = "macos")]
    {
        coordinator::coordinated_write(path, content)
    }
    #[cfg(not(target_os = "macos"))]
    {
        std::fs::write(path, content).map_err(Into::into)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Document scanning
// ─────────────────────────────────────────────────────────────────────────────

/// Metadata about a `.cora` file found in the iCloud container.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ICloudDocInfo {
    /// Full filesystem path to the `.cora` file (even if only a placeholder exists).
    pub path: String,
    /// Display name — filename without the `.cora` extension.
    pub name: String,
    /// File size in bytes. Zero for placeholders (file is not local).
    pub size_bytes: u64,
    /// Last-modified timestamp in RFC 3339. `None` for placeholders.
    pub modified_at: Option<String>,
    /// File is present on local disk.
    pub is_local: bool,
    /// Only an iCloud placeholder exists; the file must be downloaded first.
    pub is_placeholder: bool,
}

/// Scans the iCloud container Documents folder for `.cora` files.
///
/// Returns both locally-present files and files represented only by an iCloud
/// placeholder (`.name.cora.icloud`). Returns an empty list when iCloud is not
/// available on this device.
pub fn scan_documents() -> Vec<ICloudDocInfo> {
    let Some(dir) = get_container_documents_path() else {
        return vec![];
    };
    let Ok(entries) = std::fs::read_dir(&dir) else {
        return vec![];
    };

    let mut results = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        let fname = entry.file_name();
        let fname_str = fname.to_string_lossy();

        // Local .cora file
        if fname_str.ends_with(".cora") && !fname_str.starts_with('.') {
            let meta = std::fs::metadata(&path).ok();
            let size = meta.as_ref().map(|m| m.len()).unwrap_or(0);
            let modified_at = meta
                .as_ref()
                .and_then(|m| m.modified().ok())
                .and_then(|t| {
                    t.duration_since(std::time::UNIX_EPOCH).ok().and_then(|dur| {
                        use chrono::TimeZone;
                        chrono::Utc
                            .timestamp_opt(dur.as_secs() as i64, 0)
                            .single()
                            .map(|dt| dt.to_rfc3339())
                    })
                });
            let name = fname_str.trim_end_matches(".cora").to_string();
            results.push(ICloudDocInfo {
                path: path.to_string_lossy().into_owned(),
                name,
                size_bytes: size,
                modified_at,
                is_local: true,
                is_placeholder: false,
            });
        }
        // iCloud placeholder: .<name>.cora.icloud  (starts with dot, ends with .cora.icloud)
        else if fname_str.starts_with('.') && fname_str.ends_with(".cora.icloud") {
            // Strip leading dot and trailing .icloud → "<name>.cora"
            let inner = &fname_str[1..fname_str.len() - ".icloud".len()];
            if inner.ends_with(".cora") {
                let name = inner.trim_end_matches(".cora").to_string();
                let real_path = dir.join(inner);
                results.push(ICloudDocInfo {
                    path: real_path.to_string_lossy().into_owned(),
                    name,
                    size_bytes: 0,
                    modified_at: None,
                    is_local: false,
                    is_placeholder: true,
                });
            }
        }
    }

    results
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete / move
// ─────────────────────────────────────────────────────────────────────────────

/// Delete a `.cora` file from the iCloud container.
///
/// Accepts the real file path (`.cora`). If only a placeholder exists
/// (`.<name>.cora.icloud`), the placeholder is deleted instead so iCloud
/// removes the cloud copy.
pub fn delete_file(path: &Path) -> Result<()> {
    if path.exists() {
        return std::fs::remove_file(path).map_err(Into::into);
    }
    // Try the placeholder sibling.
    if let (Some(parent), Some(name)) = (path.parent(), path.file_name()) {
        let placeholder = parent.join(format!(".{}.icloud", name.to_string_lossy()));
        if placeholder.exists() {
            return std::fs::remove_file(placeholder).map_err(Into::into);
        }
    }
    Err(anyhow!("iCloud file not found: {}", path.display()))
}

/// Move a `.cora` file within the iCloud container (e.g. to `_Archived/`).
///
/// Creates the destination parent directory if it does not exist.
pub fn move_file_to(src: &Path, dst: &Path) -> Result<()> {
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| anyhow!("Failed to create destination directory: {}", e))?;
    }
    std::fs::rename(src, dst)
        .map_err(|e| anyhow!("Failed to move iCloud file: {}", e))
}

// ─────────────────────────────────────────────────────────────────────────────
// NSFileVersion conflict resolution
// ─────────────────────────────────────────────────────────────────────────────

/// Auto-resolve any iCloud version conflicts for the given `.cora` file.
///
/// iCloud creates conflict versions when two devices write to the same file
/// around the same time.  The macOS `NSFileVersion` ObjC API is the right
/// long-term solution but requires nightly bindings that are not yet stable in
/// objc2-foundation 0.2.  For now we call the `brctl` CLI tool which achieves
/// the same result: it instructs the iCloud daemon to accept the most-recently
/// modified version and discard the older one.
///
/// If `brctl` is not available or fails, we log and continue — the app will
/// still work; the user may see the Finder conflict picker occasionally.
pub fn resolve_conflicts(path: &Path) -> Result<()> {
    use std::process::Command;

    let path_str = path
        .to_str()
        .ok_or_else(|| anyhow!("Non-UTF-8 path: {}", path.display()))?;

    // `brctl download` forces iCloud to re-materialise and merge the file,
    // which typically clears pending conflict markers.
    let output = Command::new("brctl")
        .args(["download", path_str])
        .output();

    match output {
        Ok(o) if o.status.success() => {
            eprintln!("[icloud] brctl download OK for {}", path.display());
        }
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr);
            // Not fatal — conflict resolution is best-effort.
            eprintln!("[icloud] brctl download non-zero for {}: {}", path.display(), stderr.trim());
        }
        Err(e) => {
            eprintln!("[icloud] brctl not available or failed: {}", e);
        }
    }

    Ok(())
}

