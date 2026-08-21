//! The app is the writer of `journals`.
//!
//! Slice C, step 5's data half. `journals` had two writers and one of them was
//! a CLI: `wake sync` pulled the device's handwriting into a pond while the
//! sign-off ritual wrote dated files by hand. The substrate's rule 3 is one
//! writer per collection, written about instruments, and it had no shape for
//! that pair. The call is that **the app absorbs the pull**, which leaves
//! exactly one instrument writing the prose and lets rule 3 stand unchanged.
//! The person stays the author; nothing here competes with them.
//!
//! Two things follow, and they are the whole module.
//!
//! **Where the collection lives.** `$KAIROS_HOME/journals`, like every other
//! collection, from the moment the prose is actually there. This is not a
//! second registry: it is the substrate answering a question the library's own
//! `sources.yaml` answered while `journals` was outside the vault. Until the
//! move happens the registry still answers, because a resolution that claims a
//! move nobody performed is worse than one that admits it. Moving a corpus of
//! irreplaceable prose is a deliberate act a person performs with their eyes on
//! it, so the code waits for it rather than doing it.
//!
//! **What a pull owes the index.** Staleness, and nothing else. The pull writes
//! markdown and never takes the index writer lock, so an app pulling cannot
//! block a `wake reindex` in a terminal and a terminal cannot block the app.
//! The next reader pays, which is step 5's standing answer to who owns reindex.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use super::Staleness;

/// The name of the collection inside `$KAIROS_HOME`.
const COLLECTION: &str = "journals";

/// Has the prose actually moved into this directory?
///
/// A directory alone is not the move. `mkdir` halfway through a `mv` leaves an
/// empty pond, and answering a season's question from an empty pond looks
/// exactly like a person who wrote nothing — a conflation the harvest surface
/// already refuses to make. So the test is whether there is a note in it.
fn holds_prose(dir: &Path) -> bool {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return false;
    };
    entries.filter_map(Result::ok).any(|e| {
        e.path()
            .extension()
            .map(|ext| ext.eq_ignore_ascii_case("md"))
            .unwrap_or(false)
    })
}

/// Resolve the journals pond under `vault_root`, falling back to whatever
/// answered before the collection moved.
///
/// Split from [`pond`] so the resolution can be exercised against a temporary
/// vault rather than the person's own, and so the fallback is visible as a
/// choice rather than buried in a chain of `or_else`.
pub fn pond_in<F>(vault_root: &Path, not_moved_yet: F) -> Result<PathBuf, String>
where
    F: FnOnce() -> Result<PathBuf, String>,
{
    let home = vault_root.join(COLLECTION);
    if holds_prose(&home) {
        return Ok(home);
    }
    not_moved_yet()
}

/// Pull the device's notes, then tell the index it has fallen behind.
///
/// The app's half of the absorb, with the pull injected: what makes this
/// correct is the *order and the conditions*, not which binary does the
/// pulling, and that is what a test can hold.
///
/// A pull that failed marks nothing. Nothing landed, so nothing is owed, and
/// charging the next reader a reindex for a pull that did not happen is a cost
/// with no answer behind it.
pub fn pull_with<F>(staleness: &Staleness, pull: F) -> Result<String, String>
where
    F: FnOnce() -> Result<String, String>,
{
    let msg = pull()?;
    staleness.mark();
    Ok(format!("{msg}; index marked stale"))
}

/// Pull into the journals pond for real.
///
/// `mode` is `lan` (the device's export server) or `server` (a local export
/// directory). `ip`/`port` pin the device when LAN discovery is flaky.
pub fn pull(
    staleness: &Staleness,
    mode: &str,
    ip: Option<&str>,
    port: Option<u16>,
) -> Result<String, String> {
    let pond = super::pond()?;
    pull_with(staleness, || {
        penceive_core::pull_notes(&pond, mode, ip, port)
    })
}

/// The garden's one write to the library: bring in what was written by hand on
/// a device.
///
/// Blocking work off the main thread — a LAN pull of a term's handwriting is
/// not something an always-on app may stall its UI on.
#[tauri::command]
pub async fn library_sync(
    staleness: tauri::State<'_, Arc<Staleness>>,
    mode: Option<String>,
    ip: Option<String>,
    port: Option<u16>,
) -> Result<String, String> {
    let staleness = Arc::clone(&staleness);

    tauri::async_runtime::spawn_blocking(move || {
        pull(
            &staleness,
            mode.as_deref().unwrap_or("lan"),
            ip.as_deref(),
            port,
        )
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}
