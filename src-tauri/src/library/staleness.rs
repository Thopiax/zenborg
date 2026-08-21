//! Who decides when the index catches up.
//!
//! Slice C step 5 gives the app the reindex the CLI used to own, and the
//! design left one question open with it: *does the app schedule reindex, or
//! does the watcher?* The answer this module implements is **neither, alone**.
//!
//! **The watcher detects. The reader pays.** A `notify` watcher over the ponds
//! marks the index stale and does no work at all. The next question the garden
//! asks is what triggers the reindex, and it is the one that gets the fresh
//! answer.
//!
//! Both alternatives reindex an idle machine at 3am. A watcher that detects
//! *and* triggers does it because a sync landed while nobody was awake; a
//! wall-clock schedule does it even when nothing landed. Demand triggers
//! nothing while nobody is asking, and it puts the cost on the one person who
//! gets the benefit of paying it.
//!
//! This is only correct because **the index is derived and disposable**
//! (`substrate.md`, and invariant 5 of the design). Staleness costs nothing
//! until someone reads, and nothing is lost by deferring, so deferral is free
//! rather than lazy. It would be the wrong answer for a collection: a record
//! nobody has written yet is missing, not merely stale.

use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use notify::{Config, EventKind, RecommendedWatcher, RecursiveMode, Watcher};

/// Whether the ponds have moved on since the index last caught up.
///
/// One bit, because one bit is all the reader needs: *is something owed?* What
/// changed, and how much, is the incremental reindex's problem, and it already
/// works that out from file mtimes.
#[derive(Debug, Default)]
pub struct Staleness {
    dirty: AtomicBool,
}

impl Staleness {
    /// An index believed to be current. The honest starting state on launch:
    /// if it is wrong, the first write to a pond corrects it.
    pub fn fresh() -> Self {
        Self { dirty: AtomicBool::new(false) }
    }

    /// The watcher's whole job. Cheap enough to call on every filesystem
    /// event, which is the property that lets the detector stay dumb.
    pub fn mark(&self) {
        self.dirty.store(true, Ordering::Release);
    }

    /// Claim the debt, clearing it. True means *you* are the reader who pays.
    ///
    /// Clearing before the reindex rather than after is deliberate: a write
    /// that lands mid-reindex re-marks, so the next reader picks it up. The
    /// other order would swallow it.
    pub fn take(&self) -> bool {
        self.dirty.swap(false, Ordering::AcqRel)
    }

    /// Is anything owed? Does not claim it. For tests and diagnostics.
    pub fn peek(&self) -> bool {
        self.dirty.load(Ordering::Acquire)
    }
}

/// Is this path prose, rather than something a tool left beside it?
///
/// An editor's swap file, a git object and a `.DS_Store` all land under a pond
/// and none of them is a note. Reindexing because of one is work nobody asked
/// for, and on a git-backed pond `.git/` churns on every command.
pub fn is_note(path: &Path) -> bool {
    if path.components().any(|c| c.as_os_str() == ".git") {
        return false;
    }

    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
        return false;
    };

    // A dotfile is never a note: `.2026-06-08.md.swp` ends in `.swp`, but
    // `.#2026-06-08.md` (emacs) ends in `.md` and is still not prose.
    !name.starts_with('.') && name.ends_with(".md")
}

/// Watch every pond for notes changing, and mark the index stale when one does.
///
/// Returns the watcher, which must be kept alive: dropping it stops the
/// watching. It does no reindexing and holds no reference to the index, so the
/// detector stays separate from the trigger, which is the whole point.
///
/// A pond that cannot be watched is logged and skipped rather than failing the
/// rest. A person with one unreadable pond should still get fresh answers about
/// the others, and the worst case of not watching is staleness, which is free.
pub fn watch_ponds(
    ponds: &[PathBuf],
    staleness: Arc<Staleness>,
) -> Result<RecommendedWatcher, String> {
    let mut watcher = RecommendedWatcher::new(
        move |res: notify::Result<notify::Event>| {
            let Ok(event) = res else { return };

            if !matches!(
                event.kind,
                EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
            ) {
                return;
            }

            if event.paths.iter().any(|p| is_note(p)) {
                staleness.mark();
            }
        },
        Config::default(),
    )
    .map_err(|e| format!("creating the pond watcher: {e}"))?;

    for pond in ponds {
        if let Err(e) = watcher.watch(pond, RecursiveMode::Recursive) {
            log::warn!("[library] not watching {}: {e}", pond.display());
        }
    }

    Ok(watcher)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_dotfile_is_never_prose_however_it_ends() {
        assert!(is_note(Path::new("2026-06-08.md")));
        assert!(!is_note(Path::new(".#2026-06-08.md")));
        assert!(!is_note(Path::new("notes.txt")));
        assert!(!is_note(Path::new("docs")));
    }
}
