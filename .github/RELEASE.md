# Release Process

This document describes how to create a new release of Zenborg.

## Prerequisites

### 1. Set Up GitHub Secret

You need to add your Tauri signing private key as a GitHub secret:

1. Go to your repo: https://github.com/Thopiax/zenborg/settings/secrets/actions
2. Click "New repository secret"
3. Name: `TAURI_SIGNING_PRIVATE_KEY`
4. Value: The contents of `~/.tauri/zenborg.key`

```bash
# Copy your private key to clipboard (macOS)
cat ~/.tauri/zenborg.key | pbcopy

# Or print it to paste manually
cat ~/.tauri/zenborg.key
```

**IMPORTANT:** Never commit this key to the repository!

## Release Steps

### Option 1: Automatic Release (Recommended)

1. **Update version** in both files:
   ```bash
   # Update package.json version
   npm version patch  # or minor, or major

   # Manually update src-tauri/tauri.conf.json to match
   ```

2. **Commit the version bump:**
   ```bash
   git add package.json src-tauri/tauri.conf.json pnpm-lock.yaml
   git commit -m "chore: bump version to v0.3.1"
   git push
   ```

3. **Create and push a version tag:**
   ```bash
   git tag v0.3.1
   git push origin v0.3.1
   ```

4. **GitHub Actions will automatically:**
   - Build for macOS Apple Silicon (aarch64)
   - Generate signed update artifacts
   - Create a draft release
   - Upload all artifacts
   - Publish the release

5. **Monitor the workflow:**
   - Go to: https://github.com/Thopiax/zenborg/actions
   - Watch the "Release" workflow
   - Build takes ~5-10 minutes

6. **Edit the release notes** (optional):
   - Go to: https://github.com/Thopiax/zenborg/releases
   - Edit the release description
   - Add changelog details

### Option 2: Manual Trigger

You can also trigger a release manually from the GitHub Actions UI:

1. Go to: https://github.com/Thopiax/zenborg/actions/workflows/release.yml
2. Click "Run workflow"
3. Select branch (usually `main`)
4. Click "Run workflow"

## What Gets Built

The workflow creates these artifacts for macOS Apple Silicon:

### macOS (Apple Silicon only)
- `zenborg_[version]_aarch64.app.tar.gz` (Update artifact)
- `zenborg_[version]_aarch64.app.tar.gz.sig` (Signature file)
- `zenborg_[version]_aarch64.dmg` (Installer for distribution)

## Update Manifest

The Tauri updater automatically generates `latest.json` with this structure:

```json
{
  "version": "0.3.1",
  "notes": "See CHANGELOG.md for details.",
  "pub_date": "2025-11-09T12:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "...",
      "url": "https://github.com/Thopiax/zenborg/releases/download/v0.3.1/zenborg_0.3.1_aarch64.app.tar.gz"
    }
  }
}
```

This file is automatically uploaded to the release and served at:
```
https://github.com/Thopiax/zenborg/releases/latest/download/latest.json
```

## Testing Updates

After publishing a release:

1. Install the previous version
2. Launch the app
3. Wait ~3 seconds (auto-check delay)
4. You should see the update notification
5. Click "Install Update"
6. App should download, install, and relaunch

## Troubleshooting

### Build Fails

**Check the logs:**
1. Go to Actions tab
2. Click on the failed workflow
3. Check which platform failed
4. Expand the failed step

**Common issues:**
- Missing `TAURI_SIGNING_PRIVATE_KEY` secret
- Version mismatch between `package.json` and `tauri.conf.json`
- Missing dependencies on Linux

### Update Not Detected

**Verify:**
1. Release is published (not draft)
2. Version in app < version in release
3. `latest.json` exists in release assets
4. Signatures are present

**Check browser console:**
```javascript
// Should log update check result
console.log('Update available:', update)
```

## Version Numbering

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0): Breaking changes
- **MINOR** (0.1.0): New features, backward compatible
- **PATCH** (0.0.1): Bug fixes, backward compatible

Examples:
- `0.3.1` → `0.3.2` (bug fix)
- `0.3.1` → `0.4.0` (new feature)
- `0.3.1` → `1.0.0` (breaking change)

## Security Notes

1. **Never commit** the private key (`~/.tauri/zenborg.key`)
2. **Rotate keys** if compromised:
   ```bash
   pnpm tauri signer generate -w ~/.tauri/zenborg-new.key
   # Update GitHub secret
   # Update tauri.conf.json pubkey
   ```
3. **Keep backups** of your private key in a secure location
4. **Restrict access** to the GitHub repository secrets

## Automation Tips

### Pre-release Script

Create `scripts/prepare-release.sh`:

```bash
#!/bin/bash
set -e

# Get new version
NEW_VERSION=$1

if [ -z "$NEW_VERSION" ]; then
  echo "Usage: ./scripts/prepare-release.sh 0.3.1"
  exit 1
fi

# Update package.json
npm version $NEW_VERSION --no-git-tag-version

# Update tauri.conf.json
cat src-tauri/tauri.conf.json | jq ".version = \"$NEW_VERSION\"" > tmp.json
mv tmp.json src-tauri/tauri.conf.json

# Commit and tag
git add package.json src-tauri/tauri.conf.json pnpm-lock.yaml
git commit -m "chore: bump version to v$NEW_VERSION"
git tag v$NEW_VERSION

echo "✅ Ready to push: git push && git push --tags"
```

Make it executable:
```bash
chmod +x scripts/prepare-release.sh
```

Use it:
```bash
./scripts/prepare-release.sh 0.3.1
git push && git push --tags
```

## Changelog

Consider maintaining a `CHANGELOG.md` to track changes:

```markdown
# Changelog

## [0.3.1] - 2025-11-09

### Added
- Auto-updater with desktop notifications

### Fixed
- Export/import test failures

### Changed
- Version bump to 0.3.0
```

This can be manually added to GitHub release notes.
