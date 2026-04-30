#!/usr/bin/env bash
# Serve a directory over HTTP so chromium-headless / Playwright can screenshot
# the hand-coded polish HTML (both block file:// URLs in some configurations).
#
# Usage: serve.sh <directory> [port]
#   Defaults to port 8765 if not specified.
#
# Returns the PID in the output so the caller can kill the process later.
#
# Example:
#   ~/.claude/skills/d2-architect/scripts/serve.sh /tmp/my-diagram 8765 &
#   SERVER_PID=$!
#   sleep 1
#   ~/.claude/skills/d2-architect/scripts/screenshot.sh http://localhost:8765/arch.html /tmp/my-diagram/arch.png
#   kill $SERVER_PID

set -euo pipefail

dir="${1:?usage: serve.sh <directory> [port]}"
port="${2:-8765}"

if [[ ! -d "$dir" ]]; then
  echo "error: not a directory: $dir" >&2
  exit 1
fi

cd "$dir"
exec python3 -m http.server "$port"
