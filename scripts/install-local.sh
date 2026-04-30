#!/usr/bin/env bash
# Symlink one or more plugins into ~/.claude/ for live development.
#
# Usage:
#   scripts/install-local.sh <name> [<name>...]
#   scripts/install-local.sh --all
#
# - For each plugin: symlink plugins/<name>/skills/<name>/ → ~/.claude/skills/<name>/
# - For each agent under plugins/<name>/agents/: symlink → ~/.claude/agents/<file>
# - Anything currently at the destination is archived to a sibling tree:
#       ~/.claude/skills/<name>     →  ~/.claude/skills-archive/<ts>/<name>/
#       ~/.claude/agents/<file>     →  ~/.claude/agents-archive/<ts>/<file>
#   IMPORTANT — the archive lives OUTSIDE skills/ and agents/ so Claude Code
#   does not pick up backup copies as duplicate skills/agents.
# - Symlinks already pointing into this repo are left untouched (idempotent).

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

[ "${#PLUGINS[@]}" -gt 0 ] || die "no plugins to install"

mkdir -p "$HOME/.claude/skills" "$HOME/.claude/agents"
TS="$(date +%Y%m%d-%H%M%S)"

link_into() {
  local target=$1 link=$2
  if [ -L "$link" ]; then
    local current
    current="$(readlink "$link")"
    if [ "$current" = "$target" ]; then
      info "  already linked: $link"
      return 0
    fi
    rm "$link"
  elif [ -e "$link" ]; then
    # Pick the archive root that is a sibling of skills/ or agents/, so the
    # backup is NOT inside the skill/agent tree (Claude Code would otherwise
    # load the backup as a duplicate skill).
    local archive_root
    case "$link" in
      "$HOME/.claude/skills/"*) archive_root="$HOME/.claude/skills-archive/$TS" ;;
      "$HOME/.claude/agents/"*) archive_root="$HOME/.claude/agents-archive/$TS" ;;
      *) archive_root="$(dirname "$link")-archive/$TS" ;;
    esac
    mkdir -p "$archive_root"
    local archive_path="$archive_root/$(basename "$link")"
    mv "$link" "$archive_path"
    warn "  archived existing: $link → $archive_path"
  fi
  ln -s "$target" "$link"
  ok "  $link → $target"
}

for name in "${PLUGINS[@]}"; do
  plugin_dir="$ROOT/plugins/$name"
  [ -d "$plugin_dir" ] || { warn "skip: plugins/$name not found"; continue; }

  skill_src="$plugin_dir/skills/$name"
  [ -d "$skill_src" ] || { warn "skip: $skill_src not found"; continue; }

  info "installing $name"
  link_into "$skill_src" "$HOME/.claude/skills/$name"

  if [ -d "$plugin_dir/agents" ]; then
    for agent in "$plugin_dir/agents/"*.md; do
      [ -f "$agent" ] || continue
      link_into "$agent" "$HOME/.claude/agents/$(basename "$agent")"
    done
  fi
done

echo ""
ok "install-local complete (${#PLUGINS[@]} plugin(s))"
