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

