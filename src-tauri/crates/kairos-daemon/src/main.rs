//! kairos-daemon — headless sidecar for the desktop observer and scheduler.
//!
//! Quitting zenborg doesn't kill it. launchd keeps it alive.
//!
//! ## Single-writer guard
//!
//! Advisory flock on `<log_dir>/.writer.lock`. A second instance exits loudly
//! rather than doubling every event.
//!
//! ## Vault resolution
//!
//! The daemon is a standalone binary, not a Tauri app. It cannot use
//! `cfg!(debug_assertions)` to pick between `~/.kairos` and `~/.kairos-dev`
//! because it is always a release build. Resolution:
//!   1. `KAIROS_HOME` env var (if set and non-empty) — used verbatim
//!   2. `ZENBORG_VAULT_DIR` env var (legacy) — used verbatim
//!   3. `$HOME/.kairos` (always release for a standalone binary)

mod scheduler;
mod sensors;
mod state;

use std::fs::{self, File, OpenOptions};
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;

use anyhow::{bail, Context, Result};

use observer_core::config;
use observer_core::writer;

/// Resolve the kairos vault root. The daemon has no debug/release split —
/// it is always a release binary. Use env vars or fall back to `~/.kairos`.
fn vault_root() -> Result<PathBuf> {
    for key in &["KAIROS_HOME", "ZENBORG_VAULT_DIR"] {
        if let Ok(raw) = std::env::var(key) {
            if !raw.trim().is_empty() {
                let path = PathBuf::from(raw);
                fs::create_dir_all(&path)?;
                return Ok(path);
            }
        }
    }
    let home = dirs::home_dir().context("could not resolve $HOME")?;
    let root = home.join(".kairos");
    fs::create_dir_all(&root)?;
    Ok(root)
}

/// Advisory flock on `<log_dir>/.writer.lock`. Returns the held file handle —
/// dropping it releases the lock.
fn acquire_writer_lock(log_dir: &std::path::Path) -> Result<File> {
    fs::create_dir_all(log_dir)?;
    let lock_path = log_dir.join(".writer.lock");
    let file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(false)
        .open(&lock_path)
        .context("could not open writer lock")?;

    use std::os::unix::io::AsRawFd;
    let rc = unsafe { libc::flock(file.as_raw_fd(), libc::LOCK_EX | libc::LOCK_NB) };
    if rc != 0 {
        bail!(
            "another writer holds the lock at {}. Only one observer may write to the same log directory.",
            lock_path.display()
        );
    }
    Ok(file)
}

fn main() -> Result<()> {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_millis()
        .init();

    let vault = vault_root()?;
    let keel_dir = writer::keel_dir(&vault);
    let config_json = writer::read_config(&keel_dir);
    let observer_config = config::resolve_observer_config(&config_json);

    if !observer_config.enabled {
        log::info!("[daemon] observer disabled in config — exiting. Set desktop.backgroundObserver.enabled: true to start.");
        return Ok(());
    }

    let log_dir = keel_dir.join(&observer_config.log_dir_name);

    let _lock = acquire_writer_lock(&log_dir)
        .context("single-writer guard failed")?;
    log::info!("[daemon] writer lock acquired on {}", log_dir.display());

    let state = Arc::new(state::ObserverState::new(observer_config, keel_dir.clone()));

    sensors::start(Arc::clone(&state));
    scheduler::bootstrap(&keel_dir);

    log::info!("[daemon] running. Send SIGTERM to stop.");

    // Park the main thread. The sensor loop and scheduler jobs run on their
    // own threads. SIGTERM from launchd will terminate the process; the flock
    // releases automatically.
    loop {
        thread::park();
    }
}
