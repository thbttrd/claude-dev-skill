#!/usr/bin/env bash
# Remove symlinks created by install-local.sh.
#
# Usage:
#   scripts/uninstall-local.sh <name> [<name>...]
#   scripts/uninstall-local.sh --all
#
# Only removes a destination path if it is a symlink pointing into this repo.
# Real files / directories are left untouched. Archived originals live under
# ~/.claude/skills-archive/<ts>/ and ~/.claude/agents-archive/<ts>/ — restore
# manually if you want the pre-install state back (mv them back into ~/.claude/skills/).

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"
ROOT="$(repo_root)"

[ $# -gt 0 ] || die "usage: $0 <name>... | --all"

if [ "$1" = "--all" ]; then
  PLUGINS=()
  for d in "$ROOT/plugins/"*/; do
    [ -d "$d" ] && PLUGINS+=("$(basename "$d")")
  done
else
  PLUGINS=("$@")
fi

unlink_if_ours() {
  local link=$1
  if [ -L "$link" ]; then
    local target
    target="$(readlink "$link")"
    case "$target" in
      "$ROOT"/*) rm "$link"; ok "  removed $link" ;;
      *) warn "  skip (symlink to elsewhere): $link → $target" ;;
    esac
  elif [ -e "$link" ]; then
    warn "  skip (not a symlink): $link"
  fi
}

for name in "${PLUGINS[@]}"; do
  plugin_dir="$ROOT/plugins/$name"
  info "uninstalling $name"
  unlink_if_ours "$HOME/.claude/skills/$name"
  if [ -d "$plugin_dir/agents" ]; then
    for agent in "$plugin_dir/agents/"*.md; do
      [ -f "$agent" ] || continue
      unlink_if_ours "$HOME/.claude/agents/$(basename "$agent")"
    done
  fi
done

ok "uninstall-local complete"
