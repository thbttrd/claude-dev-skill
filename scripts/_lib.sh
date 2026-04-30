#!/usr/bin/env bash
# Shared helpers sourced by other scripts. Not meant to be executed directly.
#
# Usage:
#   source "$(dirname "${BASH_SOURCE[0]}")/_lib.sh"

set -euo pipefail

# Resolve repo root from the calling script's location (scripts/ is one level under root).
repo_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
  cd "$script_dir/.." && pwd
}

# Print to stderr in red, then exit 1.
die() {
  printf '\033[31merror:\033[0m %s\n' "$*" >&2
  exit 1
}

# Print to stderr in yellow.
warn() {
  printf '\033[33mwarn:\033[0m %s\n' "$*" >&2
}

# Print to stderr in green.
ok() {
  printf '\033[32m✓\033[0m %s\n' "$*" >&2
}

# Print to stderr in blue.
info() {
  printf '\033[34m→\033[0m %s\n' "$*" >&2
}

# Verify required tools exist.
require_tools() {
  local missing=()
  for tool in "$@"; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
  done
  if [ "${#missing[@]}" -gt 0 ]; then
    die "missing required tools: ${missing[*]}"
  fi
}

# Read a YAML frontmatter field from a SKILL.md file. Returns empty string if absent.
# Usage: skill_field <path> <field>
skill_field() {
  yq -f extract --unwrapScalar -r ".$2 // \"\"" "$1" 2>/dev/null
}
