//! File watcher — emits events to the frontend when collection files
//! are modified externally (outside the self-write suppression window).
//!
//! Inspired by penceive/src-tauri/src/infrastructure/watcher.rs.

use std::path::PathBuf;
use std::sync::Arc;
use std::sync::mpsc;

use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use super::fs::collection_from_path;
use super::write_tracker::SelfWriteTracker;

#[derive(Serialize, Clone)]
pub struct VaultChangeEvent {
    pub collection: String,
    pub change_type: String,
}

/// Start the vault file watcher on a background thread.
///
/// Emits "vault:collection-changed" events to the frontend when collection
/// files are modified by something other than zenborg itself.
pub fn start_watcher(
    app: AppHandle,
    vault_path: PathBuf,
    write_tracker: Arc<SelfWriteTracker>,
) -> Result<(), String> {
    let (tx, rx) = mpsc::channel();

    let mut watcher = RecommendedWatcher::new(tx, Config::default())
        .map_err(|e| format!("Failed to create vault watcher: {}", e))?;

    watcher
        .watch(&vault_path, RecursiveMode::NonRecursive)
        .map_err(|e| format!("Failed to watch vault: {}", e))?;

    std::thread::spawn(move || {
        let _watcher = watcher; // prevent drop
        for result in rx {
            let event = match result {
                Ok(e) => e,
                Err(_) => continue,
            };

            let change_type = match event.kind {
                EventKind::Create(_) => "added",
                EventKind::Modify(_) => "modified",
                EventKind::Remove(_) => "deleted",
                _ => continue,
            };

            for path in &event.paths {
                let collection = match collection_from_path(path) {
                    Some(c) => c,
                    None => continue,
                };

                // Suppress echoes from our own writes.
                if write_tracker.is_self_write(path.to_string_lossy().as_ref()) {
                    continue;
                }

                let _ = app.emit(
                    "vault:collection-changed",
                    VaultChangeEvent {
                        collection,
                        change_type: change_type.to_string(),
                    },
                );
            }
        }
    });

    Ok(())
}
