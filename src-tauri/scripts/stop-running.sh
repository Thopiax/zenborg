#!/usr/bin/env bash
# Stop the running zenborg app and its sidecars so the build can replace the bundle.
set -euo pipefail

launchctl remove tech.equanimi.zenborg.daemon 2>/dev/null || true
pkill -f 'zenborg.app/Contents/MacOS' 2>/dev/null || true
sleep 0.5
