//! FSEvents-based watcher for iCloud Drive `metadata.json` project sync files.
//!
//! Design:
//! - Uses `notify` (FSEvents on macOS) to detect changes to `metadata.json` in each project folder.
//! - Each project's folder is watched individually (NonRecursive) when a project is opened.
//! - Own-write suppression: after writing `metadata.json` ourselves, ignore FSEvents for 10 seconds.
//! - Emits `cora://icloud-file-changed` Tauri event when a remote change is detected.

use notify::{recommended_watcher, Event, EventKind, RecursiveMode, Watcher};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

const SUPPRESS_SECS: u64 = 10;

struct Inner {
    /// project_id -> (metadata.json path, suppress_until)
    watched: HashMap<i64, (PathBuf, Option<Instant>)>,
    /// canonical metadata.json path string -> project_id (O(1) lookup on event)
    path_to_project: HashMap<String, i64>,
}

/// Clone-cheap, thread-safe file watcher.
#[derive(Clone)]
pub struct ICloudWatcher {
    inner: Arc<Mutex<Inner>>,
    notify_watcher: Arc<Mutex<Option<Box<dyn notify::Watcher + Send>>>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
    started: Arc<AtomicBool>,
}

impl ICloudWatcher {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(Inner {
                watched: HashMap::new(),
                path_to_project: HashMap::new(),
            })),
            notify_watcher: Arc::new(Mutex::new(None)),
            app_handle: Arc::new(Mutex::new(None)),
            started: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Register a project's `metadata.json` for change detection.
    /// `path` should point directly to the `metadata.json` file.
    pub fn watch(&self, project_id: i64, path: PathBuf) {
        let dir = path.parent().map(|p| p.to_path_buf()).unwrap_or_else(|| path.clone());
        let key = path.to_string_lossy().into_owned();

        {
            let mut st = self.inner.lock().unwrap();
            // Clone the old path before mutating to avoid borrow conflict.
            let old_key = st.watched.get(&project_id)
                .map(|(p, _)| p.to_string_lossy().into_owned());
            if let Some(k) = old_key {
                st.path_to_project.remove(&k);
            }
            st.path_to_project.insert(key, project_id);
            st.watched.insert(project_id, (path, None));
        }

        self.ensure_engine_started();

        // Add the project folder to the notify watcher.
        if let Ok(mut guard) = self.notify_watcher.lock() {
            if let Some(w) = guard.as_mut() {
                if let Err(e) = w.watch(&dir, RecursiveMode::NonRecursive) {
                    eprintln!("[iCloudWatcher] Could not watch {:?}: {}", dir, e);
                }
            }
        }
    }

    /// Unregister a project. Removes the directory watch if no other project uses it.
    pub fn unwatch(&self, project_id: i64) {
        let removed = {
            let mut st = self.inner.lock().unwrap();
            if let Some((path, _)) = st.watched.remove(&project_id) {
                st.path_to_project.remove(&path.to_string_lossy().into_owned());
                Some(path)
            } else {
                None
            }
        };

        if let Some(path) = removed {
            let dir = path.parent().map(|p| p.to_path_buf()).unwrap_or(path);
            let still_used = {
                let st = self.inner.lock().unwrap();
                st.watched.values().any(|(p, _)| {
                    p.parent().map(|pd| pd == dir.as_path()).unwrap_or(false)
                })
            };
            if !still_used {
                if let Ok(mut guard) = self.notify_watcher.lock() {
                    if let Some(w) = guard.as_mut() {
                        let _ = w.unwatch(&dir);
                    }
                }
            }
        }
    }

    /// Call immediately after writing `metadata.json` for a project.
    /// Suppresses the next FSEvent (which is our own write, not a remote change).
    pub fn record_write(&self, project_id: i64) {
        let mut st = self.inner.lock().unwrap();
        if let Some((_, suppress)) = st.watched.get_mut(&project_id) {
            *suppress = Some(Instant::now() + Duration::from_secs(SUPPRESS_SECS));
        }
    }

    /// Store the AppHandle and start the FSEvents engine.
    pub fn start_watching(&self, app_handle: AppHandle) {
        *self.app_handle.lock().unwrap() = Some(app_handle);
        self.ensure_engine_started();
    }

    fn ensure_engine_started(&self) {
        if self.started.load(Ordering::Relaxed) {
            return;
        }
        let app_handle = match self.app_handle.lock().unwrap().clone() {
            Some(h) => h,
            None => return,
        };

        let (tx, rx) = std::sync::mpsc::channel::<notify::Result<Event>>();
        let watcher = match recommended_watcher(tx) {
            Ok(w) => w,
            Err(e) => {
                eprintln!("[iCloudWatcher] Failed to create FSEvents watcher: {}", e);
                return;
            }
        };

        *self.notify_watcher.lock().unwrap() = Some(Box::new(watcher));
        self.started.store(true, Ordering::Relaxed);
        eprintln!("[iCloudWatcher] FSEvents engine started");

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
                        // Only react to metadata.json files.
                        if path.file_name().and_then(|n| n.to_str()) != Some("metadata.json") {
                            continue;
                        }
                        let key = path.to_string_lossy().into_owned();
                        if let Some(&pid) = st.path_to_project.get(&key) {
                            if let Some((_, suppress)) = st.watched.get_mut(&pid) {
                                if let Some(until) = suppress {
                                    if now < *until {
                                        eprintln!("[iCloudWatcher] project {} suppressed (own write)", pid);
                                        continue;
                                    }
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
