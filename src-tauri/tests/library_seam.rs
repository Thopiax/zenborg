//! The seam between the garden and the library.
//!
//! The whole claim of slice C is that this boundary carries **dates and text
//! and nothing else**. These tests hold it to that: a `NoteHit` has three
//! fields, none of which names a library concept, and the app never learns
//! that an `Entry`, a `Blueprint` or a `KnowledgeGraph` exists.

use std::path::Path;
use std::process::Command;

use app_lib::library;
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
fn the_app_can_read_the_notes() {
    let pond = pond_with("2026-06-08", "the season held more rest than I planned");

    let hits = library::search_pond(pond.path(), "rest", 10, None, None).unwrap();

    assert!(!hits.is_empty(), "the app must be able to read the notes");
    let hit = &hits[0];
    assert_eq!(hit.date, "2026-06-08", "the seam carries a date");
    assert!(
        hit.preview.contains("rest"),
        "the seam carries text: {:?}",
        hit.preview
    );
    assert!(hit.score > 0.0);
}

#[test]
fn a_date_window_narrows_the_answer() {
    let pond = pond_with("2026-06-08", "the season held more rest than I planned");

    let inside =
        library::search_pond(pond.path(), "rest", 10, Some("2026-06-01"), Some("2026-06-30"))
            .unwrap();
    assert_eq!(inside.len(), 1, "a window containing the note keeps it");

    let outside =
        library::search_pond(pond.path(), "rest", 10, Some("2026-07-01"), None).unwrap();
    assert!(outside.is_empty(), "a window past the note drops it");
}

/// A pond that was never indexed answers "nothing", not a panic and not an
/// error. The app runs all day beside a derived, disposable index; a missing
/// one must not take a window down or make the garden render a failure.
#[test]
fn an_unindexed_pond_is_empty_not_a_panic() {
    let td = TempDir::new().unwrap();
    let hits = library::search_pond(td.path(), "anything", 10, None, None).unwrap();
    assert!(hits.is_empty());
}

/// The one method is all there is. If a later surface wants a field that is
/// neither a date nor text, that is a translation and it needs its own design.
#[test]
fn a_note_hit_is_a_date_some_text_and_a_score() {
    let hit = library::NoteHit {
        date: "2026-06-08".into(),
        preview: "opaque prose".into(),
        score: 1.0,
    };
    let json = serde_json::to_value(&hit).unwrap();
    let keys: Vec<&str> = json.as_object().unwrap().keys().map(|k| k.as_str()).collect();
    assert_eq!(keys, vec!["date", "preview", "score"]);
}
