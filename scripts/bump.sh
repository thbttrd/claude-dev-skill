#!/usr/bin/env bash
# Bump the SemVer of a plugin: updates plugin.json, marketplace.json, SKILL.md
# `version:` frontmatter, and inserts a fresh CHANGELOG entry.
#
# Usage:
#   scripts/bump.sh <name> <patch|minor|major>

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"
ROOT="$(repo_root)"
require_tools jq yq

NAME="${1:-}"
KIND="${2:-}"
[ -n "$NAME" ] && [ -n "$KIND" ] || die "usage: $0 <name> <patch|minor|major>"
case "$KIND" in patch|minor|major) ;; *) die "kind must be patch|minor|major" ;; esac

PLUGIN_DIR="$ROOT/plugins/$NAME"
[ -d "$PLUGIN_DIR" ] || die "plugin not found: $PLUGIN_DIR"
PLUGIN_JSON="$PLUGIN_DIR/.claude-plugin/plugin.json"
SKILL_MD="$PLUGIN_DIR/skills/$NAME/SKILL.md"
CHANGELOG="$PLUGIN_DIR/CHANGELOG.md"

CURRENT="$(jq -r .version "$PLUGIN_JSON")"
IFS=. read -r MAJ MIN PAT <<< "$CURRENT"
case "$KIND" in
  patch) PAT=$((PAT + 1)) ;;
  minor) MIN=$((MIN + 1)); PAT=0 ;;
  major) MAJ=$((MAJ + 1)); MIN=0; PAT=0 ;;
esac
NEW="$MAJ.$MIN.$PAT"

info "$NAME: $CURRENT → $NEW ($KIND)"

# plugin.json
TMP="$(mktemp)"
jq --arg v "$NEW" '.version = $v' "$PLUGIN_JSON" > "$TMP" && mv "$TMP" "$PLUGIN_JSON"
ok "plugin.json"

# SKILL.md frontmatter
awk -v ver="$NEW" '
  BEGIN { in_fm = 0; fm_count = 0; done = 0 }
  /^---$/ { fm_count++; in_fm = (fm_count == 1); print; next }
  in_fm && !done && /^version:[[:space:]]/ {
    sub(/^version:[[:space:]]*.*/, "version: " ver)
    done = 1
  }
  { print }
' "$SKILL_MD" > "$SKILL_MD.tmp" && mv "$SKILL_MD.tmp" "$SKILL_MD"
ok "SKILL.md frontmatter"

# marketplace.json
MARKETPLACE="$ROOT/.claude-plugin/marketplace.json"
TMP="$(mktemp)"
jq --arg name "$NAME" --arg v "$NEW" \
  '.plugins |= map(if .name == $name then .version = $v else . end)' \
  "$MARKETPLACE" > "$TMP" && mv "$TMP" "$MARKETPLACE"
ok "marketplace.json"

# CHANGELOG.md — insert a new section right after `## [Unreleased]`
TODAY="$(date +%Y-%m-%d)"
awk -v ver="$NEW" -v today="$TODAY" '
  BEGIN { inserted = 0 }
  /^## \[Unreleased\]/ && !inserted {
    print
    print ""
    print "## [" ver "] — " today
    print ""
    print "### Added"
    print ""
    print "- "
    inserted = 1
    next
  }
  { print }
' "$CHANGELOG" > "$CHANGELOG.tmp" && mv "$CHANGELOG.tmp" "$CHANGELOG"
ok "CHANGELOG.md (added entry — fill in the blank ‘- ’ line)"

echo ""
ok "bumped $NAME to $NEW"
warn "remember to fill in the new CHANGELOG entry before committing"
