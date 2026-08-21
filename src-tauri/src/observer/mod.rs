//! The desktop observer — keel's activity-log writer, running inside zenborg.
//!
//! Migration step 3 of "the garden absorbs keel", with one correction to the
//! spec's wording. The spec calls the step "menubar mode in zenborg"; what
//! actually ships is a **background** mode, because a menubar icon is a UI
//! affordance for something that has no UI. The tray's real job is to be a
//! writer that is always up and never in the way. See
//! `kairos/docs/decisions/2026-08-21-run-the-writer-as-a-background-agent-rather-than-a-menubar-tray.md`.
//!
//! Two sensors — frontmost app via `x-win`, system idle via IOKit
//! `HIDIdleTime` through `user-idle` — plus an opt-in input-count rollup, feed
//! an append-only JSONL log. Pure logic lives in `domain`, file I/O in
//! `writer`, sensor wiring in `sensors`. Everything fails open: a logging
//! error drops the event, a permission error leaves the app running.
//!
//! ## Why this is off by default, and why it writes to a sibling directory
//!
//! The substrate contract allows exactly one writer per collection. `apps/tray`
//! is still installed and still writing `keel/log`, and it is not retired until
//! step 6. Two processes appending to the same day file would double every
//! event, and the read side has no way to tell a duplicate from a real
//! observation.
//!
//! So the safe thing is the default in both directions: the observer is **off**
//! unless the config says otherwise, and when switched on it writes to
//! `keel/log-zenborg` unless the config *also* names the real directory. Taking
//! over `keel/log` is one explicit line in the config, taken when the tray is
//! bootout and not before.

pub mod domain;
pub mod sensors;
pub mod writer;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};

use serde::Serialize;
use serde_json::Value;
use tauri::AppHandle;

/// Where the observer writes while the old tray still owns `keel/log`.
pub const PARITY_LOG_DIR: &str = "log-zenborg";

/// The real collection. Naming it in the config is the act of taking over.
pub const LIVE_LOG_DIR: &str = "log";

/// What the observer was told to do.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ObserverConfig {
    pub enabled: bool,
    /// Directory *name* under keel's subtree, never an absolute path — the
    /// observer has no business writing outside the vault.
    pub log_dir_name: String,
    /// Launch without showing the window.
    ///
    /// This is what makes the login item honest. macOS launches the *app* at
    /// login; if that always raised a window, "allow in the background" would
    /// be a lie told once a day. Off by default, because an app that opens
    /// invisibly when you double-click it is worse than one that opens.
    pub start_hidden: bool,
}

impl Default for ObserverConfig {
    fn default() -> Self {
        ObserverConfig {
            enabled: false,
            log_dir_name: PARITY_LOG_DIR.to_string(),
            start_hidden: false,
        }
    }
}

/// Parse `desktop.backgroundObserver` out of keel's config document.
///
/// Pure, so the defaults are testable without a vault. Anything malformed
/// reads as the default, which is off — a config this writer cannot understand
/// must never be read as consent to write.
pub fn parse_config(config_json: &str) -> ObserverConfig {
    let node = serde_json::from_str::<Value>(config_json)
        .ok()
        .and_then(|c| c.get("desktop")?.get("backgroundObserver").cloned());

    let Some(node) = node else {
        return ObserverConfig::default();
    };

    let enabled = node
        .get("enabled")
        .and_then(Value::as_bool)
        .unwrap_or(false);

    // A directory name only. A value containing a separator is refused rather
    // than sanitized: silently rewriting a path the principal typed would put
    // events somewhere he did not ask for, which is worse than not starting.
    let log_dir_name = node
        .get("logDirName")
        .and_then(Value::as_str)
        .filter(|name| !name.is_empty() && !name.contains('/') && *name != ".." && *name != ".")
        .unwrap_or(PARITY_LOG_DIR)
        .to_string();

    let start_hidden = node
        .get("startHidden")
        .and_then(Value::as_bool)
        .unwrap_or(false)
        // Hiding the window while nothing is being observed would leave an app
        // with no visible surface and no reason to be running.
        && enabled;

    ObserverConfig {
        enabled,
        log_dir_name,
        start_hidden,
    }
}

/// Config, then environment. The env overrides exist for the parity run and
/// for tests; they are not the supported way to turn this on for real.
pub fn resolve_config() -> ObserverConfig {
    let mut config = parse_config(&writer::read_config());

    match std::env::var("ZENBORG_OBSERVER").as_deref() {
        Ok("1") | Ok("true") => config.enabled = true,
        Ok("0") | Ok("false") => config.enabled = false,
        _ => {}
    }
    if let Ok(name) = std::env::var("ZENBORG_OBSERVER_LOG_DIR") {
        if !name.is_empty() && !name.contains('/') {
            config.log_dir_name = name;
        }
    }
    config
}

/// Live observer state. Managed by Tauri so the commands and the sensor thread
/// share one copy.
pub struct ObserverState {
    pub config: ObserverConfig,
    pub log_dir: PathBuf,
    pub running: AtomicBool,
    /// The pause affordance the menubar used to carry. It is still here, and
    /// still emits `writer_paused` / `writer_resumed`, because a deliberate
    /// stop belongs in the log as data. What moved is where you click it.
    pub paused: AtomicBool,
    /// Screen Recording is missing, so window titles would log as "" forever.
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

/// What the UI (or the MCP surface, later) can see about the observer.
#[derive(Debug, Clone, Serialize)]
pub struct ObserverStatus {
    pub enabled: bool,
    pub running: bool,
    pub paused: bool,
    #[serde(rename = "permissionNeeded")]
    pub permission_needed: bool,
    #[serde(rename = "logDir")]
    pub log_dir: String,
    /// True while writing to the parity directory rather than the real
    /// collection — i.e. while `apps/tray` is still the writer of record.
    pub parity: bool,
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
//
// The menubar is gone, so the two things it could do — read the state, stop
// the writing — become commands. A command is reachable from the window, from
// a global shortcut, and later from the MCP server; a menubar item was
// reachable from one place.

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
        // The whole point: switching the observer on must not, by itself,
        // start a second writer on the collection the tray still owns.
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
        // Otherwise the app has no visible surface and nothing to show for it.
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
