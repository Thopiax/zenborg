//! The desktop observer — keel's activity-log writer, running inside zenborg.
//!
//! Pure logic lives in `observer-core`; this module owns the Tauri wiring:
//! managed state, commands, and the bootstrap that starts the sensor loop.

pub mod domain;
pub mod sensors;
pub mod writer;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

use tauri::AppHandle;

pub use observer_core::config::{ObserverConfig, ObserverStatus, LIVE_LOG_DIR};

pub fn resolve_config() -> ObserverConfig {
    observer_core::config::resolve_observer_config(&writer::read_config())
}

/// Live observer state. Managed by Tauri so the commands and the sensor thread
/// share one copy.
pub struct ObserverState {
    pub config: ObserverConfig,
    pub log_dir: PathBuf,
    pub running: AtomicBool,
    pub paused: AtomicBool,
    pub permission_needed: AtomicBool,
}

impl ObserverState {
    pub fn new(config: ObserverConfig) -> Self {
        let log_dir = writer::keel_dir().join(&config.log_dir_name);
        ObserverState {
            config,
            log_dir,
            running: AtomicBool::new(false),
            paused: AtomicBool::new(false),
            permission_needed: AtomicBool::new(false),
        }
    }
}

impl ObserverState {
    pub fn status(&self) -> ObserverStatus {
        ObserverStatus {
            enabled: self.config.enabled,
            running: self.running.load(Ordering::SeqCst),
            paused: self.paused.load(Ordering::SeqCst),
            permission_needed: self.permission_needed.load(Ordering::SeqCst),
            log_dir: self.log_dir.display().to_string(),
            parity: self.config.log_dir_name != LIVE_LOG_DIR,
        }
    }
}

/// Start the observer if the config says to. Returns whether it started.
pub fn bootstrap(app: &AppHandle) -> bool {
    sensors::start(app.clone())
}

// ── Tauri commands ──────────────────────────────────────────────

#[tauri::command]
pub fn observer_status(state: tauri::State<'_, ObserverState>) -> ObserverStatus {
    state.status()
}

#[tauri::command]
pub fn observer_set_paused(
    app: AppHandle,
    state: tauri::State<'_, ObserverState>,
    paused: bool,
) -> ObserverStatus {
    sensors::set_paused(&app, &state, paused);
    state.status()
}

#[cfg(test)]
mod tests {
    use super::*;
    use observer_core::config::PARITY_LOG_DIR;

    #[test]
    fn status_reports_parity_until_the_live_directory_is_named() {
        let parity = ObserverState::new(ObserverConfig {
            enabled: true,
            log_dir_name: PARITY_LOG_DIR.into(),
            start_hidden: false,
        });
        assert!(parity.status().parity);

        let live = ObserverState::new(ObserverConfig {
            enabled: true,
            log_dir_name: LIVE_LOG_DIR.into(),
            start_hidden: false,
        });
        assert!(!live.status().parity);
    }
}
