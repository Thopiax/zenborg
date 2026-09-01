//! observer-core — pure logic for the desktop observer.
//!
//! No Tauri dependency. Shared by the zenborg app (which uses it for status
//! reporting) and zenborg-daemon (which uses it for the sensor loop).

pub mod config;
pub mod domain;
pub mod writer;
