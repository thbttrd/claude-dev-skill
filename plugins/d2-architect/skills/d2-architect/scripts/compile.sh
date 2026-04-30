#!/usr/bin/env bash
# Compile a d2 source file to PNG with the skill's standard flags.
# Usage: compile.sh <source.d2> <output.png> [theme] [layout]
#   theme  — d2 theme id (default 0)
#   layout — tala | elk | dagre | auto (default auto)
#
# auto = tala when the d2plugin-tala binary is installed, else elk.
# Under v2.0.0 of the skill, the output of this step is the "first-pass"
# auto-layout that the polish phase reproduces as a pixel-perfect final PNG.
# An unlicensed tala install prints "UNLICENSED COPY" across the PNG; the
# polish phase regenerates from HTML so the watermark never reaches ARCHITECTURE.md.
set -euo pipefail

src="${1:?usage: compile.sh <source.d2> <output.png> [theme] [layout]}"
out="${2:?usage: compile.sh <source.d2> <output.png> [theme] [layout]}"
theme="${3:-0}"
layout="${4:-auto}"

if [[ ! -f "$src" ]]; then
  echo "error: source file not found: $src" >&2
  exit 1
fi

if [[ "$layout" == "auto" ]]; then
  # `d2 layout tala` exits 0 when the plugin is installed, non-zero otherwise.
  if d2 layout tala >/dev/null 2>&1; then
    layout="tala"
  else
    layout="elk"
  fi
fi

mkdir -p "$(dirname "$out")"

d2 --theme="$theme" --layout="$layout" --pad=40 "$src" "$out"
