//! Slice C step 5, and the answer to the design's Open question 3.
//!
//! *"Does the app schedule reindex, or does the watcher?"* Neither, alone.
//! **The watcher detects staleness; the reader pays for it.** A `notify`
//! watcher over the ponds marks the index stale and does no work; the next
//! question the garden asks is what triggers the reindex.
//!
//! That split is what keeps an idle machine idle. A watcher that both detects
//! and triggers reindexes at 3am because a sync landed; a wall-clock schedule
//! reindexes at 3am even when nothing landed at all. Demand triggers nothing
//! when nobody is asking, and the cost lands on the one person who benefits
//! from paying it.
//!
//! It is only correct because the index is derived and disposable: staleness
//! costs nothing until someone reads, so deferring is free rather than lazy.

use std::path::Path;
use std::process::Command;

use app_lib::library::{self, Staleness};
use tempfile::TempDir;

fn git(dir: &Path, args: &[&str]) {
    assert!(Command::new("git")
        .args(args)
        .current_dir(dir)
        .status()
        .unwrap()
        .success());
}

/// A pond with one dated note in it, indexed.
fn pond_with(date: &str, body: &str) -> TempDir {
    let td = TempDir::new().unwrap();
    let p = td.path();
    git(p, &["init", "-q"]);
    git(p, &["config", "user.email", "t@t.t"]);
    git(p, &["config", "user.name", "t"]);
    std::fs::create_dir_all(p.join("docs")).unwrap();
    std::fs::write(p.join(format!("docs/{date}.md")), body).unwrap();
    git(p, &["add", "-A"]);
    git(p, &["commit", "-qm", "c1"]);
    penceive_core::reindex_source(p, false).unwrap();
    td
}

#[test]
fn a_fresh_index_asks_for_no_work() {
    let staleness = Staleness::fresh();
    assert!(!staleness.take(), "nothing has changed, so nothing is owed");
}

#[test]
fn marking_is_the_watchers_whole_job_and_taking_clears_it() {
    let staleness = Staleness::fresh();

    staleness.mark();
    assert!(staleness.take(), "a marked index is owed a reindex");
    assert!(
        !staleness.take(),
        "the debt is paid once, not once per reader"
    );
}

#[test]
fn only_a_note_marks_the_index_stale() {
    // An editor's swap file, a git object, a `.DS_Store`: none of them is
    // prose, and a reindex triggered by one is work nobody asked for.
    assert!(library::is_note(Path::new("/p/docs/2026-06-08.md")));
    assert!(!library::is_note(Path::new("/p/docs/.2026-06-08.md.swp")));
    assert!(!library::is_note(Path::new("/p/.git/index")));
    assert!(!library::is_note(Path::new("/p/docs/.DS_Store")));
}

#[test]
fn the_reader_pays_for_staleness_and_the_next_reader_does_not() {
    let pond = pond_with("2026-06-08", "the season held more rest than I planned");
    let staleness = Staleness::fresh();

    // A note written after the index was built. Nothing has reindexed yet.
    std::fs::write(
        pond.path().join("docs/2026-06-09.md"),
        "the tide came in before I was ready",
    )
    .unwrap();
    git(pond.path(), &["add", "-A"]);
    git(pond.path(), &["commit", "-qm", "c2"]);

    let stale = library::search_fresh(pond.path(), &staleness, "tide", 10, None, None).unwrap();
    assert!(
        stale.is_empty(),
        "an unmarked index is not reindexed, however stale it is"
    );

    staleness.mark();
    let paid = library::search_fresh(pond.path(), &staleness, "tide", 10, None, None).unwrap();
    assert_eq!(paid.len(), 1, "the reader who asked is the one who paid");
    assert_eq!(paid[0].date, "2026-06-09");

    assert!(
        !staleness.take(),
        "the read cleared the debt; the next reader inherits a fresh index"
    );
}

/// Staleness is free, so a reindex that fails must cost nothing either. The
/// notes stay readable at whatever freshness the index already had.
#[test]
fn a_failed_reindex_still_answers_from_the_index_it_has() {
    let pond = pond_with("2026-06-08", "the season held more rest than I planned");
    let staleness = Staleness::fresh();
    staleness.mark();

    // Reindexing a path that is not there fails inside; the search must not.
    let gone = pond.path().join("no-such-pond");
    assert!(library::search_fresh(&gone, &staleness, "rest", 10, None, None).is_ok());

    staleness.mark();
    let hits = library::search_fresh(pond.path(), &staleness, "rest", 10, None, None).unwrap();
    assert_eq!(hits.len(), 1, "the pond that is there still answers");
}

/// The detector half, end to end. Writing a note under a watched pond marks
/// the index stale without anyone reindexing anything.
#[test]
fn a_note_written_under_a_watched_pond_marks_the_index_stale() {
    use std::sync::Arc;
    use std::time::{Duration, Instant};

    let pond = TempDir::new().unwrap();
    std::fs::create_dir_all(pond.path().join("docs")).unwrap();

    let staleness = Arc::new(Staleness::fresh());
    let _watcher = library::watch_ponds(&[pond.path().to_path_buf()], Arc::clone(&staleness))
        .expect("a pond that exists can be watched");

    std::fs::write(pond.path().join("docs/2026-06-10.md"), "written just now").unwrap();

    let deadline = Instant::now() + Duration::from_secs(5);
    while Instant::now() < deadline && !staleness.peek() {
        std::thread::sleep(Duration::from_millis(25));
    }

    assert!(
        staleness.peek(),
        "the watcher must notice a note it was pointed at"
    );
}
