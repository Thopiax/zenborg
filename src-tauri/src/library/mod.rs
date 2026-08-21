//! The seam to the library.
//!
//! penceive's engine is a crate in this process now, and this module is the
//! entire published surface between it and the garden. It holds no logic on
//! purpose: it resolves a pond, forwards a query, and renames the result type
//! so that no garden type ever names a library concept.
//!
//! **The seam carries dates and text. Nothing else crosses.** A date is a
//! concept both contexts already have and neither owns; text is opaque to the
//! garden, which renders it and never parses it. That is why the traffic needs
//! no translation, and therefore no context map, no shared kernel and no
//! anticorruption layer. A later method that cannot be described as dates and
//! text is a translation, and it belongs in a design of its own rather than
//! here.
//!
//! The dependency points one way. `penceive-core` does not name Tauri, zenborg,
//! or any garden concept, and nothing in this module tempts it to.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use penceive_core::infrastructure::workspace;
use serde::Serialize;

mod staleness;

pub use staleness::{is_note, watch_ponds, Staleness};

/// One thing the library found: when it was written, what it says, how well it
/// matched. Three fields, and the garden must not grow a fourth without the
/// argument that earns it.
#[derive(Debug, Clone, Serialize)]
pub struct NoteHit {
    /// Local ISO date. The library's id for an entry, and a concept the garden
    /// already has, which is the whole reason this crosses without translating.
    pub date: String,
    /// Opaque prose. Rendered, never parsed.
    pub preview: String,
    pub score: f32,
}

/// The first `YYYY-MM-DD` in a string, or nothing.
///
/// Needed because the library's `SearchHit.date` is **not a date**: it is the
/// hit id, `repo_docs:docs/2026-06-08.md`, with the date embedded in it. The
/// field is misnamed at the source — penceive-core's own date filtering runs
/// the same extraction over the same field, and `wake` renders it as a path.
/// Measured 2026-08-21; the design note assumed `search_source` already
/// returned the seam's shape and it does not.
///
/// Doing the extraction here rather than in the library keeps the dependency
/// pointing one way and keeps the boundary honest: what crosses is a date,
/// not an id into someone else's storage. Hand-rolled rather than pulling
/// `regex` into the app for ten characters.
fn iso_date(id: &str) -> Option<String> {
    let b = id.as_bytes();
    let digit = |i: usize| b[i].is_ascii_digit();
    (0..b.len().saturating_sub(9)).find_map(|i| {
        let shaped = digit(i) && digit(i + 1) && digit(i + 2) && digit(i + 3)
            && b[i + 4] == b'-'
            && digit(i + 5) && digit(i + 6)
            && b[i + 7] == b'-'
            && digit(i + 8) && digit(i + 9);
        shaped.then(|| id[i..i + 10].to_string())
    })
}

/// Search one pond. The seam itself, with pond resolution left out so it can be
/// exercised against a temporary pond rather than the person's own.
///
/// Reads take no writer lock, so the CLI keeps working while this app is open.
/// That is the property slice C's step 1 established, and this is its first
/// second reader.
pub fn search_pond(
    pond: &Path,
    query: &str,
    limit: usize,
    since: Option<&str>,
    until: Option<&str>,
) -> Result<Vec<NoteHit>, String> {
    Ok(penceive_core::search_source(pond, query, limit, since, until)?
        .into_iter()
        .filter_map(|h| {
            // A hit the garden cannot date is a hit the garden cannot use: the
            // date is its only handle on a note, and harvest asks its questions
            // in seasons. Dropping it here is the invariant enforced literally
            // rather than smuggling an id across as if it were a date.
            Some(NoteHit { date: iso_date(&h.date)?, preview: h.preview, score: h.score })
        })
        .collect())
}

/// Search one pond, paying first for whatever the watcher noticed.
///
/// Slice C step 5. The app owns reindex now, and this is where it owns it: not
/// on a clock, and not in the watcher, but in the hands of the reader who
/// actually wants a current answer. See `staleness.rs` for the argument.
///
/// A reindex that fails is logged and dropped. The index is derived and
/// disposable, so the worst it costs is an older answer, and an older answer
/// is a great deal better than a garden that cannot read the notes at all
/// because a pond moved.
pub fn search_fresh(
    pond: &Path,
    staleness: &Staleness,
    query: &str,
    limit: usize,
    since: Option<&str>,
    until: Option<&str>,
) -> Result<Vec<NoteHit>, String> {
    if staleness.take() {
        // Incremental. On a journal pond that is an mtime scan, so the cost is
        // proportional to what changed rather than to what exists.
        if let Err(e) = penceive_core::reindex_source(pond, false) {
            log::warn!("[library] reindex skipped, answering from the index we have: {e}");
        }
    }

    search_pond(pond, query, limit, since, until)
}

/// Everything the app reads: every pond in the library's own registry.
///
/// The registry stays the library's. Slice C did not give the app a second
/// notion of where the notes live, and this is a read of the library's answer
/// rather than an opinion of the app's.
pub fn ponds() -> Vec<PathBuf> {
    match workspace::load_sources() {
        Ok(cfg) => cfg.sources.iter().map(|s| s.path.clone()).collect(),
        Err(e) => {
            log::warn!("[library] no ponds to watch: {e}");
            Vec::new()
        }
    }
}

/// The pond the app reads: the first source in `~/.wake/sources.yaml`.
///
/// The registry stays the library's, and the app does not gain a second notion
/// of where the notes live. Naming a pond is a later question — the app will
/// want one once there is more than one — and `search_pond` is already the
/// shape that answers it, so this resolution can change without the port
/// changing.
fn primary_pond() -> Result<PathBuf, String> {
    workspace::load_sources()?
        .primary()
        .map(|s| s.path.clone())
        .ok_or_else(|| "no ponds registered in ~/.wake/sources.yaml".to_string())
}

/// The garden's one question of the library: what did I write about this?
///
/// Blocking work off the main thread — tantivy reads the index synchronously,
/// and an always-on app must not stall its UI on a corpus scan.
#[tauri::command]
pub async fn library_search(
    staleness: tauri::State<'_, Arc<Staleness>>,
    query: String,
    limit: Option<usize>,
    since: Option<String>,
    until: Option<String>,
) -> Result<Vec<NoteHit>, String> {
    let staleness = Arc::clone(&staleness);

    tauri::async_runtime::spawn_blocking(move || {
        let pond = primary_pond()?;
        search_fresh(
            &pond,
            &staleness,
            &query,
            limit.unwrap_or(20),
            since.as_deref(),
            until.as_deref(),
        )
    })
    .await
    .map_err(|e| format!("join error: {e}"))?
}

/// Start watching the ponds. The watcher lives as long as the app does.
///
/// Failing here costs freshness and nothing else, so it warns rather than
/// stopping the launch: a garden that cannot watch the notes must still open.
pub fn bootstrap(staleness: Arc<Staleness>) -> Option<notify::RecommendedWatcher> {
    let ponds = ponds();
    if ponds.is_empty() {
        log::info!("[library] no ponds registered; nothing to watch");
        return None;
    }

    match watch_ponds(&ponds, staleness) {
        Ok(w) => Some(w),
        Err(e) => {
            log::warn!("[library] pond watcher not started: {e}");
            None
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_date_is_pulled_out_of_the_librarys_hit_id() {
        assert_eq!(iso_date("repo_docs:docs/2026-06-08.md").as_deref(), Some("2026-06-08"));
        assert_eq!(iso_date("2026-06-08").as_deref(), Some("2026-06-08"));
    }

    #[test]
    fn an_undatable_id_yields_nothing() {
        assert_eq!(iso_date("repo_docs:docs/README.md"), None);
        assert_eq!(iso_date(""), None);
        assert_eq!(iso_date("2026-6-8"), None);
    }
}
