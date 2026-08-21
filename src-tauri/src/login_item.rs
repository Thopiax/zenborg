//! One login item, via `SMAppService`.
//!
//! Migration step 4 of "the garden absorbs keel". Three launchd agents —
//! `com.equanimitech.keel.tray`, `tech.equanimi.keel.classify`, and
//! `com.equanimitech.keel.garmin` — collapse into a single entry in System
//! Settings › General › Login Items & Extensions, under "Allow in the
//! Background". That entry is the app, and the app owns the schedules that the
//! three plists used to own (see `crate::scheduler`).
//!
//! `SMAppService` rather than `~/Library/LaunchAgents`, deliberately. A plist
//! the user never sees is a background process with no disclosure; the login
//! item is the disclosure, and it is revocable from Settings without a
//! terminal. That trade — one honest, visible, revocable entry instead of
//! three invisible ones — is the whole argument for retiring the menubar
//! presence, recorded in
//! `kairos/docs/decisions/2026-08-21-run-the-writer-as-a-background-agent-rather-than-a-menubar-tray.md`.
//!
//! ## Implementation note
//!
//! Called through the plain Objective-C runtime rather than a binding crate.
//! `SMAppService` is macOS 13+, zenborg's `minimumSystemVersion` is 11.0, and
//! a binding that assumes the class exists would abort on an older machine.
//! Looking the class up at runtime lets 11 and 12 report `unsupported` and
//! keep running, which is the same fail-open posture as the observer.

#![cfg_attr(not(target_os = "macos"), allow(dead_code))]

use serde::Serialize;

/// `SMAppServiceStatus`, plus the two cases the enum cannot express.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum LoginItemStatus {
    /// The app is not registered to launch at login.
    NotRegistered,
    /// Registered and enabled — this is the state step 4 is aiming at.
    Enabled,
    /// Registered, but the user has to approve it in System Settings. macOS
    /// shows this the first time; nothing else can clear it.
    RequiresApproval,
    /// macOS cannot find the service. In practice: running unbundled, which is
    /// what `tauri dev` does.
    NotFound,
    /// macOS 12 or earlier, or a non-macOS build.
    Unsupported,
}

#[derive(Debug, Clone, Serialize)]
pub struct LoginItem {
    pub status: LoginItemStatus,
    /// True when the app is running from a `.app` bundle. Registration cannot
    /// succeed otherwise, and saying so is more use than a bare failure.
    pub bundled: bool,
}

#[cfg(target_os = "macos")]
mod sys {
    use std::ffi::{c_char, c_int, c_void};

    // Force the framework onto the link line. Without it the class is not in
    // the image and the runtime lookup below returns null on every machine,
    // including the ones that support it.
    #[link(name = "ServiceManagement", kind = "framework")]
    extern "C" {}

    extern "C" {
        fn objc_getClass(name: *const c_char) -> *mut c_void;
        fn sel_registerName(name: *const c_char) -> *mut c_void;
        fn objc_msgSend();
        fn dlopen(path: *const c_char, mode: c_int) -> *mut c_void;
    }

    const RTLD_LAZY: c_int = 0x1;
    const SERVICE_MANAGEMENT: &[u8] =
        b"/System/Library/Frameworks/ServiceManagement.framework/ServiceManagement\0";

    /// `objc_msgSend` is not variadic on aarch64: every call has to go through
    /// a pointer cast to the exact signature. These three are the only shapes
    /// this module needs.
    type MsgSendId = unsafe extern "C" fn(*mut c_void, *mut c_void) -> *mut c_void;
    type MsgSendIsize = unsafe extern "C" fn(*mut c_void, *mut c_void) -> isize;
    type MsgSendBoolPtr = unsafe extern "C" fn(*mut c_void, *mut c_void, *mut c_void) -> bool;

    fn sel(name: &[u8]) -> *mut c_void {
        // Every literal below is NUL-terminated at the call site.
        unsafe { sel_registerName(name.as_ptr() as *const c_char) }
    }

    /// The `SMAppService` class, or null on macOS 12 and earlier.
    ///
    /// The `dlopen` retry is belt and braces: if the link attribute above is
    /// ever dropped as unused, this still finds the class on a machine that
    /// has it, rather than reporting every machine as unsupported.
    fn class() -> *mut c_void {
        unsafe {
            let name = b"SMAppService\0".as_ptr() as *const c_char;
            let found = objc_getClass(name);
            if !found.is_null() {
                return found;
            }
            dlopen(SERVICE_MANAGEMENT.as_ptr() as *const c_char, RTLD_LAZY);
            objc_getClass(name)
        }
    }

    /// `+[SMAppService mainAppService]`, or null when unsupported.
    ///
    /// Not retained: the returned object is autoreleased by the callee and
    /// used immediately inside the same call, before any pool can drain.
    fn main_app_service() -> *mut c_void {
        let cls = class();
        if cls.is_null() {
            return std::ptr::null_mut();
        }
        unsafe {
            let send: MsgSendId = std::mem::transmute(objc_msgSend as *const ());
            send(cls, sel(b"mainAppService\0"))
        }
    }

    /// Raw `SMAppServiceStatus`, or `None` when unsupported.
    pub fn status() -> Option<isize> {
        let service = main_app_service();
        if service.is_null() {
            return None;
        }
        unsafe {
            let send: MsgSendIsize = std::mem::transmute(objc_msgSend as *const ());
            Some(send(service, sel(b"status\0")))
        }
    }

    /// `-registerAndReturnError:` / `-unregisterAndReturnError:`.
    ///
    /// The `NSError**` out-parameter is passed as null. The caller re-reads
    /// `status()` afterwards, which is a truer answer than the error object:
    /// registration can "succeed" into `requiresApproval`, and that is the
    /// case the user actually has to act on.
    fn set_registered(register: bool) -> Option<bool> {
        let service = main_app_service();
        if service.is_null() {
            return None;
        }
        let selector = if register {
            sel(b"registerAndReturnError:\0")
        } else {
            sel(b"unregisterAndReturnError:\0")
        };
        unsafe {
            let send: MsgSendBoolPtr = std::mem::transmute(objc_msgSend as *const ());
            Some(send(service, selector, std::ptr::null_mut()))
        }
    }

    pub fn register() -> Option<bool> {
        set_registered(true)
    }

    pub fn unregister() -> Option<bool> {
        set_registered(false)
    }
}

/// Whether this process is running out of a `.app` bundle.
///
/// `SMAppService.mainApp` registers *the bundle*, so an unbundled process has
/// nothing to register. `tauri dev` is unbundled, which is why registration
/// from a dev run reports `notFound` rather than working.
pub fn is_bundled() -> bool {
    std::env::current_exe()
        .ok()
        .and_then(|exe| {
            exe.parent()
                .and_then(|p| p.parent())
                .map(|p| p.ends_with("Contents"))
        })
        .unwrap_or(false)
}

#[cfg(target_os = "macos")]
fn map_status(raw: Option<isize>) -> LoginItemStatus {
    match raw {
        Some(0) => LoginItemStatus::NotRegistered,
        Some(1) => LoginItemStatus::Enabled,
        Some(2) => LoginItemStatus::RequiresApproval,
        Some(3) => LoginItemStatus::NotFound,
        // A status macOS added after this was written. Reporting it as
        // "unsupported" is honest; guessing at "enabled" would not be.
        Some(_) => LoginItemStatus::Unsupported,
        None => LoginItemStatus::Unsupported,
    }
}

#[cfg(target_os = "macos")]
pub fn status() -> LoginItem {
    LoginItem {
        status: map_status(sys::status()),
        bundled: is_bundled(),
    }
}

#[cfg(not(target_os = "macos"))]
pub fn status() -> LoginItem {
    LoginItem {
        status: LoginItemStatus::Unsupported,
        bundled: is_bundled(),
    }
}

/// Register the app to launch at login, then report what macOS actually thinks.
///
/// Reporting the re-read status rather than the call's boolean is deliberate:
/// `requiresApproval` is a successful registration that still does nothing
/// until the user flips the switch, and a bare `true` would hide that.
#[cfg(target_os = "macos")]
pub fn register() -> Result<LoginItem, String> {
    if !is_bundled() {
        return Err(
            "not running from a .app bundle — build and launch zenborg.app, then register".into(),
        );
    }
    match sys::register() {
        None => Err("SMAppService is unavailable (macOS 13 or later required)".into()),
        Some(_) => Ok(status()),
    }
}

#[cfg(not(target_os = "macos"))]
pub fn register() -> Result<LoginItem, String> {
    Err("login items are a macOS concept".into())
}

#[cfg(target_os = "macos")]
pub fn unregister() -> Result<LoginItem, String> {
    match sys::unregister() {
        None => Err("SMAppService is unavailable (macOS 13 or later required)".into()),
        Some(_) => Ok(status()),
    }
}

#[cfg(not(target_os = "macos"))]
pub fn unregister() -> Result<LoginItem, String> {
    Err("login items are a macOS concept".into())
}

// ── Tauri commands ──────────────────────────────────────────────

#[tauri::command]
pub fn login_item_status() -> LoginItem {
    status()
}

#[tauri::command]
pub fn login_item_register() -> Result<LoginItem, String> {
    register()
}

#[tauri::command]
pub fn login_item_unregister() -> Result<LoginItem, String> {
    unregister()
}

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::*;

    #[test]
    fn every_sm_app_service_status_maps_to_a_named_case() {
        assert_eq!(map_status(Some(0)), LoginItemStatus::NotRegistered);
        assert_eq!(map_status(Some(1)), LoginItemStatus::Enabled);
        assert_eq!(map_status(Some(2)), LoginItemStatus::RequiresApproval);
        assert_eq!(map_status(Some(3)), LoginItemStatus::NotFound);
        assert_eq!(map_status(Some(99)), LoginItemStatus::Unsupported);
        assert_eq!(map_status(None), LoginItemStatus::Unsupported);
    }

    #[test]
    fn reading_the_status_never_panics_bundled_or_not() {
        // The test binary is unbundled, so this exercises the unsupported and
        // notFound paths on a machine that does have the framework.
        let item = status();
        assert!(!item.bundled, "cargo test runs the binary unbundled");
        assert!(matches!(
            item.status,
            LoginItemStatus::NotRegistered
                | LoginItemStatus::NotFound
                | LoginItemStatus::RequiresApproval
                | LoginItemStatus::Enabled
                | LoginItemStatus::Unsupported
        ));
    }

    #[test]
    fn registering_from_an_unbundled_process_refuses_rather_than_half_succeeding() {
        assert!(register().is_err());
    }
}
