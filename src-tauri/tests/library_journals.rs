//! The app becomes the writer of `journals`.
//!
//! Slice C, step 5's data half. `wake sync` pulled the device's notes into a
//! pond, which made `journals` a collection with two instrument writers and
//! left the substrate's rule 3 with nothing to say. The call is that the app
//! absorbs the pull, so there is exactly one instrument writing the prose and
//! the rule holds unchanged.
//!
//! Two questions, and this file holds both answers:
//!
//! 1. **Where does the collection live?** `$ZENBORG_HOME/journals`, like every
//!    other collection, the moment the prose is actually there. Until then the
//!    library's registry still answers, because a contract that claims a move
//!    that has not happened is worse than one that admits it.
//! 2. **What does a pull do to the index?** Marks it stale, and nothing else.
//!    The pull takes no writer lock, so it cannot block a `wake reindex` in a
//!    terminal and a terminal cannot block it.

use std::path::PathBuf;
use std::sync::atomic::{AtomicUsize, Ordering};

use app_lib::library::{journals, Staleness};

#[test]
fn journals_live_under_zenborg_home_once_the_prose_is_there() {
    let root = tempfile::tempdir().unwrap();
    let moved = root.path().join("journals");
    std::fs::create_dir_all(&moved).unwrap();
    std::fs::write(moved.join("2026-08-21.md"), "# a day\n").unwrap();

    let pond = journals::pond_in(root.path(), || {
        panic!("the registry must not be asked once the prose has moved")
    })
    .unwrap();

    assert_eq!(pond, moved);
}

#[test]
fn an_empty_journals_home_is_a_half_finished_move_and_does_not_count() {
    // `mkdir` is not the move. Answering a season's search from an empty pond
    // looks exactly like a person who wrote nothing, and the design already
    // refuses to conflate those two.
    let root = tempfile::tempdir().unwrap();
    std::fs::create_dir_all(root.path().join("journals")).unwrap();

    let pond = journals::pond_in(root.path(), || Ok(PathBuf::from("/ponds/wake"))).unwrap();

    assert_eq!(pond, PathBuf::from("/ponds/wake"));
}

#[test]
fn until_the_prose_moves_the_librarys_registry_still_answers() {
    let root = tempfile::tempdir().unwrap();

    let pond = journals::pond_in(root.path(), || Ok(PathBuf::from("/ponds/wake"))).unwrap();

    assert_eq!(pond, PathBuf::from("/ponds/wake"));
}

#[test]
fn no_journals_home_and_no_registry_is_an_error_not_a_guess() {
    let root = tempfile::tempdir().unwrap();

    let err = journals::pond_in(root.path(), || Err("no ponds registered".into())).unwrap_err();

    assert!(err.contains("no ponds registered"), "{err}");
}

#[test]
fn a_pull_marks_the_index_stale_and_the_next_reader_pays() {
    let staleness = Staleness::fresh();
    assert!(!staleness.peek());

    let msg = journals::pull_with(&staleness, || Ok("pulled lan into /ponds/wake".to_string()))
        .unwrap();

    assert!(staleness.peek(), "a pull that landed prose owes the index a reindex");
    assert!(msg.contains("pulled lan"), "{msg}");
    assert!(msg.contains("stale"), "the app must say what it did to the index: {msg}");
}

#[test]
fn a_pull_that_failed_owes_the_index_nothing() {
    let staleness = Staleness::fresh();

    let err = journals::pull_with(&staleness, || Err("supynote exited with code 1".to_string()))
        .unwrap_err();

    assert!(err.contains("supynote exited"), "{err}");
    assert!(
        !staleness.peek(),
        "nothing landed, so nothing is owed — a failed pull must not cost the next reader a reindex"
    );
}

#[test]
fn the_pull_runs_once_and_the_writer_lock_is_never_asked_for() {
    use penceive_core::application::ports::SearchIndex;
    use penceive_core::infrastructure::tantivy_index::TantivySearchIndex;

    let pond = tempfile::tempdir().unwrap();
    let index_dir = pond.path().join(".penceive").join("index");
    std::fs::create_dir_all(&index_dir).unwrap();

    // A `wake reindex` is running in a terminal and owns the writer. The app
    // must still be able to pull: step 1 split reads from writes so the two
    // surfaces could share one index, and absorbing the pull must not put that
    // back.
    let held: Box<dyn SearchIndex> = Box::new(TantivySearchIndex::new(index_dir).unwrap());

    let staleness = Staleness::fresh();
    let pulls = AtomicUsize::new(0);

    journals::pull_with(&staleness, || {
        pulls.fetch_add(1, Ordering::SeqCst);
        std::fs::write(pond.path().join("2026-08-21.md"), "# a day\n").map_err(|e| e.to_string())?;
        Ok("pulled lan into the pond".to_string())
    })
    .expect("a pull must not need the index writer");

    assert_eq!(pulls.load(Ordering::SeqCst), 1);
    assert!(staleness.peek());
    drop(held);
}
