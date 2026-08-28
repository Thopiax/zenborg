//! Desktop observer writer — delegates to observer-core, with vault_root()
//! resolved from the app's own vault module (which carries the debug/release split).

use std::path::PathBuf;

pub use observer_core::writer::append_line;

fn vault_dir() -> PathBuf {
    crate::vault::fs::vault_root().unwrap_or_else(|_| PathBuf::from(".kairos"))
}

pub fn keel_dir() -> PathBuf {
    observer_core::writer::keel_dir(&vault_dir())
}

pub fn read_config() -> String {
    observer_core::writer::read_config(&keel_dir())
}
