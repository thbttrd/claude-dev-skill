#!/usr/bin/env bash
# Screenshot an HTML page to PNG using headless Chrome.
# Usage: screenshot.sh <url> <output.png> [width] [height]
#   width  — viewport width in px (default 1000)
#   height — viewport height in px (default 1800 — enough for most Pattern 3
#            layered diagrams with a 4-5 row legend. See polish-rules.md §31
#            for the height-computation formula; the caller SHOULD compute
#            the required height from the HTML and pass it explicitly rather
#            than rely on the default — Chrome headless captures the viewport
#            only, not the full document, so a too-short viewport silently
#            crops the legend at the canvas bottom edge.)
#
# Prefers Google Chrome at the macOS default path; falls back to
# google-chrome / chromium / chromium-browser on PATH.

set -euo pipefail

url="${1:?usage: screenshot.sh <url> <output.png> [width] [height]}"
out="${2:?usage: screenshot.sh <url> <output.png> [width] [height]}"
width="${3:-1000}"
height="${4:-1800}"

CHROME="${CHROME:-}"
if [[ -z "$CHROME" ]]; then
  if [[ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]]; then
    CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  elif command -v google-chrome >/dev/null 2>&1; then
    CHROME=$(command -v google-chrome)
  elif command -v chromium >/dev/null 2>&1; then
    CHROME=$(command -v chromium)
  elif command -v chromium-browser >/dev/null 2>&1; then
    CHROME=$(command -v chromium-browser)
  fi
fi

if [[ -z "$CHROME" ]] || [[ ! -x "$CHROME" ]]; then
  echo "error: no Chrome/Chromium found. Install Google Chrome or set CHROME env var." >&2
  echo "       If Playwright MCP is available to the caller, prefer that instead." >&2
  exit 1
fi

mkdir -p "$(dirname "$out")"

"$CHROME" \
  --headless \
  --disable-gpu \
  --hide-scrollbars \
  --no-sandbox \
  --screenshot="$out" \
  --window-size="${width},${height}" \
  "$url" 2>/dev/null

if [[ ! -f "$out" ]]; then
  echo "error: screenshot did not produce $out" >&2
  exit 1
fi

echo "saved $out (${width}x${height})"
