//! File-system watcher for open `.cora` project files.
//!
//! Uses `notify` (FSEvents on macOS) to watch the **parent directory** of the
//! registered project file, so it works for files anywhere on disk — iCloud
//! Drive, local Documents, network shares, etc.
//!
//! Key design decisions:
//! - Watches the file's parent directory (not just the iCloud container).
//!   This fires for any writer: another Cora instance, iCloud daemon, Finder.
//! - Suppresses own-write events: call `record_write` right after saving so
//!   the next FSEvent for that file is ignored (it's our own flush).
//! - Canonicalizes paths before lookup to handle `/private/` symlink prefix
//!   that macOS FSEvents sometimes returns.
//! - Events for `.icloud` placeholder files are ignored.

use notify::{recommended_watcher, Event, EventKind, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

/// How long to suppress FSEvents after our own save (seconds).
const SUPPRESS_SECS: u64 = 5;

struct Inner {
    /// project_id -> (canonical file path, suppress_until)
    watched: HashMap<i64, (PathBuf, Option<Instant>)>,
    /// canonical file path string -> project_id  (O(1) lookup on event)
    path_to_project: HashMap<String, i64>,
}

/// Clone-cheap, thread-safe file watcher.
#[derive(Clone)]
pub struct ICloudWatcher {
    inner: Arc<Mutex<Inner>>,
    /// Holds the `notify::Watcher` alive (keeps the OS subscription open).
    _notify_watcher: Arc<Mutex<Option<Box<dyn notify::Watcher + Send>>>>,
    /// AppHandle set by `start_watching`; needed to emit Tauri events.
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    /// Whether the background thread + notify watcher are running.
    started: Arc<AtomicBool>,
}

impl ICloudWatcher {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(Inner {
                watched: HashMap::new(),
                path_to_project: HashMap::new(),
            })),
            _notify_watcher: Arc::new(Mutex::new(None)),
            app_handle: Arc::new(Mutex::new(None)),
            started: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Register (or re-register) a project file for change detection.
    /// Watches the file's parent directory so any writer triggers the event.
    pub fn watch(&self, project_id: i64, path: PathBuf) {
        // Canonicalize so FSEvent paths (which macOS may prefix with /private/)
        // match the stored key.
        let canonical = std::fs::canonicalize(&path).unwrap_or_else(|_| path.clone());
        let parent = canonical.parent()
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| canonical.clone());

        {
            let mut st = self.inner.lock().unwrap();
            // Remove old mapping for this project.
            if let Some((old_path, _)) = st.watched.remove(&project_id) {
                st.path_to_project.remove(&old_path.to_string_lossy().into_owned());
            }
            let key = canonical.to_string_lossy().into_owned();
            st.path_to_project.insert(key, project_id);
            st.watched.insert(project_id, (canonical, None));
        }

        // Start the background thread (no-op if already running).
        self.ensure_thread();

        // Register the parent directory with the OS watcher.
        // `notify` is idempotent: re-watching the same dir is a no-op.
        if let Some(w) = self._notify_watcher.lock().unwrap().as_mut() {
            match w.watch(&parent, RecursiveMode::NonRecursive) {
                Ok(_) => eprintln!("[FileWatcher] Watching {:?} for project {}", parent, project_id),
                Err(e) => eprintln!("[FileWatcher] Could not watch {:?}: {}", parent, e),
            }
        }
    }

    /// Unregister a project (stops emitting events for it).
    pub fn unwatch(&self, project_id: i64) {
        let mut st = self.inner.lock().unwrap();
        if let Some((path, _)) = st.watched.remove(&project_id) {
            st.path_to_project.remove(&path.to_string_lossy().into_owned());
        }
    }

    /// Call immediately after writing the project file.
    /// Suppresses the next FSEvent for that project (our own flush is not
    /// a change from another device/app).
    pub fn record_write(&self, project_id: i64) {
        let mut st = self.inner.lock().unwrap();
        if let Some((_, suppress)) = st.watched.get_mut(&project_id) {
            *suppress = Some(Instant::now() + Duration::from_secs(SUPPRESS_SECS));
        }
    }

    /// Called from lib.rs at startup. Stores the AppHandle and eagerly starts
    /// the background thread so it's ready before the first file is opened.
    pub fn start_watching(&self, app_handle: AppHandle) {
        *self.app_handle.lock().unwrap() = Some(app_handle);
        self.ensure_thread();
    }

    /// Idempotent: creates the notify watcher + background thread if not
    /// already running. Safe to call from any thread at any time.
    fn ensure_thread(&self) {
        // Use swap so only one caller proceeds even under concurrent calls.
        if self.started.swap(true, Ordering::SeqCst) {
            return;
        }

        let app_handle = match self.app_handle.lock().unwrap().clone() {
            Some(h) => h,
            None => {
                // AppHandle not available yet; retry when watch() is called.
                self.started.store(false, Ordering::SeqCst);
                return;
            }
        };

        let (tx, rx) = std::sync::mpsc::channel::<notify::Result<Event>>();

        let watcher = match recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("[FileWatcher] Failed to create watcher: {}", e);
                self.started.store(false, Ordering::SeqCst);
                return;
            }
        };

        *self._notify_watcher.lock().unwrap() = Some(Box::new(watcher));
        eprintln!("[FileWatcher] Background thread started.");

        let inner = Arc::clone(&self.inner);
        std::thread::spawn(move || {
            for result in rx {
                let event = match result {
                    Ok(e) => e,
                    Err(e) => {
                        eprintln!("[FileWatcher] Event error: {}", e);
                        continue;
                    }
                };

                // Ignore pure access events (reads); everything else is relevant.
                if matches!(&event.kind, EventKind::Access(_)) {
                    continue;
                }

                let mut to_emit: Vec<(i64, String)> = Vec::new();
                {
                    let mut st = inner.lock().unwrap();
                    let now = Instant::now();
                    for event_path in &event.paths {
                        // Skip .icloud placeholder files.
                        let ext = event_path.extension().and_then(|e| e.to_str());
                        if ext == Some("icloud") {
                            continue;
                        }
                        // Only .cora files.
                        if ext != Some("cora") {
                            continue;
                        }
                        // Canonicalize to match the stored key.
                        let canonical = std::fs::canonicalize(event_path)
                            .unwrap_or_else(|_| event_path.clone());
                        let key = canonical.to_string_lossy().into_owned();

                        if let Some(&pid) = st.path_to_project.get(&key) {
                            if let Some((_, suppress)) = st.watched.get_mut(&pid) {
                                if let Some(until) = *suppress {
                                    if now < until {
                                        eprintln!("[FileWatcher] project {} suppressed (own write)", pid);
                                        continue;
                                    }
                                    *suppress = None; // suppress window expired
                                }
                                to_emit.push((pid, key));
                            }
                        }
                    }
                }

                for (pid, path) in to_emit {
                    eprintln!("[FileWatcher] Remote change for project {}: {}", pid, path);
                    let _ = app_handle.emit(
                        "cora://icloud-file-changed",
                        serde_json::json!({ "projectId": pid, "path": path }),
                    );
                }
            }
        });
    }
}
