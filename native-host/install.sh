#!/usr/bin/env bash
# Install the Chrome native messaging host manifest.
#
# Run once after building: pnpm build:compile && bash install.sh
#
# The manifest tells Chrome where to find the binary and which extension(s)
# may connect. The extension ID comes from the CRX signature — it stays
# stable across dev reloads but changes if you repackage.

set -euo pipefail

HOST_NAME="tech.equanimi.kairos"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HOST_PATH="$SCRIPT_DIR/dist/zenborg-native-host"

# Extension ID — update if the extension is repackaged
EXTENSION_ID="${ZENBORG_EXTENSION_ID:-}"

if [[ -z "$EXTENSION_ID" ]]; then
  echo "Set ZENBORG_EXTENSION_ID to the extension's Chrome ID."
  echo "Find it at chrome://extensions with developer mode on."
  echo ""
  echo "  ZENBORG_EXTENSION_ID=abcdef... bash install.sh"
  exit 1
fi

if [[ ! -x "$HOST_PATH" ]]; then
  echo "Binary not found at $HOST_PATH — run 'pnpm build:compile' first."
  exit 1
fi

# Chrome looks in ~/Library/Application Support/Google/Chrome/NativeMessagingHosts/
# Chromium-based browsers use the same path on macOS.
MANIFEST_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
mkdir -p "$MANIFEST_DIR"

MANIFEST="$MANIFEST_DIR/$HOST_NAME.json"

cat > "$MANIFEST" <<EOF
{
  "name": "$HOST_NAME",
  "description": "zenborg browser extension relay — vault bridge for activity events, fences, and moments",
  "path": "$HOST_PATH",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXTENSION_ID/"
  ]
}
EOF

echo "Installed: $MANIFEST"
echo "Host:      $HOST_PATH"
echo "Extension: $EXTENSION_ID"
