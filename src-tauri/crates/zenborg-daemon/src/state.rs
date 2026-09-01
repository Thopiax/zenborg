//! Shared daemon state — the Tauri-free equivalent of ObserverState.

use std::path::PathBuf;
use std::sync::atomic::AtomicBool;

use observer_core::config::ObserverConfig;

pub struct ObserverState {
    pub config: ObserverConfig,
    pub keel_dir: PathBuf,
    pub log_dir: PathBuf,
    pub running: AtomicBool,
    pub paused: AtomicBool,
    pub permission_needed: AtomicBool,
}

impl ObserverState {
    pub fn new(config: ObserverConfig, keel_dir: PathBuf) -> Self {
        let log_dir = keel_dir.join(&config.log_dir_name);
        ObserverState {
            config,
            keel_dir,
            log_dir,
            running: AtomicBool::new(false),
            paused: AtomicBool::new(false),
            permission_needed: AtomicBool::new(false),
        }
    }
}
