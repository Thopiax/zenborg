//! The desktop observer — keel's activity-log writer, running inside zenborg.
//!
//! Pure logic lives in `observer-core`; this module owns the Tauri wiring:
//! managed state, commands, and the bootstrap that starts the sensor loop.

pub mod domain;
pub mod sensors;
pub mod writer;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;
use tauri::AppHandle;

pub use observer_core::config::{
    ObserverConfig, ObserverStatus, LIVE_LOG_DIR, PARITY_LOG_DIR,
};

pub fn parse_config(config_json: &str) -> ObserverConfig {
    observer_core::config::parse_observer_config(config_json)
}

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

    #[test]
    fn an_absent_or_broken_config_leaves_the_observer_off() {
        for input in ["", "{ not json", "{}", r#"{"desktop":{}}"#] {
            let config = parse_config(input);
            assert!(
                !config.enabled,
                "input {input:?} must not enable the writer"
            );
            assert_eq!(config.log_dir_name, PARITY_LOG_DIR);
        }
    }

    #[test]
    fn enabling_alone_writes_to_the_parity_directory() {
        let config = parse_config(r#"{"desktop":{"backgroundObserver":{"enabled":true}}}"#);
        assert!(config.enabled);
        assert_eq!(config.log_dir_name, PARITY_LOG_DIR);
    }

    #[test]
    fn taking_over_the_real_collection_has_to_be_said_out_loud() {
        let config = parse_config(
            r#"{"desktop":{"backgroundObserver":{"enabled":true,"logDirName":"log"}}}"#,
        );
        assert!(config.enabled);
        assert_eq!(config.log_dir_name, LIVE_LOG_DIR);
    }

    #[test]
    fn a_path_shaped_dir_name_is_refused_rather_than_sanitized() {
        for name in ["../../etc", "log/nested", "", "."] {
            let json = format!(
                r#"{{"desktop":{{"backgroundObserver":{{"enabled":true,"logDirName":"{name}"}}}}}}"#
            );
            assert_eq!(parse_config(&json).log_dir_name, PARITY_LOG_DIR);
        }
    }

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

    #[test]
    fn the_window_never_hides_while_the_observer_is_off() {
        let config = parse_config(
            r#"{"desktop":{"backgroundObserver":{"enabled":false,"startHidden":true}}}"#,
        );
        assert!(!config.start_hidden);

        let config = parse_config(
            r#"{"desktop":{"backgroundObserver":{"enabled":true,"startHidden":true}}}"#,
        );
        assert!(config.start_hidden);
    }
}
