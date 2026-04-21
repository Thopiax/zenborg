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
    /// Consumes the record regardless of whether the window has expired.
    pub fn is_self_write(&self, path: &str) -> bool {
        let mut writes = self.writes.lock().unwrap();
        if let Some(written_at) = writes.remove(path) {
            return written_at.elapsed().as_secs() < SELF_WRITE_WINDOW_SECS;
        }
        false
    }
}

impl Default for SelfWriteTracker {
    fn default() -> Self {
        Self::new()
    }
}
