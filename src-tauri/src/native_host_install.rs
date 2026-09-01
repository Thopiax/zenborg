//! Register the Chrome native messaging manifest on app launch.
//!
//! Chrome requires a JSON manifest at a well-known path that names the
//! host binary and the extension origins allowed to connect. We write it
//! on every launch (200 bytes, idempotent) so moves and updates just work.

use std::fs;
use std::path::PathBuf;

use anyhow::{Context, Result};

const HOST_NAME: &str = "tech.equanimi.kairos";

/// Derived from the pinned public key in `extension/wxt.config.ts`.
/// Stable across dev reloads because the key is committed.
const EXTENSION_ID: &str = "nhgfgpkpdcfmlcodnebehcljdnlfpamo";

fn manifest_dir() -> Option<PathBuf> {
    dirs::home_dir().map(|h| {
        h.join("Library/Application Support/Google/Chrome/NativeMessagingHosts")
    })
}

/// Write the Chrome native messaging manifest pointing at the bundled sidecar.
///
/// Called from the Tauri setup hook. Fails soft — a missing manifest means
/// the extension buffers events in IndexedDB until the next successful install.
pub fn install(sidecar_path: &std::path::Path) -> Result<()> {
    let dir = manifest_dir().context("could not resolve home directory")?;
    fs::create_dir_all(&dir)
        .with_context(|| format!("could not create {}", dir.display()))?;

    let manifest = serde_json::json!({
        "name": HOST_NAME,
        "description": "zenborg browser extension relay",
        "path": sidecar_path.to_string_lossy(),
        "type": "stdio",
        "allowed_origins": [
            format!("chrome-extension://{EXTENSION_ID}/"),
        ]
    });

    let file = dir.join(format!("{HOST_NAME}.json"));
    fs::write(&file, serde_json::to_string_pretty(&manifest)?)
        .with_context(|| format!("could not write {}", file.display()))?;

    log::info!(
        "[native-host] manifest installed: {} → {}",
        file.display(),
        sidecar_path.display()
    );
    Ok(())
}
