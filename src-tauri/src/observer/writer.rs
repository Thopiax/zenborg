//! Desktop observer writer — the only file I/O in this module.
//! Append-only JSONL under keel's subtree of the kairos vault.
//!
//! Fail-open everywhere: any I/O error drops the event and returns `false`;
//! the observer must never crash or block the app.
//!
//! Path resolution **delegates to `crate::vault::fs::vault_root`** rather than
//! restating keel's rule. The two rules are not the same: zenborg's carries the
//! debug/release split (`~/.kairos-dev` vs `~/.kairos`) that keeps a dev build
//! from writing into the real vault, and keel's does not — keel honours the
//! split by pointing `KAIROS_HOME` at the dev vault instead. Copying keel's
//! four lines in here would have made a debug zenborg append desktop events to
//! the production log, which is exactly the failure `default_vault_folder`
//! exists to prevent.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

/// The kairos vault root, resolved by the app's own rule.
///
/// The kernel's own collections live here. `KEEL_HOME` deliberately does NOT
/// move it — that variable relocates keel's subtree, not the kernel's.
pub fn vault_dir() -> PathBuf {
    // `vault_root` fails only when `$HOME` is unresolvable or the directory
    // cannot be created. Fail-open, like every other read in this module.
    crate::vault::fs::vault_root().unwrap_or_else(|_| PathBuf::from(".kairos"))
}

/// keel's own subtree of the vault: `$KAIROS_HOME/keel` (default
/// `~/.kairos/keel`). `KEEL_HOME` overrides the subtree outright, which is how
/// tests get a scratch log instead of the real one.
pub fn keel_dir() -> PathBuf {
    if let Some(keel) = std::env::var_os("KEEL_HOME") {
        return PathBuf::from(keel);
    }
    vault_dir().join("keel")
}

/// `<keel>/config.json` as a raw string. Fail-open: a missing or unreadable
/// file reads as empty, and every parser here treats empty as "unset".
pub fn read_config() -> String {
    fs::read_to_string(keel_dir().join("config.json")).unwrap_or_default()
}

/// Append one already-serialized event line. Creates the directory on demand.
/// The whole line goes down in a single `write_all` on an `O_APPEND` handle —
/// atomic for small lines under concurrent writers. Fail-open: `false` on any
/// error, never panics.
pub fn append_line(dir: &Path, file_name: &str, line: &str) -> bool {
    if fs::create_dir_all(dir).is_err() {
        return false;
    }
    match OpenOptions::new()
        .append(true)
        .create(true)
        .open(dir.join(file_name))
    {
        Ok(mut file) => file.write_all(line.as_bytes()).is_ok(),
        Err(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn scratch(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "zenborg-observer-test-{}-{}",
            std::process::id(),
            name
        ));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn appending_creates_the_directory_and_keeps_every_line() {
        let dir = scratch("append");
        assert!(append_line(&dir, "a.jsonl", "{\"a\":1}\n"));
        assert!(append_line(&dir, "a.jsonl", "{\"a\":2}\n"));
        let body = fs::read_to_string(dir.join("a.jsonl")).unwrap();
        assert_eq!(body.lines().count(), 2);
        let _ = fs::remove_dir_all(&dir);
    }
}
