//! zenborg-daemon — headless sidecar for the desktop observer and scheduler.
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
//! `cfg!(debug_assertions)` to pick between `~/.zenborg` and `~/.zenborg-dev`
//! because it is always a release build. Resolution:
//!   1. `ZENBORG_HOME` env var (if set and non-empty) — used verbatim
//!   2. `KAIROS_HOME` env var (legacy) — used verbatim
//!   3. `$HOME/.zenborg` (always release for a standalone binary)

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

/// Tell macOS this process is a background agent — no Dock icon, no Cmd+Tab entry.
///
/// Must run before anything touches AppKit. `x-win` initializes `NSApplication`
/// internally; without this the default `Regular` policy applies and the daemon
/// appears alongside real apps.
#[cfg(target_os = "macos")]
fn hide_from_dock() {
    use std::ffi::c_char;

    extern "C" {
        fn objc_getClass(name: *const c_char) -> *mut std::ffi::c_void;
        fn sel_registerName(name: *const c_char) -> *mut std::ffi::c_void;
        fn objc_msgSend();
    }

    type MsgSendId = unsafe extern "C" fn(*mut std::ffi::c_void, *mut std::ffi::c_void) -> *mut std::ffi::c_void;
    type MsgSendBoolIsize = unsafe extern "C" fn(*mut std::ffi::c_void, *mut std::ffi::c_void, isize) -> bool;

    unsafe {
        let cls = objc_getClass(b"NSApplication\0".as_ptr() as *const c_char);
        if cls.is_null() {
            return;
        }
        let shared_app: MsgSendId = std::mem::transmute(objc_msgSend as *const ());
        let app = shared_app(cls, sel_registerName(b"sharedApplication\0".as_ptr() as *const c_char));
        if app.is_null() {
            return;
        }
        // NSApplicationActivationPolicyProhibited = 2
        let set_policy: MsgSendBoolIsize = std::mem::transmute(objc_msgSend as *const ());
        set_policy(app, sel_registerName(b"setActivationPolicy:\0".as_ptr() as *const c_char), 2);
    }
}

#[cfg(not(target_os = "macos"))]
fn hide_from_dock() {}

/// Resolve the zenborg vault root. The daemon has no debug/release split —
/// it is always a release binary. Use env vars or fall back to `~/.zenborg`.
fn vault_root() -> Result<PathBuf> {
    for key in &["ZENBORG_HOME", "KAIROS_HOME"] {
        if let Ok(raw) = std::env::var(key) {
            if !raw.trim().is_empty() {
                let path = PathBuf::from(raw);
                fs::create_dir_all(&path)?;
                return Ok(path);
            }
        }
    }
    let home = dirs::home_dir().context("could not resolve $HOME")?;
    let root = home.join(".zenborg");
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
    hide_from_dock();

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
