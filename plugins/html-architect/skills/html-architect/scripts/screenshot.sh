#!/usr/bin/env bash
# Screenshot an HTML page to PNG using headless Chrome.
# Usage: screenshot.sh <url> <output.png> [width] [height]
#   width  — viewport width in px (default 1000)
#   height — viewport height in px. If omitted, auto-computed by fetching
#            the page and parsing `.diagram` + `.legend` dimensions from the
#            HTML. Falls back to 1600 when the page can't be parsed.
#
# Prefers Google Chrome at the macOS default path; falls back to
# google-chrome / chromium / chromium-browser on PATH.

set -euo pipefail

url="${1:?usage: screenshot.sh <url> <output.png> [width] [height]}"
out="${2:?usage: screenshot.sh <url> <output.png> [width] [height]}"
width="${3:-1000}"
height_arg="${4:-}"

# Parse `.diagram` and `.legend` dimensions from the served HTML and return
# a viewport height that fits the full page without truncation. Returns
# nonzero if parsing fails so the caller can fall back.
compute_height_from_html() {
  local src="$1"
  local html
  html=$(curl -sf --max-time 5 "$src" 2>/dev/null) || return 1

  local diagram_h
  diagram_h=$(printf '%s' "$html" | grep -oE 'class="diagram"[^>]*' | head -1 \
              | grep -oE 'height: *[0-9]+px' | head -1 | grep -oE '[0-9]+')
  [[ -z "$diagram_h" ]] && return 1

  # Overheads (with ~100px safety margin):
  #   body padding (80) + h1 (~60) + bottom margin → ~200
  local total=$((diagram_h + 200))

  # Legend block (margin-top 28 + border + padding + h2 ≈ 150) + its SVG height
  if printf '%s' "$html" | grep -q 'class="legend"'; then
    local legend_svg_h
    legend_svg_h=$(printf '%s' "$html" | awk '/class="legend"/,/<\/div>/' \
                   | grep -oE 'height: *[0-9]+px' | head -1 | grep -oE '[0-9]+')
    [[ -z "$legend_svg_h" ]] && legend_svg_h=180
    total=$((total + 150 + legend_svg_h))
  fi

  echo "$total"
}

if [[ -n "$height_arg" ]]; then
  height="$height_arg"
elif computed=$(compute_height_from_html "$url"); then
  height="$computed"
  echo "auto-height: ${height}px (parsed from HTML)" >&2
else
  height=1600
  echo "auto-height: could not parse HTML, using default ${height}px" >&2
fi

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
