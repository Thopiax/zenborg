#!/usr/bin/env bash
# Build Zenborg locally and install to /Applications.
#
# Usage:
#   ./scripts/release-local.sh              # build + install
#   ./scripts/release-local.sh --bump       # patch bump, build, install
#   ./scripts/release-local.sh --bump minor # minor bump, build, install

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ "${1:-}" == "--bump" ]]; then
  shift
  bash scripts/bump-version.sh "${1:-patch}"
  shift 2>/dev/null || true
fi

VERSION=$(node -p "require('./package.json').version")
echo "Building zenborg v$VERSION..."

PATH=/usr/bin:$PATH
if [[ -f .env.development.local ]]; then
  set -a; source .env.development.local; set +a
fi
if [[ -f .env ]]; then
  set -a; source .env; set +a
fi

pnpm run build:tauri

APP_BUNDLE="src-tauri/target/release/bundle/macos/zenborg.app"
if [[ ! -d "$APP_BUNDLE" ]]; then
  echo "Build artifact not found at $APP_BUNDLE" >&2
  exit 1
fi

echo "Installing to /Applications..."
if [[ -d /Applications/zenborg.app ]]; then
  rm -rf /Applications/zenborg.app
fi
cp -R "$APP_BUNDLE" /Applications/zenborg.app

echo "Installed zenborg v$VERSION to /Applications/zenborg.app"
echo "Restart the app to pick up the new version."
