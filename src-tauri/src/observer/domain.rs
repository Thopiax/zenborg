//! Desktop observer domain — pure logic, no I/O.
//!
//! Ported verbatim in behaviour from `keel/apps/tray/src-tauri/src/domain.rs`,
//! minus the two menubar-only concerns (the granularity submenu and the
//! step-away wheel), which are UI for something else and are not the writer's
//! job. Everything here is the writer's job: event building, dedupe decisions,
//! day-file naming, title capping, the idle state machine, and the input
//! rollup.
//!
//! Keeping the functions byte-for-byte equivalent is what makes step 3's
//! parity check meaningful: the two writers must be diffable line by line,
//! and a "tidied" rewrite would make every diff ambiguous.

use chrono::{Local, NaiveDate, TimeZone};
use serde::Serialize;
use serde_json::{json, Value};

/// The surface tag every event from this writer carries.
///
/// Deliberately still `desktop`, not `zenborg`. The surface names *what was
/// observed*, not which binary observed it, and the read side has two years of
/// history keyed on this string. Changing it would silently fork every
/// hour-of-day derivation at the migration boundary.
pub const SURFACE: &str = "desktop";

/// Window titles are capped at this many chars (privacy + bounded lines).
/// Substrate invariant 8.
pub const TITLE_CAP: usize = 256;

/// Idle threshold: no input for this long → an `idle_start` event.
pub const IDLE_THRESHOLD_MS: u64 = 120_000;

/// One raw observation. Field names and order mirror `@keel/domain`
/// `ActivityEvent`: `{ id, surface, kind, ts, sessionId, payload, durationMs? }`.
#[derive(Debug, Clone, Serialize)]
pub struct ActivityEvent {
    pub id: String,
    pub surface: &'static str,
    pub kind: String,
    /// Epoch milliseconds at observation time.
    pub ts: u64,
    /// Always "" on this surface — no session concept yet.
    #[serde(rename = "sessionId")]
    pub session_id: String,
    pub payload: Value,
    #[serde(rename = "durationMs", skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<u64>,
}

/// Build an event. The caller supplies the id (writers own id generation —
/// the domain stays free of randomness).
pub fn build_event(
    id: String,
    kind: &str,
    ts: u64,
    payload: Value,
    duration_ms: Option<u64>,
) -> ActivityEvent {
    ActivityEvent {
        id,
        surface: SURFACE,
        kind: kind.to_string(),
        ts,
        session_id: String::new(),
        payload,
        duration_ms,
    }
}

/// One JSON object per line.
pub fn event_line(e: &ActivityEvent) -> Option<String> {
    serde_json::to_string(e).ok().map(|s| s + "\n")
}

/// Daily bucket for the desktop surface — LOCAL date, `YYYY-MM-DD.<surface>.jsonl`.
pub fn log_file_name(date: NaiveDate) -> String {
    format!("{}.{}.jsonl", date.format("%Y-%m-%d"), SURFACE)
}

/// `log_file_name` for an epoch-ms timestamp in the machine's local zone.
pub fn local_log_file_name(ts_ms: u64) -> String {
    let date = Local
        .timestamp_millis_opt(ts_ms as i64)
        .single()
        .map(|dt| dt.date_naive())
        .unwrap_or_else(|| Local::now().date_naive());
    log_file_name(date)
}

/// `app_switched` payload: app names + capped window titles + a flag. Never more.
pub fn app_switch_payload(app_name: &str, window_title: &str, is_full_screen: bool) -> Value {
    json!({
        "app_name": app_name,
        "window_title": window_title,
        "is_full_screen": is_full_screen,
    })
}

/// Duration of the focus span an `app_switched` event closes — `None` for the
/// first observation after start or pause (no span was open).
///
/// Substrate invariant 3: `durationMs` is present only when the interval was
/// measured. Never fabricated across a restart or a pause.
pub fn switch_duration(prev_span_start: Option<u64>, now_ms: u64) -> Option<u64> {
    prev_span_start.map(|started| now_ms.saturating_sub(started))
}

/// Cap a window title at `max_chars` characters (char-boundary safe).
pub fn cap_title(title: &str, max_chars: usize) -> String {
    title.chars().take(max_chars).collect()
}

/// Emit decision for `app_switched`: the app name OR the (capped) window
/// title actually changed, and the sample is resolvable. An empty `app_name`
/// means the OS couldn't name the owning app (overlays, screenshot UI,
/// permission dialogs) — never a switch; the previous app's span simply
/// continues. `None` previous state always emits.
pub fn focus_changed(prev: Option<&(String, String)>, app_name: &str, window_title: &str) -> bool {
    if app_name.is_empty() {
        return false;
    }
    match prev {
        None => true,
        Some((prev_app, prev_title)) => prev_app != app_name || prev_title != window_title,
    }
}

// ── Input-activity sensor (counts only, default-off) ────────────
// Fogarty's "Easy to Build" set: keyboard/mouse/scroll event COUNTS per bin —
// never keycodes, never content (the counter API cannot expose them). Ships
// off; the opt-in is `desktop.inputActivity` in the keel config, and this
// reads the same key the tray reads so a flip applies to whichever writer is
// up. See keel `packages/domain/docs/event-taxonomy.md` (`input_activity`).

/// Explicit opt-in gate. Anything but a literal `true` — missing key,
/// malformed JSON, empty file — means OFF (neutral default).
pub fn input_sensor_enabled(config_json: &str) -> bool {
    serde_json::from_str::<Value>(config_json)
        .ok()
        .and_then(|c| c.get("desktop")?.get("inputActivity")?.as_bool())
        .unwrap_or(false)
}

/// Events since the previous poll. The system counter is a u32 since boot;
/// wrapping subtraction survives the rollover.
pub fn counter_delta(prev: u32, now: u32) -> u64 {
    now.wrapping_sub(prev) as u64
}

/// Fold per-poll deltas `[keyDown, mouseDown, scroll, mouseMoved]` into bins
/// of `per_bin` polls (1.5s polls × 2 = 3s bins).
pub fn fold_into_bins(deltas: &[[u64; 4]], per_bin: usize) -> Vec<[u64; 4]> {
    let mut bins = Vec::new();
    for chunk in deltas.chunks(per_bin) {
        let mut bin = [0u64; 4];
        for d in chunk {
            for i in 0..4 {
                bin[i] += d[i];
            }
        }
        bins.push(bin);
    }
    bins
}

/// The `input_activity` payload for one rollup window, or `None` when the
/// window was fully idle (idle spans already bracket those). Counts per bin
/// only — exactly five keys, nothing content-capable.
pub fn input_rollup(bins: &[[u64; 4]], bin_ms: u64) -> Option<Value> {
    if bins.iter().all(|b| b.iter().all(|&c| c == 0)) {
        return None;
    }
    let series = |i: usize| bins.iter().map(|b| b[i]).collect::<Vec<_>>();
    Some(json!({
        "binMs": bin_ms,
        "keyDowns": series(0),
        "mouseDowns": series(1),
        "scrolls": series(2),
        "mouseMoves": series(3),
    }))
}

/// An idle-state transition the sensor loop should log.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum IdleTransition {
    /// Input stopped ≥ threshold ago. `ts` is backdated to when input stopped.
    Start { ts: u64 },
    /// First activity after an idle span. `duration_ms` covers the whole span.
    End { ts: u64, duration_ms: u64 },
}

/// Pure idle state machine. State is `idle_since` (the backdated start of the
/// current idle span, or `None` when active). `idle_ms` is the system's
/// time-since-last-input at `now_ms`. Returns the next state and the event to
/// emit, if any.
pub fn idle_transition(
    idle_since: Option<u64>,
    now_ms: u64,
    idle_ms: u64,
    threshold_ms: u64,
) -> (Option<u64>, Option<IdleTransition>) {
    match idle_since {
        None if idle_ms >= threshold_ms => {
            let started = now_ms.saturating_sub(idle_ms);
            (Some(started), Some(IdleTransition::Start { ts: started }))
        }
        Some(started) if idle_ms < threshold_ms => {
            // Input resumed `idle_ms` ago — that instant ends the span.
            let ended = now_ms.saturating_sub(idle_ms);
            let duration_ms = ended.saturating_sub(started);
            (
                None,
                Some(IdleTransition::End {
                    ts: ended,
                    duration_ms,
                }),
            )
        }
        state => (state, None),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_event_serializes_with_the_keel_field_names() {
        let event = build_event(
            "id-1".into(),
            "app_switched",
            1_700_000_000_000,
            json!({}),
            None,
        );
        let line = event_line(&event).expect("serializable");
        assert!(line.ends_with('\n'), "one JSON object per line");
        let parsed: Value = serde_json::from_str(line.trim()).unwrap();
        assert_eq!(parsed["surface"], "desktop");
        assert_eq!(parsed["sessionId"], "");
        assert!(
            parsed.get("durationMs").is_none(),
            "an unmeasured interval carries no durationMs"
        );
    }

    #[test]
    fn a_measured_span_carries_its_duration_and_an_unmeasured_one_does_not() {
        assert_eq!(switch_duration(Some(100), 350), Some(250));
        assert_eq!(switch_duration(None, 350), None);
    }

    #[test]
    fn the_day_file_uses_the_local_date_and_the_surface_tag() {
        let name = log_file_name(NaiveDate::from_ymd_opt(2026, 8, 21).unwrap());
        assert_eq!(name, "2026-08-21.desktop.jsonl");
    }

    #[test]
    fn a_title_is_capped_on_char_boundaries() {
        let long: String = "é".repeat(TITLE_CAP + 50);
        assert_eq!(cap_title(&long, TITLE_CAP).chars().count(), TITLE_CAP);
    }

    #[test]
    fn an_unnamed_app_never_counts_as_a_switch() {
        // Overlays and permission dialogs leave the OS unable to name the
        // owner; the previous span continues rather than being cut in two.
        assert!(!focus_changed(None, "", "anything"));
        let prev = ("Ghostty".to_string(), "keel".to_string());
        assert!(!focus_changed(Some(&prev), "", ""));
        assert!(focus_changed(Some(&prev), "Ghostty", "zenborg"));
        assert!(!focus_changed(Some(&prev), "Ghostty", "keel"));
    }

    #[test]
    fn the_input_sensor_is_off_unless_the_config_says_literal_true() {
        assert!(!input_sensor_enabled(""));
        assert!(!input_sensor_enabled("{ not json"));
        assert!(!input_sensor_enabled(r#"{"desktop":{}}"#));
        assert!(!input_sensor_enabled(
            r#"{"desktop":{"inputActivity":"yes"}}"#
        ));
        assert!(input_sensor_enabled(
            r#"{"desktop":{"inputActivity":true}}"#
        ));
    }

    #[test]
    fn the_counter_delta_survives_the_u32_rollover() {
        assert_eq!(counter_delta(u32::MAX - 1, 2), 4);
    }

    #[test]
    fn a_fully_idle_rollup_emits_nothing() {
        assert!(input_rollup(&[[0, 0, 0, 0], [0, 0, 0, 0]], 3_000).is_none());
        assert!(input_rollup(&[[0, 0, 0, 0], [1, 0, 0, 0]], 3_000).is_some());
    }

    #[test]
    fn idle_start_is_backdated_to_when_input_actually_stopped() {
        let (state, event) = idle_transition(None, 1_000_000, 130_000, IDLE_THRESHOLD_MS);
        assert_eq!(state, Some(870_000));
        assert_eq!(event, Some(IdleTransition::Start { ts: 870_000 }));
    }

    #[test]
    fn idle_end_closes_the_span_at_the_instant_input_resumed() {
        let (state, event) = idle_transition(Some(870_000), 1_000_000, 500, IDLE_THRESHOLD_MS);
        assert_eq!(state, None);
        assert_eq!(
            event,
            Some(IdleTransition::End {
                ts: 999_500,
                duration_ms: 129_500
            })
        );
    }
}
