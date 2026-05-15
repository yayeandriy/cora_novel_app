//! Native macOS FSEvents-based watcher for iCloud Drive `.cora` project files.
//!
//! Key design decisions:
//! - FSEvents (via `notify`) is set up LAZILY: on app startup iCloud may not be
//!   ready, so we retry each time `watch()` is called until it succeeds.
//! - NO suppress window on `watch()` registration.  Suppress only after our own
//!   coordinated write (`record_write`), for `SUPPRESS_SECS` seconds.
//! - Events for `.icloud` evicted-placeholder paths are ignored; only `.cora`
//!   paths are forwarded to the frontend.

use notify::{recommended_watcher, Event, EventKind, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

/// How long to ignore FSEvents for a project after our own write (seconds).
const SUPPRESS_SECS: u64 = 10;

struct Inner {
    /// project_id -> (watched path, suppress_until)
    watched: HashMap<i64, (PathBuf, Option<Instant>)>,
    /// canonical path string -> project_id  (O(1) lookup on event)
    path_to_project: HashMap<String, i64>,
}

/// Clone-cheap, thread-safe iCloud file watcher.
#[derive(Clone)]
pub struct ICloudWatcher {
    inner: Arc<Mutex<Inner>>,
    /// Holds the `notify::Watcher` alive while the watcher thread lives.
    _notify_watcher: Arc<Mutex<Option<Box<dyn notify::Watcher + Send>>>>,
    /// AppHandle stored by `start_watching`, used for lazy FSEvents setup.
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    /// Whether the FSEvents watcher thread is running.
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
    ///
    /// Does NOT set a suppress window -- that only happens after `record_write`.
    /// Retries FSEvents setup if iCloud was not available at startup.
    pub fn watch(&self, project_id: i64, path: PathBuf) {
        {
            let mut st = self.inner.lock().unwrap();
            // Clean up old path mapping.
            if let Some((old_path, _)) = st.watched.get(&project_id) {
                let old_key = old_path.to_string_lossy().into_owned();
                st.path_to_project.remove(&old_key);
            }
            let key = path.to_string_lossy().into_owned();
            st.path_to_project.insert(key, project_id);
            // Insert WITHOUT a suppress window (None = no suppression).
            st.watched.insert(project_id, (path, None));
        }
        // Ensure FSEvents is running -- retries if iCloud was not ready at startup.
        self.try_ensure_fsevents();
    }

    /// Unregister a project.
    pub fn unwatch(&self, project_id: i64) {
        let mut st = self.inner.lock().unwrap();
        if let Some((path, _)) = st.watched.remove(&project_id) {
            st.path_to_project.remove(&path.to_string_lossy().into_owned());
        }
    }

    /// Call immediately after writing the iCloud file.
    /// Suppresses the next FSEvents notification (which is our own write, not
    /// a change from another device).
    pub fn record_write(&self, project_id: i64) {
        let mut st = self.inner.lock().unwrap();
        if let Some((_, suppress)) = st.watched.get_mut(&project_id) {
            *suppress = Some(Instant::now() + Duration::from_secs(SUPPRESS_SECS));
        }
    }

    /// Called from `lib.rs setup`. Stores the AppHandle and attempts to start
    /// FSEvents immediately. Safe to call even if iCloud is not ready yet --
    /// `watch()` will retry.
    pub fn start_watching(&self, app_handle: AppHandle) {
        *self.app_handle.lock().unwrap() = Some(app_handle);
        self.try_ensure_fsevents();
    }

    /// Idempotent: sets up the FSEvents watcher if not already running.
    /// Returns immediately if already started or if iCloud is not available yet.
    fn try_ensure_fsevents(&self) {
        if self.started.load(Ordering::Relaxed) {
            return;
        }

        let app_handle = match self.app_handle.lock().unwrap().clone() {
            Some(h) => h,
            None => return, // start_watching not called yet
        };

        let docs_path = match crate::services::icloud::get_container_documents_path() {
            Some(p) => p,
            None => {
                eprintln!("[iCloudWatcher] iCloud container not available yet -- will retry on next watch()");
                return;
            }
        };

        let (tx, rx) = std::sync::mpsc::channel::<notify::Result<Event>>();

        let mut watcher = match recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("[iCloudWatcher] Failed to create FSEvents watcher: {}", e);
                return;
            }
        };

        if let Err(e) = watcher.watch(&docs_path, RecursiveMode::NonRecursive) {
            eprintln!("[iCloudWatcher] Could not watch {:?}: {}", docs_path, e);
            return;
        }

        *self._notify_watcher.lock().unwrap() = Some(Box::new(watcher));
        self.started.store(true, Ordering::Relaxed);
        eprintln!("[iCloudWatcher] FSEvents watcher started on {:?}", docs_path);

        let inner = Arc::clone(&self.inner);
        std::thread::spawn(move || {
            for result in rx {
                let event = match result {
                    Ok(e) => e,
                    Err(e) => {
                        eprintln!("[iCloudWatcher] Event error: {}", e);
                        continue;
                    }
                };

                let relevant = matches!(
                    &event.kind,
                    EventKind::Modify(_) | EventKind::Create(_) | EventKind::Remove(_)
                );
                if !relevant {
                    continue;
                }

                let mut to_emit: Vec<(i64, String)> = Vec::new();
                {
                    let mut st = inner.lock().unwrap();
                    let now = Instant::now();
                    for path in &event.paths {
                        // Only real `.cora` files -- ignore `.icloud` placeholders.
                        if path.extension().and_then(|e| e.to_str()) != Some("cora") {
                            continue;
                        }
                        let key = path.to_string_lossy().into_owned();
                        if let Some(&pid) = st.path_to_project.get(&key) {
                            if let Some((_, suppress)) = st.watched.get_mut(&pid) {
                                if let Some(until) = suppress {
                                    if now < *until {
                                        // Own-write suppress still active.
                                        eprintln!("[iCloudWatcher] project {} event suppressed (own write)", pid);
                                        continue;
                                    }
                                    // Suppress expired -- clear it.
                                    *suppress = None;
                                }
                                to_emit.push((pid, key));
                            }
                        }
                    }
                }

                for (pid, path) in to_emit {
                    eprintln!("[iCloudWatcher] Remote change for project {}: {}", pid, path);
                    let _ = app_handle.emit(
                        "cora://icloud-file-changed",
                        serde_json::json!({ "projectId": pid, "path": path }),
                    );
                }
            }
        });
    }
}
