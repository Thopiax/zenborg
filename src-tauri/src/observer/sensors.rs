//! Sensor wiring — the one impure part of the observer.
//!
//! The loop, the cadences, and the fail-open behaviour are the tray's, moved
//! rather than rewritten. What changed is where the two menubar affordances
//! went: pause is a Tauri command, and a missing Screen Recording grant is a
//! frontend event plus a log line instead of a menu item.

use std::sync::atomic::Ordering;
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use serde_json::json;
use tauri::{AppHandle, Emitter, Manager};
use user_idle::UserIdle;
use x_win::get_active_window;

use super::domain::{self, IdleTransition, MediaSnapshot, MediaTransition};
use super::{writer, ObserverState};

#[cfg(target_os = "macos")]
use media_remote::{
    get_now_playing_application_is_playing,
    get_now_playing_client_bundle_identifier,
    get_now_playing_info,
    InfoTypes,
};

/// Sensor poll cadence (~1–2s, as the tray polled).
const POLL_INTERVAL: Duration = Duration::from_millis(1500);

/// Input-activity sensor: 2 polls per 3s bin, 20 polls per 30s rollup.
const INPUT_POLLS_PER_BIN: usize = 2;
const INPUT_POLLS_PER_ROLLUP: usize = 20;
const INPUT_BIN_MS: u64 = 3_000;

/// Emitted when Screen Recording is missing. The window shows it if the window
/// happens to be open; the log carries it either way, which is the point of
/// running headless.
pub const PERMISSION_EVENT: &str = "observer://permission-needed";

// ── CoreGraphics HID event counters (counts only — the API cannot expose
// keycodes or content; verified to read without the Input Monitoring
// permission, macOS 15, 2026-06-12 spike) ───────────────────────────
#[cfg(target_os = "macos")]
#[link(name = "CoreGraphics", kind = "framework")]
extern "C" {
    fn CGEventSourceCounterForEventType(state_id: u32, event_type: u32) -> u32;
    // Screen Recording: CGWindowList degrades SILENTLY (empty window titles)
    // without the grant — x-win still returns Ok. Preflight is the only honest
    // check; request is what registers the app in the Settings list and shows
    // the one-time system prompt.
    fn CGPreflightScreenCaptureAccess() -> bool;
    fn CGRequestScreenCaptureAccess() -> bool;
}

#[cfg(target_os = "macos")]
const HID_SYSTEM_STATE: u32 = 1; // kCGEventSourceStateHIDSystemState
#[cfg(target_os = "macos")]
const ET_LEFT_MOUSE_DOWN: u32 = 1; // kCGEventLeftMouseDown
#[cfg(target_os = "macos")]
const ET_MOUSE_MOVED: u32 = 5; // kCGEventMouseMoved
#[cfg(target_os = "macos")]
const ET_KEY_DOWN: u32 = 10; // kCGEventKeyDown
#[cfg(target_os = "macos")]
const ET_SCROLL_WHEEL: u32 = 22; // kCGEventScrollWheel

/// `[keyDown, mouseDown, scroll, mouseMoved]` counters since boot.
#[cfg(target_os = "macos")]
fn read_input_counters() -> [u32; 4] {
    unsafe {
        [
            CGEventSourceCounterForEventType(HID_SYSTEM_STATE, ET_KEY_DOWN),
            CGEventSourceCounterForEventType(HID_SYSTEM_STATE, ET_LEFT_MOUSE_DOWN),
            CGEventSourceCounterForEventType(HID_SYSTEM_STATE, ET_SCROLL_WHEEL),
            CGEventSourceCounterForEventType(HID_SYSTEM_STATE, ET_MOUSE_MOVED),
        ]
    }
}

#[cfg(not(target_os = "macos"))]
fn read_input_counters() -> [u32; 4] {
    [0; 4]
}

#[cfg(target_os = "macos")]
fn screen_recording_granted() -> bool {
    unsafe { CGPreflightScreenCaptureAccess() }
}

#[cfg(not(target_os = "macos"))]
fn screen_recording_granted() -> bool {
    true
}

#[cfg(target_os = "macos")]
fn request_screen_recording() {
    unsafe {
        CGRequestScreenCaptureAccess();
    }
}

#[cfg(not(target_os = "macos"))]
fn request_screen_recording() {}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Explicit opt-in, re-read once per rollup so a config flip applies without
/// restarting the app. Missing file/key = off.
fn input_sensor_opted_in() -> bool {
    domain::input_sensor_enabled(&writer::read_config())
}

fn now_playing_opted_in() -> bool {
    domain::now_playing_sensor_enabled(&writer::read_config())
}

/// Build and append one event (fail-open).
fn emit(
    state: &ObserverState,
    kind: &str,
    ts: u64,
    payload: serde_json::Value,
    duration_ms: Option<u64>,
) {
    let file = domain::local_log_file_name(ts);
    let event = domain::build_event(
        uuid::Uuid::new_v4().to_string(),
        kind,
        ts,
        payload,
        duration_ms,
    );
    if let Some(line) = domain::event_line(&event) {
        let _ = writer::append_line(&state.log_dir, &file, &line);
    }
}

/// Pause or resume. The transition is logged, so a deliberate stop stays in
/// the log as data rather than becoming a silent hole — which is the failure
/// the tray's launchd agent was written to end.
pub fn set_paused(_app: &AppHandle, state: &ObserverState, paused: bool) {
    let was = state.paused.swap(paused, Ordering::SeqCst);
    if was == paused {
        return;
    }
    let kind = if paused {
        "writer_paused"
    } else {
        "writer_resumed"
    };
    emit(state, kind, now_ms(), json!({}), None);
}

fn flag_permission_needed(app: &AppHandle, state: &ObserverState) {
    if !state.permission_needed.swap(true, Ordering::SeqCst) {
        log::warn!(
            "[observer] Screen Recording not granted — window titles will log as empty. \
             Grant it in System Settings › Privacy & Security › Screen Recording, then relaunch."
        );
        let _ = app.emit(PERMISSION_EVENT, true);
    }
}

fn clear_permission_needed(app: &AppHandle, state: &ObserverState) {
    if state.permission_needed.swap(false, Ordering::SeqCst) {
        let _ = app.emit(PERMISSION_EVENT, false);
    }
}

/// Start the sensor loop if the config enabled it. Returns whether it started.
///
/// The caller must already have `manage`d an [`ObserverState`].
pub fn start(app: AppHandle) -> bool {
    let (enabled, log_dir, already_running) = {
        let state = app.state::<ObserverState>();
        (
            state.config.enabled,
            state.log_dir.clone(),
            state.running.swap(true, Ordering::SeqCst),
        )
    };

    if !enabled {
        // Undo the optimistic swap: nothing is running.
        app.state::<ObserverState>()
            .running
            .store(false, Ordering::SeqCst);
        log::info!("[observer] disabled — keel's tray remains the desktop writer");
        return false;
    }
    if already_running {
        return true;
    }

    log::info!("[observer] writing to {}", log_dir.display());

    {
        let state = app.state::<ObserverState>();
        emit(
            &state,
            "writer_started",
            now_ms(),
            json!({ "appVersion": env!("CARGO_PKG_VERSION") }),
            None,
        );
    }

    // Without Screen Recording, titles log as "" forever and no prompt ever
    // appears (the API never errors). Ask explicitly, once.
    if !screen_recording_granted() {
        request_screen_recording();
        let state = app.state::<ObserverState>();
        flag_permission_needed(&app, &state);
    }

    if now_playing_opted_in() {
        log::info!("[observer] Now Playing sensor enabled");
    }

    spawn_loop(app);
    true
}

fn spawn_loop(app: AppHandle) {
    thread::spawn(move || {
        let mut last_focus: Option<(String, String)> = None;
        let mut focus_since: Option<u64> = None;
        let mut idle_since: Option<u64> = None;
        let mut input_enabled = input_sensor_opted_in();
        let mut input_prev: Option<[u32; 4]> = None;
        let mut input_deltas: Vec<[u64; 4]> = Vec::new();
        let mut ticks: usize = 0;

        // Now Playing sensor (media-aware screen time).
        let mut np_enabled = now_playing_opted_in();
        let mut media_state: Option<(MediaSnapshot, u64)> = None;

        loop {
            thread::sleep(POLL_INTERVAL);

            let state = app.state::<ObserverState>();
            if state.paused.load(Ordering::SeqCst) {
                // Drop sensor state so resuming re-emits the current focus and
                // never closes a span (focus or idle) it didn't observe; input
                // bins are discarded, never emitted across a pause.
                last_focus = None;
                focus_since = None;
                idle_since = None;
                input_prev = None;
                input_deltas.clear();
                media_state = None;
                continue;
            }

            let now = now_ms();
            ticks = ticks.wrapping_add(1);

            // Input activity (counts only, default-off). The opt-in is re-read
            // once per rollup so config flips apply live.
            if ticks % INPUT_POLLS_PER_ROLLUP == 0 {
                input_enabled = input_sensor_opted_in();
            }
            if input_enabled {
                let counters = read_input_counters();
                if let Some(prev) = input_prev {
                    input_deltas.push([
                        domain::counter_delta(prev[0], counters[0]),
                        domain::counter_delta(prev[1], counters[1]),
                        domain::counter_delta(prev[2], counters[2]),
                        domain::counter_delta(prev[3], counters[3]),
                    ]);
                }
                input_prev = Some(counters);
                if input_deltas.len() >= INPUT_POLLS_PER_ROLLUP {
                    let window_ms = input_deltas.len() as u64 * POLL_INTERVAL.as_millis() as u64;
                    let bins = domain::fold_into_bins(&input_deltas, INPUT_POLLS_PER_BIN);
                    if let Some(payload) = domain::input_rollup(&bins, INPUT_BIN_MS) {
                        emit(&state, "input_activity", now, payload, Some(window_ms));
                    }
                    input_deltas.clear();
                }
            } else {
                input_prev = None;
                input_deltas.clear();
            }

            // Idle (IOKit HIDIdleTime via user-idle).
            if let Ok(idle) = UserIdle::get_time() {
                let idle_ms = idle.as_milliseconds() as u64;
                let (next, transition) =
                    domain::idle_transition(idle_since, now, idle_ms, domain::IDLE_THRESHOLD_MS);
                idle_since = next;
                match transition {
                    Some(IdleTransition::Start { ts }) => {
                        emit(
                            &state,
                            "idle_start",
                            ts,
                            json!({ "thresholdMs": domain::IDLE_THRESHOLD_MS }),
                            None,
                        );
                    }
                    Some(IdleTransition::End { ts, duration_ms }) => {
                        emit(&state, "idle_end", ts, json!({}), Some(duration_ms));
                    }
                    None => {}
                }
            }

            // Now Playing (media-aware screen time, default-off).
            // Re-read the opt-in once per rollup window, same cadence as input.
            if ticks % INPUT_POLLS_PER_ROLLUP == 0 {
                np_enabled = now_playing_opted_in();
            }
            #[cfg(target_os = "macos")]
            if np_enabled {
                let is_playing = get_now_playing_application_is_playing()
                    .unwrap_or(false);
                let bundle_id = get_now_playing_client_bundle_identifier()
                    .unwrap_or_default();

                let title = get_now_playing_info()
                    .and_then(|info| {
                        info.get("kMRMediaRemoteNowPlayingInfoTitle")
                            .and_then(|v| if let InfoTypes::String(s) = v { Some(s.clone()) } else { None })
                    })
                    .unwrap_or_default();

                let bundle_name = bundle_id
                    .rsplit('.')
                    .next()
                    .unwrap_or(&bundle_id)
                    .to_string();

                let (next, transition) = domain::media_transition(
                    media_state.as_ref(),
                    now,
                    is_playing,
                    &bundle_id,
                    &bundle_name,
                    &title,
                    domain::TITLE_CAP,
                );
                media_state = next;
                match transition {
                    Some(MediaTransition::Playing { ts, bundle_id, bundle_name, title }) => {
                        emit(
                            &state,
                            "media_playing",
                            ts,
                            domain::media_playing_payload(&bundle_id, &bundle_name, &title),
                            None,
                        );
                    }
                    Some(MediaTransition::Stopped { ts, duration_ms }) => {
                        emit(&state, "media_stopped", ts, json!({}), Some(duration_ms));
                    }
                    Some(MediaTransition::Changed { ts, prev_duration_ms, bundle_id, bundle_name, title }) => {
                        emit(&state, "media_stopped", ts, json!({}), Some(prev_duration_ms));
                        emit(
                            &state,
                            "media_playing",
                            ts,
                            domain::media_playing_payload(&bundle_id, &bundle_name, &title),
                            None,
                        );
                    }
                    None => {}
                }
            } else {
                media_state = None;
            }

            // Frontmost app (x-win).
            match get_active_window() {
                Ok(active) => {
                    // Ok(...) alone doesn't prove the grant (titles fail
                    // silently) — only clear on a passing preflight.
                    if screen_recording_granted() {
                        clear_permission_needed(&app, &state);
                    }
                    let app_name = active.info.name.clone();
                    let title = domain::cap_title(&active.title, domain::TITLE_CAP);
                    if domain::focus_changed(last_focus.as_ref(), &app_name, &title) {
                        emit(
                            &state,
                            "app_switched",
                            now,
                            domain::app_switch_payload(
                                &app_name,
                                &title,
                                active.position.is_full_screen,
                            ),
                            // durationMs closes the previous focus span —
                            // absent on the first sample after start/pause.
                            domain::switch_duration(focus_since, now),
                        );
                        last_focus = Some((app_name, title));
                        focus_since = Some(now);
                    }
                }
                Err(_) => {
                    // Fail-open: no event, the app stays up.
                    flag_permission_needed(&app, &state);
                }
            }
        }
    });
}
