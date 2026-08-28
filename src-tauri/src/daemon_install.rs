//! Auto-wire the bundled `kairos-daemon` sidecar as a launchd agent.
//!
//! Follows the `mcp_install.rs` marker pattern: write a plist to
//! `~/Library/LaunchAgents/`, bootstrap it via `launchctl`, and track
//! a marker so re-wiring only happens when the binary path or app
//! version changes (app upgrade, app moved).
//!
//! The plist keeps the daemon alive (`KeepAlive: true`) and starts it
//! at login (`RunAtLoad: true`). The daemon itself handles pause via
//! config polling and single-writer guard via flock.

use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{anyhow, Context, Result};
use serde::Serialize;

const PLIST_LABEL: &str = "tech.equanimi.zenborg.daemon";
const MARKER_FILE: &str = ".daemon-wired-binary";

/// Resolve the bundled `kairos-daemon` next to the running Tauri exe.
fn bundled_daemon_path() -> Result<PathBuf> {
    let exe = std::env::current_exe().context("current_exe")?;
    let dir = exe
        .parent()
        .ok_or_else(|| anyhow!("current exe has no parent dir"))?;
    let candidate = dir.join("kairos-daemon");
    if !candidate.exists() {
        return Err(anyhow!(
            "bundled kairos-daemon not present next to app exe ({})",
            dir.display()
        ));
    }
    Ok(candidate)
}

fn plist_dir() -> Result<PathBuf> {
    let home = dirs::home_dir().ok_or_else(|| anyhow!("cannot resolve $HOME"))?;
    let dir = home.join("Library/LaunchAgents");
    std::fs::create_dir_all(&dir)
        .with_context(|| format!("creating {}", dir.display()))?;
    Ok(dir)
}

fn plist_path() -> Result<PathBuf> {
    Ok(plist_dir()?.join(format!("{PLIST_LABEL}.plist")))
}

fn marker_path() -> Result<PathBuf> {
    let root = crate::vault::fs::vault_root().map_err(|e| anyhow!(e))?;
    Ok(root.join(MARKER_FILE))
}

fn generate_plist(daemon_binary: &Path) -> String {
    format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>{PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>{binary}</string>
  </array>
  <key>KeepAlive</key>
  <true/>
  <key>RunAtLoad</key>
  <true/>
  <key>ProcessType</key>
  <string>Background</string>
  <key>StandardOutPath</key>
  <string>/tmp/kairos-daemon.out.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/kairos-daemon.err.log</string>
</dict>
</plist>
"#,
        binary = daemon_binary.display()
    )
}

fn bootout_if_loaded() {
    let uid = unsafe { libc::getuid() };
    let domain = format!("gui/{uid}/{PLIST_LABEL}");
    let _ = Command::new("launchctl")
        .args(["bootout", &domain])
        .output();
}

fn bootstrap(plist: &Path) -> Result<()> {
    let uid = unsafe { libc::getuid() };
    let domain = format!("gui/{uid}");
    let output = Command::new("launchctl")
        .args(["bootstrap", &domain, &plist.display().to_string()])
        .output()
        .context("launchctl bootstrap")?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("already bootstrapped") || stderr.contains("service already loaded") {
            return Ok(());
        }
        return Err(anyhow!(
            "launchctl bootstrap failed: {}",
            stderr.trim()
        ));
    }
    Ok(())
}

/// Write the plist and bootstrap the daemon. Idempotent.
pub fn install(daemon_binary: &Path) -> Result<()> {
    let plist = plist_path()?;
    let content = generate_plist(daemon_binary);

    bootout_if_loaded();
    std::fs::write(&plist, &content)
        .with_context(|| format!("writing {}", plist.display()))?;
    bootstrap(&plist)?;

    log::info!(
        "[daemon] installed plist at {} and bootstrapped",
        plist.display()
    );
    Ok(())
}

/// Idempotent wrapper: install only if the marker doesn't match.
pub fn install_once_per_version(app_version: &str) -> Result<()> {
    let binary = bundled_daemon_path()?;
    let signature = format!("{}|{}", binary.display(), app_version);

    let marker = marker_path()?;
    if let Ok(prev) = std::fs::read_to_string(&marker) {
        if prev.trim() == signature {
            log::debug!("[daemon] already wired for this build, skipping");
            return Ok(());
        }
    }

    install(&binary)?;

    if let Some(parent) = marker.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&marker, &signature)
        .with_context(|| format!("writing marker {}", marker.display()))?;
    Ok(())
}

/// Uninstall: bootout the agent and remove the plist.
#[allow(dead_code)]
pub fn uninstall() -> Result<()> {
    bootout_if_loaded();
    if let Ok(path) = plist_path() {
        let _ = std::fs::remove_file(&path);
        log::info!("[daemon] removed plist at {}", path.display());
    }
    if let Ok(marker) = marker_path() {
        let _ = std::fs::remove_file(&marker);
    }
    Ok(())
}

// ── Status (for the Settings UI) ──────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct DaemonStatus {
    /// The daemon binary is present in the app bundle.
    pub binary_present: bool,
    /// The plist is installed in ~/Library/LaunchAgents/.
    pub plist_installed: bool,
    /// The daemon process is alive (today's desktop JSONL has recent mtime).
    pub alive: bool,
}

pub fn status() -> DaemonStatus {
    let binary_present = bundled_daemon_path().is_ok();
    let plist_installed = plist_path()
        .map(|p| p.exists())
        .unwrap_or(false);

    let alive = is_daemon_alive();

    DaemonStatus {
        binary_present,
        plist_installed,
        alive,
    }
}

/// Discovery: the log IS the heartbeat. If today's desktop JSONL was
/// modified in the last 5 minutes, the daemon is alive.
fn is_daemon_alive() -> bool {
    let keel_dir = crate::observer::writer::keel_dir();
    let config_json = crate::observer::writer::read_config();
    let config = observer_core::config::parse_observer_config(&config_json);
    let log_dir = keel_dir.join(&config.log_dir_name);

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let desktop_log = log_dir.join(format!("{today}.desktop.jsonl"));

    match std::fs::metadata(&desktop_log) {
        Ok(meta) => {
            if let Ok(modified) = meta.modified() {
                if let Ok(elapsed) = modified.elapsed() {
                    return elapsed.as_secs() < 300;
                }
            }
            false
        }
        Err(_) => false,
    }
}
