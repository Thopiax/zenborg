//! Self-write suppression — ported from penceive.
//!
//! When we write a file, the OS notify watcher will fire for our own write.
//! Without suppression we'd bounce: write → event → reload → write.
//! We stamp every self-write with an Instant; the watcher checks and skips
//! if the event arrived within the suppression window.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

/// macOS FSEvents can batch/delay events by 2-3 seconds.
const SELF_WRITE_WINDOW_SECS: u64 = 3;

pub struct SelfWriteTracker {
    writes: Mutex<HashMap<String, Instant>>,
}

impl SelfWriteTracker {
    pub fn new() -> Self {
        Self {
            writes: Mutex::new(HashMap::new()),
        }
    }

    /// Called before writing a file. Stamps the path with the current Instant.
    pub fn register_write(&self, path: &str) {
        let mut writes = self.writes.lock().unwrap();
        writes.insert(path.to_string(), Instant::now());
    }

    /// Called by the watcher on each filesystem event. Returns true if the
    /// event was triggered by our own write (and should be suppressed).
    ///
    /// Keeps the record alive for the full suppression window so that
    /// duplicate FSEvents (macOS commonly delivers more than one event
    /// per rename) are all suppressed rather than just the first.
    /// Expired records are cleaned up lazily on the next check.
    pub fn is_self_write(&self, path: &str) -> bool {
        let mut writes = self.writes.lock().unwrap();
        if let Some(written_at) = writes.get(path) {
            if written_at.elapsed().as_secs() < SELF_WRITE_WINDOW_SECS {
                return true;
            }
            writes.remove(path);
        }
        false
    }
}

impl Default for SelfWriteTracker {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;
    use std::time::Duration;

    #[test]
    fn suppresses_duplicate_events_within_window() {
        let tracker = SelfWriteTracker::new();
        tracker.register_write("/vault/habits.json");

        assert!(tracker.is_self_write("/vault/habits.json"));
        // Second event for the same write — must still be suppressed
        assert!(tracker.is_self_write("/vault/habits.json"));
    }

    #[test]
    fn expires_after_window() {
        let tracker = SelfWriteTracker::new();
        tracker.register_write("/vault/habits.json");

        // Sleep past the suppression window
        thread::sleep(Duration::from_secs(SELF_WRITE_WINDOW_SECS + 1));

        assert!(!tracker.is_self_write("/vault/habits.json"));
    }

    #[test]
    fn new_write_refreshes_timestamp() {
        let tracker = SelfWriteTracker::new();
        tracker.register_write("/vault/habits.json");

        thread::sleep(Duration::from_secs(1));

        // A second write refreshes the window
        tracker.register_write("/vault/habits.json");

        thread::sleep(Duration::from_secs(SELF_WRITE_WINDOW_SECS - 1));

        // Still within window of the second write
        assert!(tracker.is_self_write("/vault/habits.json"));
    }

    #[test]
    fn unrelated_paths_are_independent() {
        let tracker = SelfWriteTracker::new();
        tracker.register_write("/vault/habits.json");

        assert!(!tracker.is_self_write("/vault/moments.json"));
        assert!(tracker.is_self_write("/vault/habits.json"));
    }
}
