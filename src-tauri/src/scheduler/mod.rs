//! The app scheduler — what the three launchd agents used to do.
//!
//! Migration step 4 of "the garden absorbs keel". Two of the retired plists
//! were not really about being a daemon; they were about *when*:
//!
//! | plist | trigger |
//! |---|---|
//! | `com.equanimitech.keel.garmin` | `StartInterval` 3600 + `RunAtLoad` |
//! | `tech.equanimi.keel.classify` | `WatchPaths` on the Things sqlite pair |
//!
//! Once one process is already up for the whole session, those are an interval
//! and a file watch, and a resident app expresses both better than launchd
//! does — a shared log, one place to look, and no absolute path baked into a
//! file the user never opens.
//!
//! ## The scheduler does not know what Garmin is
//!
//! A job is data: a name, a trigger, a program, arguments, environment. There
//! is no `garmin` branch and no `classify` branch anywhere in this file, which
//! is what keeps the third job a config edit rather than a code change. The
//! two shapes launchd offered are the two triggers modelled here, and nothing
//! else was carried over.
//!
//! ## Off unless asked
//!
//! An empty or absent `desktop.scheduler` runs nothing. The three plists are
//! not deleted until step 6 and may still be loaded; a scheduler that started
//! itself would double every Garmin poll and race the classifier against its
//! own second copy. The user turns each job on in the same breath as they
//! `launchctl bootout` its plist.

use std::collections::HashMap;
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use notify::{Config as NotifyConfig, RecommendedWatcher, RecursiveMode, Watcher};
use serde_json::Value;

use crate::observer::writer;

/// When a job fires.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Trigger {
    /// `StartInterval`, with `RunAtLoad` folded in as `run_at_load`.
    Interval { seconds: u64, run_at_load: bool },
    /// `WatchPaths`. `debounce` is the quiet period a burst has to settle for;
    /// SQLite in WAL mode touches main and `-wal` on one commit, and a
    /// checkpoint touches them again, so an undebounced watch fires several
    /// times for one edit.
    Watch {
        paths: Vec<PathBuf>,
        debounce: Duration,
    },
}

/// One scheduled job.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Job {
    pub name: String,
    pub program: PathBuf,
    pub args: Vec<String>,
    /// launchd hands a job a near-empty PATH, so both plists had to spell one
    /// out. A Tauri app inherits the GUI session's environment instead, which
    /// is usually enough — this stays because "usually" is not a contract.
    pub env: HashMap<String, String>,
    pub trigger: Trigger,
}

/// The smallest interval a job may ask for. `ThrottleInterval` by another
/// name: a job configured to run every second is a mistake, and honouring it
/// would be a busy loop with a process spawn in it.
const MIN_INTERVAL: Duration = Duration::from_secs(60);

/// Default quiet period for a watch trigger.
const DEFAULT_DEBOUNCE: Duration = Duration::from_secs(30);

/// Parse `desktop.scheduler.jobs`.
///
/// Pure, and forgiving in exactly one direction: a job that cannot be read is
/// dropped, never guessed at. A half-understood job would spawn a process on a
/// schedule nobody chose.
pub fn parse_jobs(config_json: &str) -> Vec<Job> {
    let Some(array) = serde_json::from_str::<Value>(config_json)
        .ok()
        .and_then(|c| {
            c.get("desktop")?
                .get("scheduler")?
                .get("jobs")?
                .as_array()
                .cloned()
        })
    else {
        return Vec::new();
    };

    let mut jobs = Vec::new();
    for node in &array {
        if let Some(job) = parse_job(node) {
            jobs.push(job);
        }
    }
    jobs
}

fn parse_job(node: &Value) -> Option<Job> {
    if node.get("enabled").and_then(Value::as_bool) != Some(true) {
        return None;
    }
    let name = node.get("name").and_then(Value::as_str)?.to_string();
    let program = PathBuf::from(node.get("program").and_then(Value::as_str)?);
    if name.is_empty() || program.as_os_str().is_empty() {
        return None;
    }

    let args = node
        .get("args")
        .and_then(Value::as_array)
        .map(|a| {
            a.iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .unwrap_or_default();

    let env = node
        .get("env")
        .and_then(Value::as_object)
        .map(|o| {
            o.iter()
                .filter_map(|(k, v)| v.as_str().map(|s| (k.clone(), s.to_string())))
                .collect()
        })
        .unwrap_or_default();

    let trigger = parse_trigger(node.get("trigger")?)?;

    Some(Job {
        name,
        program,
        args,
        env,
        trigger,
    })
}

fn parse_trigger(node: &Value) -> Option<Trigger> {
    match node.get("kind").and_then(Value::as_str)? {
        "interval" => {
            let seconds = node.get("seconds").and_then(Value::as_u64)?;
            Some(Trigger::Interval {
                seconds: seconds.max(MIN_INTERVAL.as_secs()),
                run_at_load: node
                    .get("runAtLoad")
                    .and_then(Value::as_bool)
                    .unwrap_or(false),
            })
        }
        "watch" => {
            let paths: Vec<PathBuf> = node
                .get("paths")?
                .as_array()?
                .iter()
                .filter_map(Value::as_str)
                .map(PathBuf::from)
                .collect();
            if paths.is_empty() {
                return None;
            }
            let debounce = node
                .get("debounceSeconds")
                .and_then(Value::as_u64)
                .map(Duration::from_secs)
                .unwrap_or(DEFAULT_DEBOUNCE);
            Some(Trigger::Watch { paths, debounce })
        }
        _ => None,
    }
}

/// The set of directories a watch trigger has to subscribe to.
///
/// Directories, not the files themselves. SQLite replaces `-wal` on
/// checkpoint, and a watch bound to the old inode goes quiet without ever
/// erroring — the exact failure mode this whole migration exists to end.
pub fn watch_roots(paths: &[PathBuf]) -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();
    for path in paths {
        if let Some(parent) = path.parent() {
            let parent = parent.to_path_buf();
            if !roots.contains(&parent) {
                roots.push(parent);
            }
        }
    }
    roots
}

/// Run one job to completion, logging the outcome.
///
/// Output goes to the app's own log rather than `/tmp/keel-garmin.log` and
/// `~/.kairos/keel/log/classify.err`. One place to look is most of what
/// "install collapses" buys.
fn run(job: &Job) {
    let started = Instant::now();
    let mut command = Command::new(&job.program);
    command
        .args(&job.args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    for (key, value) in &job.env {
        command.env(key, value);
    }

    match command.status() {
        Ok(status) if status.success() => {
            log::info!(
                "[scheduler] {} finished in {:?}",
                job.name,
                started.elapsed()
            );
        }
        Ok(status) => {
            // Not an error here. Both jobs are documented to exit early when
            // their dependency is down (ollama, the watch's cloud sync), and a
            // scheduler that treated that as a failure would cry wolf hourly.
            log::info!("[scheduler] {} exited with {}", job.name, status);
        }
        Err(error) => {
            log::warn!("[scheduler] {} could not start: {error}", job.name);
        }
    }
}

fn spawn_interval(job: Job, seconds: u64, run_at_load: bool) {
    thread::spawn(move || {
        if run_at_load {
            run(&job);
        }
        loop {
            thread::sleep(Duration::from_secs(seconds));
            // Sequential by construction: the next tick cannot start until
            // this one returns, so a slow run delays rather than overlaps.
            run(&job);
        }
    });
}

fn spawn_watch(job: Job, paths: Vec<PathBuf>, debounce: Duration) {
    thread::spawn(move || {
        let (tx, rx) = mpsc::channel();
        let mut watcher = match RecommendedWatcher::new(tx, NotifyConfig::default()) {
            Ok(w) => w,
            Err(error) => {
                log::warn!("[scheduler] {} watcher failed: {error}", job.name);
                return;
            }
        };
        for root in watch_roots(&paths) {
            if let Err(error) = watcher.watch(&root, RecursiveMode::NonRecursive) {
                log::warn!(
                    "[scheduler] {} cannot watch {}: {error}",
                    job.name,
                    root.display()
                );
            }
        }

        let mut pending = false;
        loop {
            // Block for the first event of a burst, then drain the burst on a
            // timeout. One commit touches main and `-wal`; a checkpoint
            // touches them again.
            let next = if pending {
                rx.recv_timeout(debounce).map_err(|e| e.to_string())
            } else {
                rx.recv().map_err(|e| e.to_string())
            };

            match next {
                Ok(Ok(event)) => {
                    if event.paths.iter().any(|p| paths.contains(p)) {
                        pending = true;
                    }
                }
                Ok(Err(_)) => {}
                Err(_) if pending => {
                    // The burst settled.
                    pending = false;
                    run(&job);
                }
                Err(_) => {
                    // recv() on a dead channel: the watcher is gone.
                    let _ = &watcher;
                    return;
                }
            }
        }
    });
}

/// Start every enabled job. Returns their names, for the startup log line.
pub fn bootstrap() -> Vec<String> {
    let jobs = parse_jobs(&writer::read_config());
    let names: Vec<String> = jobs.iter().map(|j| j.name.clone()).collect();

    for job in jobs {
        match job.trigger.clone() {
            Trigger::Interval {
                seconds,
                run_at_load,
            } => spawn_interval(job, seconds, run_at_load),
            Trigger::Watch { paths, debounce } => spawn_watch(job, paths, debounce),
        }
    }

    if names.is_empty() {
        log::info!("[scheduler] no jobs configured — the launchd agents still own the schedules");
    } else {
        log::info!("[scheduler] started: {}", names.join(", "));
    }
    names
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_absent_or_broken_config_schedules_nothing() {
        for input in ["", "{ not json", "{}", r#"{"desktop":{"scheduler":{}}}"#] {
            assert!(parse_jobs(input).is_empty(), "input {input:?}");
        }
    }

    #[test]
    fn a_job_has_to_say_enabled_out_loud() {
        let json = r#"{"desktop":{"scheduler":{"jobs":[
            {"name":"garmin","program":"/x","trigger":{"kind":"interval","seconds":3600}}
        ]}}}"#;
        assert!(parse_jobs(json).is_empty());
    }

    #[test]
    fn the_garmin_plist_translates_to_one_interval_job() {
        let json = r#"{"desktop":{"scheduler":{"jobs":[{
            "name":"garmin","enabled":true,
            "program":"/repo/integrations/garmin/garmin_sync.py",
            "env":{"PATH":"/opt/homebrew/bin:/usr/bin:/bin"},
            "trigger":{"kind":"interval","seconds":3600,"runAtLoad":true}
        }]}}}"#;
        let jobs = parse_jobs(json);
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].name, "garmin");
        assert_eq!(
            jobs[0].trigger,
            Trigger::Interval {
                seconds: 3600,
                run_at_load: true
            }
        );
        assert_eq!(
            jobs[0].env.get("PATH").map(String::as_str),
            Some("/opt/homebrew/bin:/usr/bin:/bin")
        );
    }

    #[test]
    fn the_classify_plist_translates_to_one_watch_job() {
        let json = r#"{"desktop":{"scheduler":{"jobs":[{
            "name":"classify","enabled":true,
            "program":"/Users/x/Library/pnpm/node",
            "args":["/repo/apps/agent/keel-classify.mjs"],
            "trigger":{"kind":"watch","paths":["/db/main.sqlite","/db/main.sqlite-wal"],"debounceSeconds":10}
        }]}}}"#;
        let jobs = parse_jobs(json);
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].args, vec!["/repo/apps/agent/keel-classify.mjs"]);
        assert_eq!(
            jobs[0].trigger,
            Trigger::Watch {
                paths: vec![
                    PathBuf::from("/db/main.sqlite"),
                    PathBuf::from("/db/main.sqlite-wal")
                ],
                debounce: Duration::from_secs(10),
            }
        );
    }

    #[test]
    fn a_watch_subscribes_to_the_directory_and_deduplicates_it() {
        let roots = watch_roots(&[
            PathBuf::from("/db/main.sqlite"),
            PathBuf::from("/db/main.sqlite-wal"),
            PathBuf::from("/other/x"),
        ]);
        assert_eq!(
            roots,
            vec![PathBuf::from("/db"), PathBuf::from("/other")],
            "one subscription per directory, so a replaced -wal inode still fires"
        );
    }

    #[test]
    fn a_reckless_interval_is_floored_rather_than_honoured() {
        let json = r#"{"desktop":{"scheduler":{"jobs":[{
            "name":"busy","enabled":true,"program":"/x",
            "trigger":{"kind":"interval","seconds":1}
        }]}}}"#;
        assert_eq!(
            parse_jobs(json)[0].trigger,
            Trigger::Interval {
                seconds: 60,
                run_at_load: false
            }
        );
    }

    #[test]
    fn an_unreadable_job_is_dropped_and_its_siblings_still_run() {
        let json = r#"{"desktop":{"scheduler":{"jobs":[
            {"name":"nameless","enabled":true,"trigger":{"kind":"interval","seconds":3600}},
            {"name":"unknown","enabled":true,"program":"/x","trigger":{"kind":"cron","expr":"* * * * *"}},
            {"name":"pathless-watch","enabled":true,"program":"/x","trigger":{"kind":"watch","paths":[]}},
            {"name":"good","enabled":true,"program":"/x","trigger":{"kind":"interval","seconds":3600}}
        ]}}}"#;
        let jobs = parse_jobs(json);
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].name, "good");
    }
}
