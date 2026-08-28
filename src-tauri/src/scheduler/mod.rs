//! The app scheduler — what the three launchd agents used to do.
//!
//! Pure config parsing lives in `observer-core::config`; this module owns the
//! runtime (spawning threads, running processes, watching files).

use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use notify::{Config as NotifyConfig, RecommendedWatcher, RecursiveMode, Watcher};

use observer_core::config::{self, Job, Trigger};
use crate::observer::writer;

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
        for root in config::watch_roots(&paths) {
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
                    pending = false;
                    run(&job);
                }
                Err(_) => {
                    let _ = &watcher;
                    return;
                }
            }
        }
    });
}

/// Start every enabled job. Returns their names, for the startup log line.
pub fn bootstrap() -> Vec<String> {
    let jobs = config::parse_jobs(&writer::read_config());
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
    use observer_core::config::*;

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
