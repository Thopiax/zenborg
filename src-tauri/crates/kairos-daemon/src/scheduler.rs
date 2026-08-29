//! Scheduler runtime — spawns interval and watch jobs.
//! Pure logic lives in observer_core::config; this module owns the runtime.

use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

use notify::{Config as NotifyConfig, RecommendedWatcher, RecursiveMode, Watcher};

use observer_core::config::{self, Job, Trigger};
use observer_core::writer;

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
pub fn bootstrap(keel_dir: &std::path::Path) -> Vec<String> {
    let jobs = config::parse_jobs(&writer::read_config(keel_dir));
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
        log::info!("[scheduler] no jobs configured");
    } else {
        log::info!("[scheduler] started: {}", names.join(", "));
    }
    names
}
