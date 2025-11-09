# Tauri Updater Setup

The Zenborg app includes automatic update checking and installation using the Tauri updater plugin.

## Configuration

### Signing Keys

The private signing key is stored at `~/.tauri/zenborg.key` (excluded from version control).

**Environment Variables for CI/CD:**
```bash
export TAURI_SIGNING_PRIVATE_KEY=$(cat ~/.tauri/zenborg.key)
```

For GitHub Actions, add this as a repository secret named `TAURI_SIGNING_PRIVATE_KEY`.

### Update Endpoints

The app checks for updates at:
```
https://github.com/Thopiax/zenborg/releases/latest/download/latest.json
```

## Building with Update Artifacts

When building the app, Tauri will automatically create signed update artifacts:

```bash
pnpm build:tauri
```

This generates:
- Platform-specific installers (`.dmg`, `.exe`, `.AppImage`, etc.)
- Update artifacts (`.tar.gz`, `.zip`) with `.sig` signature files
- Update manifest JSON files

## Creating a Release

### 1. Update Version

Update the version in both:
- `package.json`
- `src-tauri/tauri.conf.json`

### 2. Build the App

```bash
pnpm build:tauri
```

### 3. Create Update Manifest

Create `latest.json` in your release with this structure:

```json
{
  "version": "0.3.1",
  "notes": "Bug fixes and improvements",
  "pub_date": "2025-11-09T12:00:00Z",
  "platforms": {
    "darwin-x86_64": {
      "signature": "SIGNATURE_FROM_.sig_FILE",
      "url": "https://github.com/Thopiax/zenborg/releases/download/v0.3.1/zenborg_0.3.1_x64.app.tar.gz"
    },
    "darwin-aarch64": {
      "signature": "SIGNATURE_FROM_.sig_FILE",
      "url": "https://github.com/Thopiax/zenborg/releases/download/v0.3.1/zenborg_0.3.1_aarch64.app.tar.gz"
    },
    "linux-x86_64": {
      "signature": "SIGNATURE_FROM_.sig_FILE",
      "url": "https://github.com/Thopiax/zenborg/releases/download/v0.3.1/zenborg_0.3.1_amd64.AppImage.tar.gz"
    },
    "windows-x86_64": {
      "signature": "SIGNATURE_FROM_.sig_FILE",
      "url": "https://github.com/Thopiax/zenborg/releases/download/v0.3.1/zenborg_0.3.1_x64-setup.nsis.zip"
    }
  }
}
```

The signatures can be read from the `.sig` files generated during build:
```bash
cat src-tauri/target/release/bundle/macos/*.tar.gz.sig
```

### 4. Create GitHub Release

1. Go to https://github.com/Thopiax/zenborg/releases/new
2. Create a new tag (e.g., `v0.3.1`)
3. Upload all build artifacts:
   - Installers (`.dmg`, `.exe`, `.AppImage`, etc.)
   - Update bundles (`.tar.gz`, `.zip`)
   - Signature files (`.sig`)
   - The `latest.json` manifest
4. Publish the release

## Testing Updates Locally

### Option 1: Mock Update Server

Create a local static server serving your `latest.json`:

```bash
# In a directory with latest.json and update artifacts
python3 -m http.server 8080
```

Then temporarily update `src-tauri/tauri.conf.json`:
```json
{
  "plugins": {
    "updater": {
      "endpoints": ["http://localhost:8080/latest.json"]
    }
  }
}
```

### Option 2: Test with GitHub Pre-release

1. Create a pre-release on GitHub with version > current
2. Upload artifacts and `latest.json`
3. The app will detect and offer the update

## User Experience

- **Auto-check**: The app checks for updates 3 seconds after launch
- **Notification**: A bottom-right notification appears when an update is available
- **Installation**: Users can click "Install Update" to download and install
- **Progress**: Download progress is shown during installation
- **Relaunch**: The app automatically relaunches after successful installation
- **Dismissal**: Users can dismiss the notification and update later

## Security

- **Cryptographic signing**: All updates are signed with Ed25519 keys
- **Signature verification**: The app verifies signatures before installation
- **HTTPS only**: Update manifests and artifacts must be served over HTTPS in production
- **Private key security**: Never commit the private key (`~/.tauri/zenborg.key`) to version control

## Troubleshooting

### Update Check Fails

1. Verify the endpoint URL is accessible
2. Check browser console for error messages
3. Ensure `latest.json` is valid JSON
4. Confirm signatures match the artifacts

### Update Download Fails

1. Verify artifact URLs are accessible
2. Check file permissions on the server
3. Ensure HTTPS is properly configured

### Update Installation Fails

1. Verify signature is correct
2. Ensure the artifact format matches the platform
3. Check app has write permissions for installation

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    strategy:
      matrix:
        platform: [macos-latest, ubuntu-latest, windows-latest]

    runs-on: ${{ matrix.platform }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Setup pnpm
        uses: pnpm/action-setup@v2
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install

      - name: Build app
        env:
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
        run: pnpm build:tauri

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.platform }}-artifacts
          path: src-tauri/target/release/bundle/**/*
```

## Manual Update Trigger

Users can also manually check for updates from the app (future enhancement):

```typescript
import { check } from '@tauri-apps/plugin-updater';

const handleCheckForUpdates = async () => {
  const update = await check();
  if (update) {
    // Show update notification
  } else {
    // Show "You're up to date" message
  }
};
```

This could be added to the Settings drawer or as a menu item.
